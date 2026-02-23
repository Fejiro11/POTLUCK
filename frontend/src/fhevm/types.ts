// FHEVM Types for TypeScript (per @zama-fhe/relayer-sdk docs)

export interface HandleContractPair {
  handle: string;
  contractAddress: string;
}

export interface EIP712Data {
  domain: Record<string, any>;
  types: { UserDecryptRequestVerification: Array<{ name: string; type: string }> };
  message: Record<string, any>;
}

export interface Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface FhevmInstance {
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string
  ) => EncryptedInput;
  // User decryption methods per Zama relayer-sdk docs
  generateKeypair: () => Keypair;
  createEIP712: (
    publicKey: Uint8Array,
    contractAddresses: string[],
    startTimeStamp: string,
    durationDays: string
  ) => EIP712Data;
  userDecrypt: (
    handleContractPairs: HandleContractPair[],
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimeStamp: string,
    durationDays: string
  ) => Promise<Record<string, bigint>>;
  getPublicKey?: () => { publicKeyId: string; publicKey: Uint8Array } | null;
  getPublicParams?: (bits: number) => { publicParamsId: string; publicParams: Uint8Array } | null;
}

export interface EncryptedInput {
  add8: (value: number) => EncryptedInput;
  add16: (value: number) => EncryptedInput;
  add32: (value: number) => EncryptedInput;
  add64: (value: bigint | number) => EncryptedInput;
  add128: (value: bigint) => EncryptedInput;
  add256: (value: bigint) => EncryptedInput;
  addBool: (value: boolean) => EncryptedInput;
  addAddress: (value: string) => EncryptedInput;
  encrypt: () => Promise<EncryptedInputResult>;
}

export interface EncryptedInputResult {
  handles: Uint8Array[];
  inputProof: Uint8Array;
}

export interface FhevmConfig {
  aclContractAddress: string;
  kmsContractAddress: string;
  inputVerifierContractAddress: string;
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  chainId: number;
  gatewayChainId: number;
  network: string | any;
  relayerUrl: string;
}

export interface FhevmSdk {
  initSDK: (options?: any) => Promise<boolean | void>;
  createInstance: (config: FhevmConfig) => Promise<FhevmInstance>;
}

export type FhevmStatus = 'uninitialized' | 'loading' | 'ready' | 'error';

export interface FhevmState {
  status: FhevmStatus;
  instance: FhevmInstance | null;
  error: string | null;
}
