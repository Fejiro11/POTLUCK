'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { useFhevm } from '@/fhevm';
import { CONTRACTS, ENTRY_FEE, NETWORK, ZAMA_CONTRACTS } from '@/config/contracts';
import { FHE_LOTTERY_ABI } from '@/config/abi';


interface RoundInfo {
  roundId: number;
  startTime: number;
  endTime: number;
  totalPool: string;
  playerCount: number;
  guessCount: number;
  maxWinners: number;
  isSettled: boolean;
  isWaiting: boolean;
}

export type SettlementStatus = 'idle' | 'requesting' | 'waiting' | 'decrypting' | 'finalizing' | 'done' | 'error';

interface UseLotteryReturn {
  roundInfo: RoundInfo | null;
  timeRemaining: number;
  isRoundWaiting: boolean;
  isLoading: boolean;
  submitGuess: (number: number) => Promise<void>;
  claimRefund: (roundId: number) => Promise<void>;
  claimWinnings: (roundId: number) => Promise<void>;
  refreshRound: () => Promise<void>;
  settleRound: () => Promise<void>;
  settlementStatus: SettlementStatus;
  settlementError: string | null;
  settlementWaitRemaining: number;
}


export function useLottery(): UseLotteryReturn {
  const { provider, signer, isConnected } = useWallet();
  const { encryptUint8 } = useFhevm();
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRoundWaitingState, setIsRoundWaiting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settlementStatus, setSettlementStatus] = useState<SettlementStatus>('idle');
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementWaitRemaining, setSettlementWaitRemaining] = useState(0);
  const settlementAbort = useRef<AbortController | null>(null);

  // Contract is deployed
  const isContractDeployed = CONTRACTS.FHE_LOTTERY.length === 42 && CONTRACTS.FHE_LOTTERY.startsWith('0x');

  // Read-only provider for fetching data without wallet connection
  const getReadProvider = useCallback(() => {
    if (provider) return provider;
    // Fallback to public RPC so all users can read contract state
    return new ethers.JsonRpcProvider(NETWORK.rpcUrl);
  }, [provider]);

  const getContract = useCallback((withSigner = false) => {
    if (!isContractDeployed) return null;

    if (withSigner) {
      if (!provider || !signer) return null;
      return new ethers.Contract(CONTRACTS.FHE_LOTTERY, FHE_LOTTERY_ABI, signer);
    }

    return new ethers.Contract(CONTRACTS.FHE_LOTTERY, FHE_LOTTERY_ABI, getReadProvider());
  }, [provider, signer, isContractDeployed, getReadProvider]);

  const refreshRound = useCallback(async () => {
    if (!isContractDeployed) {
      setIsLoading(false);
      return;
    }

    const contract = getContract();
    if (!contract) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await contract.getCurrentRound();

      // Check if round is waiting for first guess
      let waiting = false;
      try {
        waiting = await contract.isRoundWaiting();
      } catch {
        // Fallback: endTime == 0 means waiting
        waiting = Number(result.endTime) === 0 && !result.isSettled;
      }

      const info: RoundInfo = {
        roundId: Number(result.roundId),
        startTime: Number(result.startTime),
        endTime: Number(result.endTime),
        totalPool: ethers.formatEther(result.totalPool),
        playerCount: Number(result.playerCount),
        guessCount: Number(result.guessCount),
        maxWinners: calculateMaxWinners(Number(result.playerCount)),
        isSettled: result.isSettled,
        isWaiting: waiting,
      };

      setRoundInfo(info);
      setIsRoundWaiting(waiting);

      // Calculate time remaining (0 if waiting for first guess)
      if (waiting || info.endTime === 0) {
        setTimeRemaining(0);
      } else {
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, info.endTime - now);
        setTimeRemaining(remaining);
      }
    } catch (error) {
      console.error('Failed to fetch round info:', error);
      setRoundInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [getContract, isContractDeployed]);

  const submitGuess = useCallback(async (number: number) => {
    if (!isContractDeployed) {
      throw new Error('Contract not deployed. Please deploy and configure the contract address.');
    }

    const contract = getContract(true);
    if (!contract || !signer) {
      throw new Error('Wallet not connected');
    }

    const userAddress = await signer.getAddress();

    try {
      // Encrypt the guess using the FHEVM hook
      const encryptedInputs = await encryptUint8(
        CONTRACTS.FHE_LOTTERY,
        userAddress,
        number
      );

      const encrypted = encryptedInputs.handles[0];
      const inputProof = encryptedInputs.inputProof;

      const tx = await contract.submitGuess(encrypted, inputProof, {
        value: ethers.parseEther(ENTRY_FEE),
      });

      console.log('Transaction submitted:', tx.hash);
      await tx.wait();

      // Refresh round info
      await refreshRound();
    } catch (error: any) {
      console.error('Submit guess failed:', error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      if (error?.reason) console.error('Error reason:', error.reason);
      if (error?.code) console.error('Error code:', error.code);
      throw new Error(error?.message || error?.reason || 'Failed to submit guess');
    }
  }, [getContract, signer, refreshRound, isContractDeployed, encryptUint8]);

  const claimRefund = useCallback(async (roundId: number) => {
    if (!isContractDeployed) {
      throw new Error('Contract not deployed');
    }

    const contract = getContract(true);
    if (!contract || !signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await contract.claimRefund(roundId);
      await tx.wait();
      console.log('Refund claimed successfully');
    } catch (error: any) {
      console.error('Claim refund failed:', error);
      throw new Error(error.message || 'Failed to claim refund');
    }
  }, [getContract, signer, isContractDeployed]);

  const claimWinnings = useCallback(async (roundId: number) => {
    // Winnings are automatically sent during settlement
    // This function is for compatibility
    console.log('Winnings for round', roundId, 'were automatically distributed');
  }, []);

  // Settlement flow — any connected user can trigger this
  const settleRound = useCallback(async () => {
    const contract = getContract(true);
    const readContract = getContract(false);
    if (!contract || !readContract || !signer) {
      throw new Error('Wallet not connected');
    }

    // Abort any in-progress settlement
    settlementAbort.current?.abort();
    const abort = new AbortController();
    settlementAbort.current = abort;

    setSettlementError(null);

    try {
      const roundId = await readContract.currentRoundId();

      // Step 1: Request settlement (if not already requested)
      setSettlementStatus('requesting');
      const roundData = await readContract.rounds(roundId);
      const alreadyRequested = Number(roundData.decryptionRequestedAt) > 0;

      if (!alreadyRequested) {
        console.log('[Settlement] Requesting settlement...');
        const tx = await contract.requestSettlement(roundId);
        await tx.wait();
        console.log('[Settlement] requestSettlement confirmed');
      } else {
        console.log('[Settlement] Decryption already requested');
      }

      if (abort.signal.aborted) return;

      // Step 2: Wait for finality delay
      setSettlementStatus('waiting');
      const updatedRound = await readContract.rounds(roundId);
      const decryptionAt = Number(updatedRound.decryptionRequestedAt);
      const finalityDelay = Number(await readContract.FINALITY_DELAY());
      const readyAt = decryptionAt + finalityDelay;

      // Poll until finality delay passes
      while (true) {
        if (abort.signal.aborted) return;
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, readyAt - now);
        setSettlementWaitRemaining(remaining);
        if (remaining <= 0) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (abort.signal.aborted) return;

      // Step 3: Fetch decrypted values from Zama Relayer
      setSettlementStatus('decrypting');
      const guessCount = Number(updatedRound.guessCount);

      // Read ciphertext handles from contract
      const luckyNumberHandle = updatedRound.encryptedLuckyNumber;
      const distanceHandles: string[] = [];
      for (let i = 0; i < guessCount; i++) {
        const guess = await readContract.roundGuesses(roundId, i);
        distanceHandles.push(guess.distance.toString());
      }

      // CRITICAL: Handle order must match contract's finalizeSettlement
      // Handles are uint256 from contract — convert to 0x-prefixed hex strings for relayer
      const toHex = (v: any) => '0x' + BigInt(v).toString(16).padStart(64, '0');
      const allHandles = [toHex(luckyNumberHandle), ...distanceHandles.map(toHex)];
      console.log(`[Settlement] Fetching ${allHandles.length} decrypted values from relayer...`);

      const response = await fetch(`${ZAMA_CONTRACTS.RELAYER_URL}/v1/public-decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciphertextHandles: allHandles, extraData: '0x00' }),
        signal: abort.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Relayer returned ${response.status}: ${text}`);
      }

      const json = await response.json();
      console.log('[Settlement] Relayer response:', JSON.stringify(json));

      // Parse relayer response: { response: [{ decrypted_value, signatures }] }
      const result = json.response[0];
      const decryptedResult = result.decrypted_value.startsWith('0x')
        ? result.decrypted_value
        : '0x' + result.decrypted_value;
      const kmsSignatures: string[] = result.signatures.map((s: string) =>
        s.startsWith('0x') ? s : '0x' + s
      );

      // Decode clear values from ABI-encoded decryptedResult
      // Each euint8 handle decodes as uint256 in the ABI encoding
      // Format: dummy requestID (32 bytes) + values + dummy bytes[] (32 bytes)
      const { AbiCoder, solidityPacked, concat } = await import('ethers');
      const coder = AbiCoder.defaultAbiCoder();
      const abiTypes = allHandles.map(() => 'uint256'); // euint8 handles decode as uint256
      const restoredEncoded = '0x' +
        '00'.repeat(32) + // dummy requestID
        decryptedResult.slice(2) +
        '00'.repeat(32); // dummy empty bytes[]
      const decoded = coder.decode(['uint256', ...abiTypes, 'bytes[]'], restoredEncoded);
      const rawValues = decoded.slice(1, 1 + allHandles.length);

      const luckyNumber = Number(rawValues[0]);
      const distances = rawValues.slice(1).map((v: any) => Number(v));

      // Build decryption proof: numSigners (uint8) + packed signatures + extraData
      const packedNumSigners = solidityPacked(['uint8'], [kmsSignatures.length]);
      const packedSignatures = solidityPacked(
        Array(kmsSignatures.length).fill('bytes'),
        kmsSignatures
      );
      const proof = concat([packedNumSigners, packedSignatures, '0x']);

      console.log(`[Settlement] Lucky number: ${luckyNumber}, Distances: [${distances.join(', ')}]`);

      if (abort.signal.aborted) return;

      // Step 4: Finalize settlement on-chain
      setSettlementStatus('finalizing');
      const finalizeTx = await contract.finalizeSettlement(
        roundId,
        luckyNumber,
        distances,
        proof,
      );
      await finalizeTx.wait();
      console.log('[Settlement] Finalized!');

      setSettlementStatus('done');
      await refreshRound();

      // Reset to idle after a moment
      setTimeout(() => {
        setSettlementStatus('idle');
      }, 5000);

    } catch (error: any) {
      if (abort.signal.aborted) return;
      console.error('[Settlement] Failed:', error);
      setSettlementStatus('error');
      setSettlementError(error?.reason || error?.message || 'Settlement failed');
    }
  }, [getContract, signer, refreshRound]);

  // Initial load
  useEffect(() => {
    refreshRound();
  }, [refreshRound, isConnected]);

  // Update time remaining every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Refresh round info periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRound();
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [refreshRound]);

  // Listen for on-chain events to sync across all users in real time
  useEffect(() => {
    const contract = getContract();
    if (!contract) return;

    const onGuessSubmitted = () => { refreshRound(); };
    const onRoundStarted = () => { refreshRound(); };
    const onRoundSettled = () => { refreshRound(); };
    const onRoundActivated = () => { refreshRound(); };

    contract.on('GuessSubmitted', onGuessSubmitted);
    contract.on('RoundStarted', onRoundStarted);
    contract.on('RoundSettled', onRoundSettled);
    contract.on('RoundActivated', onRoundActivated);

    return () => {
      contract.off('GuessSubmitted', onGuessSubmitted);
      contract.off('RoundStarted', onRoundStarted);
      contract.off('RoundSettled', onRoundSettled);
      contract.off('RoundActivated', onRoundActivated);
    };
  }, [getContract, refreshRound]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { settlementAbort.current?.abort(); };
  }, []);

  return {
    roundInfo,
    timeRemaining,
    isRoundWaiting: isRoundWaitingState,
    isLoading,
    submitGuess,
    claimRefund,
    claimWinnings,
    refreshRound,
    settleRound,
    settlementStatus,
    settlementError,
    settlementWaitRemaining,
  };
}

function calculateMaxWinners(playerCount: number): number {
  if (playerCount <= 10) return 1;
  if (playerCount <= 20) return 3;
  if (playerCount <= 30) return 5;
  if (playerCount <= 40) return 7;
  if (playerCount <= 50) return 9;
  return 11;
}
