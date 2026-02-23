import { FhevmConfig } from './types';

// Zama FHEVM contract addresses on Sepolia
export const ZAMA_SEPOLIA_CONTRACTS = {
  ACL: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  KMS_VERIFIER: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  INPUT_VERIFIER: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  DECRYPTION_ADDRESS: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  RELAYER_URL: 'https://relayer.testnet.zama.org',
  GATEWAY_CHAIN_ID: 10901,
} as const;

// Network configuration
export const SEPOLIA_NETWORK = {
  chainId: 11155111,
  rpcUrl: 'https://eth-sepolia.public.blastapi.io',
} as const;

// Input verification address on Gateway chain (different from INPUT_VERIFIER on host chain)
export const GATEWAY_INPUT_VERIFICATION = '0x483b9dE06E4E4C7D35CCf5837A1668487406D955';

// Full FHEVM config for Sepolia (fallback if SDK's SepoliaConfig unavailable)
export const SEPOLIA_FHEVM_CONFIG: FhevmConfig = {
  aclContractAddress: ZAMA_SEPOLIA_CONTRACTS.ACL,
  kmsContractAddress: ZAMA_SEPOLIA_CONTRACTS.KMS_VERIFIER,
  inputVerifierContractAddress: ZAMA_SEPOLIA_CONTRACTS.INPUT_VERIFIER,
  verifyingContractAddressDecryption: ZAMA_SEPOLIA_CONTRACTS.DECRYPTION_ADDRESS,
  verifyingContractAddressInputVerification: GATEWAY_INPUT_VERIFICATION,
  chainId: SEPOLIA_NETWORK.chainId,
  gatewayChainId: ZAMA_SEPOLIA_CONTRACTS.GATEWAY_CHAIN_ID,
  network: SEPOLIA_NETWORK.rpcUrl,
  relayerUrl: ZAMA_SEPOLIA_CONTRACTS.RELAYER_URL,
};

// SDK loading timeout
export const SDK_LOAD_TIMEOUT_MS = 10000;
// Increased timeout for encryption - first encryption can take longer (fetching public keys from relayer)
export const ENCRYPTION_TIMEOUT_MS = 30000; // 30 seconds (was 15)
