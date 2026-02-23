/**
 * FHE Utilities for client-side encryption
 * 
 * @deprecated This module is deprecated. Use the new @/fhevm module instead.
 * This file is kept for backwards compatibility.
 */

import { getFhevmInstance, FhevmInstance } from '@/fhevm';
import { NETWORK } from '@/config/contracts';

// Re-export types from the new module
export type { FhevmInstance, EncryptedInput, EncryptedInputResult } from '@/fhevm';

/**
 * Initialize the FHEVM instance for Sepolia network
 * @deprecated Use getFhevmInstance from @/fhevm instead
 */
export async function initFhevm(): Promise<FhevmInstance | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return await getFhevmInstance();
  } catch (error) {
    console.warn('FHEVM initialization failed:', error);
    return null;
  }
}

/**
 * Encrypt a lottery guess (0-100)
 * @deprecated Use useFhevm hook from @/fhevm instead
 * 
 * @param guess - The number to encrypt (0-100)
 * @param contractAddress - The lottery contract address
 * @param userAddress - The user's wallet address
 * @returns Encrypted input and proof for contract submission
 */
export async function encryptGuess(
  guess: number,
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedGuess: Uint8Array; inputProof: Uint8Array }> {
  // Validate guess range
  if (guess < 0 || guess > 100) {
    throw new Error('Guess must be between 0 and 100');
  }

  // Try to initialize FHEVM
  const fhevm = await initFhevm();

  // If FHEVM failed to load, throw error (no mock in production)
  if (!fhevm) {
    throw new Error('FHEVM not available - ensure FhevmProvider is initialized');
  }

  // Create encrypted input
  const input = fhevm.createEncryptedInput(contractAddress, userAddress);
  
  // Add the guess as an 8-bit unsigned integer
  input.add8(guess);

  // Generate the encryption
  const { handles, inputProof } = await input.encrypt();

  return {
    encryptedGuess: handles[0],
    inputProof,
  };
}

/**
 * Encrypt multiple lottery guesses
 * @deprecated Use useFhevm hook from @/fhevm instead
 */
export async function encryptMultipleGuesses(
  guesses: number[],
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedGuesses: Uint8Array[]; inputProofs: Uint8Array[] }> {
  // Validate all guesses
  for (const guess of guesses) {
    if (guess < 0 || guess > 100) {
      throw new Error('All guesses must be between 0 and 100');
    }
  }

  // Encrypt each guess
  const results = await Promise.all(
    guesses.map(guess => encryptGuess(guess, contractAddress, userAddress))
  );

  return {
    encryptedGuesses: results.map(r => r.encryptedGuess),
    inputProofs: results.map(r => r.inputProof),
  };
}

/**
 * Check if FHE is available on the current network
 * Returns true if on Sepolia (where Zama FHEVM is deployed)
 */
export function isFheAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  const provider = (window as any).ethereum;
  if (!provider) return false;

  // Check if we're on Sepolia (Zama FHEVM network)
  const sepoliaChainIds = ['0xaa36a7', '11155111']; // Sepolia testnet
  const currentChainId = provider.chainId?.toString();
  return sepoliaChainIds.includes(currentChainId) || 
         parseInt(currentChainId, 16) === NETWORK.chainId;
}

/**
 * Get the encryption function
 * @deprecated Use useFhevm hook from @/fhevm instead
 */
export function getEncryptionFunction() {
  return encryptGuess;
}
