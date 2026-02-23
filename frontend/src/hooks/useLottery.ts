'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { useFhevm } from '@/fhevm';
import { CONTRACTS, ENTRY_FEE } from '@/config/contracts';
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

interface UseLotteryReturn {
  roundInfo: RoundInfo | null;
  timeRemaining: number;
  isRoundWaiting: boolean;
  isLoading: boolean;
  submitGuess: (number: number) => Promise<void>;
  claimRefund: (roundId: number) => Promise<void>;
  claimWinnings: (roundId: number) => Promise<void>;
  refreshRound: () => Promise<void>;
}


export function useLottery(): UseLotteryReturn {
  const { provider, signer, isConnected } = useWallet();
  const { encryptUint8 } = useFhevm();
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRoundWaitingState, setIsRoundWaiting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Contract is deployed
  const isContractDeployed = CONTRACTS.FHE_LOTTERY.length === 42 && CONTRACTS.FHE_LOTTERY.startsWith('0x');

  const getContract = useCallback((withSigner = false) => {
    if (!provider || !isContractDeployed) return null;
    
    const contract = new ethers.Contract(
      CONTRACTS.FHE_LOTTERY,
      FHE_LOTTERY_ABI,
      withSigner && signer ? signer : provider
    );
    return contract;
  }, [provider, signer, isContractDeployed]);

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
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [refreshRound]);

  return {
    roundInfo,
    timeRemaining,
    isRoundWaiting: isRoundWaitingState,
    isLoading,
    submitGuess,
    claimRefund,
    claimWinnings,
    refreshRound,
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
