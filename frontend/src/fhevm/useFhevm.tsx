'use client';

import { useCallback } from 'react';
import { useFhevmContext } from './FhevmProvider';
import { EncryptedInputResult } from './types';

/**
 * Hook for FHEVM encryption operations
 * Must be used within a FhevmProvider
 */
export function useFhevm() {
  const { status, instance, error, initialize, encryptValue } = useFhevmContext();

  const isReady = status === 'ready';
  const isLoading = status === 'loading';
  const isError = status === 'error';

  /**
   * Encrypt a uint8 value (0-255) for a contract
   */
  const encryptUint8 = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: number
  ): Promise<EncryptedInputResult> => {
    if (value < 0 || value > 255) {
      throw new Error('Value must be between 0 and 255 for uint8');
    }
    return encryptValue(contractAddress, userAddress, value, 'uint8');
  }, [encryptValue]);

  /**
   * Encrypt a uint16 value for a contract
   */
  const encryptUint16 = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: number
  ): Promise<EncryptedInputResult> => {
    return encryptValue(contractAddress, userAddress, value, 'uint16');
  }, [encryptValue]);

  /**
   * Encrypt a uint32 value for a contract
   */
  const encryptUint32 = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: number
  ): Promise<EncryptedInputResult> => {
    return encryptValue(contractAddress, userAddress, value, 'uint32');
  }, [encryptValue]);

  /**
   * Encrypt a boolean value for a contract
   */
  const encryptBool = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: boolean
  ): Promise<EncryptedInputResult> => {
    return encryptValue(contractAddress, userAddress, value ? 1 : 0, 'bool');
  }, [encryptValue]);

  return {
    // State
    status,
    isReady,
    isLoading,
    isError,
    error,
    instance,
    
    // Actions
    initialize,
    
    // Encryption helpers
    encryptUint8,
    encryptUint16,
    encryptUint32,
    encryptBool,
    encryptValue,
  };
}
