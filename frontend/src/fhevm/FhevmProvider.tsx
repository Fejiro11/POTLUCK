'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { FhevmInstance, FhevmState, FhevmStatus, EncryptedInputResult, HandleContractPair } from './types';
import { getFhevmInstance, initializeSdk } from './fhevmInstance';
import { ENCRYPTION_TIMEOUT_MS } from './constants';

interface FhevmContextValue extends FhevmState {
  initialize: () => Promise<void>;
  encryptValue: (
    contractAddress: string,
    userAddress: string,
    value: number,
    type?: 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'bool'
  ) => Promise<EncryptedInputResult>;
  decryptValue: (
    handleContractPairs: HandleContractPair[],
    contractAddresses: string[],
    signer: any
  ) => Promise<Record<string, bigint>>;
}

const FhevmContext = createContext<FhevmContextValue | null>(null);

interface FhevmProviderProps {
  children: ReactNode;
  autoInitialize?: boolean;
}

export function FhevmProvider({ children, autoInitialize = true }: FhevmProviderProps) {
  const [state, setState] = useState<FhevmState>({
    status: 'uninitialized',
    instance: null,
    error: null,
  });

  const initialize = useCallback(async () => {
    if (state.status === 'ready' || state.status === 'loading') return;

    setState(prev => ({ ...prev, status: 'loading', error: null }));

    try {
      // Verify we're on Sepolia before initializing FHEVM
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        const chainId = await ethereum.request({ method: 'eth_chainId' });
        const chainIdNum = parseInt(chainId, 16);
        console.log('[FhevmProvider] Current chain ID:', chainIdNum);
        
        if (chainIdNum !== 11155111) {
          throw new Error(`Wrong network! Please switch to Sepolia (chain ID 11155111). Current: ${chainIdNum}`);
        }
      }

      // Initialize SDK and get instance
      await initializeSdk();
      const instance = await getFhevmInstance();

      setState({
        status: 'ready',
        instance,
        error: null,
      });

      console.log('[FhevmProvider] FHEVM ready');
    } catch (error: any) {
      console.error('[FhevmProvider] Initialization failed:', error);
      setState({
        status: 'error',
        instance: null,
        error: error.message || 'Failed to initialize FHEVM',
      });
    }
  }, [state.status]);

  const encryptValue = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: number,
    type: 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'bool' = 'uint8'
  ): Promise<EncryptedInputResult> => {
    // Ensure we have an instance
    let instance = state.instance;
    if (!instance) {
      console.log('[FhevmProvider] Instance not ready, initializing...');
      instance = await getFhevmInstance();
    }

    // Create encrypted input
    const input = instance.createEncryptedInput(contractAddress, userAddress);

    // Add value based on type
    switch (type) {
      case 'uint8':
        input.add8(value);
        break;
      case 'uint16':
        input.add16(value);
        break;
      case 'uint32':
        input.add32(value);
        break;
      case 'uint64':
        input.add64(BigInt(value));
        break;
      case 'bool':
        input.addBool(Boolean(value));
        break;
    }

    // Encrypt with timeout
    const encryptWithTimeout = (): Promise<EncryptedInputResult> => Promise.race([
      input.encrypt(),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          const error = new Error('Encryption timeout - this may be due to network issues or the relayer being slow. Check your connection and try again.');
          console.error('[FHEVM] Encryption timeout details:', {
            contractAddress,
            userAddress,
            value,
            type,
            timeoutMs: ENCRYPTION_TIMEOUT_MS,
          });
          reject(error);
        }, ENCRYPTION_TIMEOUT_MS)
      ),
    ]);

    try {
      return await encryptWithTimeout();
    } catch (error: any) {
      // Provide more helpful error message
      if (error.message?.includes('timeout')) {
        console.error('[FHEVM] Encryption failed - possible causes:');
        console.error('  1. Network connectivity issues');
        console.error('  2. Relayer service is slow or unavailable');
        console.error('  3. FHEVM instance not properly initialized');
        console.error('  4. Running on localhost (use Sepolia for full functionality)');
      }
      throw error;
    }
  }, [state.instance]);

  // User decryption per Zama relayer-sdk docs
  const decryptValue = useCallback(async (
    handleContractPairs: HandleContractPair[],
    contractAddresses: string[],
    signer: any
  ): Promise<Record<string, bigint>> => {
    let instance = state.instance;
    if (!instance) {
      instance = await getFhevmInstance();
    }

    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = '10';

    const eip712 = instance.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays,
    );

    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message,
    );

    return instance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x', ''),
      contractAddresses,
      signer.address,
      startTimeStamp,
      durationDays,
    );
  }, [state.instance]);

  // Auto-initialize on mount if enabled
  useEffect(() => {
    if (autoInitialize && typeof window !== 'undefined') {
      // Small delay to ensure CDN script is loaded
      const timer = setTimeout(initialize, 500);
      return () => clearTimeout(timer);
    }
  }, [autoInitialize, initialize]);

  const value: FhevmContextValue = {
    ...state,
    initialize,
    encryptValue,
    decryptValue,
  };

  return (
    <FhevmContext.Provider value={value}>
      {children}
    </FhevmContext.Provider>
  );
}

export function useFhevmContext(): FhevmContextValue {
  const context = useContext(FhevmContext);
  if (!context) {
    throw new Error('useFhevmContext must be used within a FhevmProvider');
  }
  return context;
}
