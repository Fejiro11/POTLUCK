import { FhevmInstance, FhevmSdk, FhevmConfig } from './types';
import { SDK_LOAD_TIMEOUT_MS, SEPOLIA_FHEVM_CONFIG, ZAMA_SEPOLIA_CONTRACTS } from './constants';
import { publicKeyStorageGet, publicKeyStorageSet } from './publicKeyStorage';

// Extended SDK type that includes SepoliaConfig
interface RelayerSDKType extends FhevmSdk {
  SepoliaConfig?: FhevmConfig;
  __initialized__?: boolean;
}

// Singleton state
let fhevmInstance: FhevmInstance | null = null;
let instancePromise: Promise<FhevmInstance> | null = null;
let sdkInitialized = false;

/**
 * Get the SDK from window, checking multiple possible global names
 */
const getSDKFromWindow = (): RelayerSDKType | null => {
  // Check possible global names the SDK might use
  const possibleNames = ['relayerSDK', 'fhevm', 'fhevmjs', 'relayerSdk'];
  
  for (const name of possibleNames) {
    const sdk = (window as any)[name];
    if (sdk && typeof sdk.initSDK === 'function' && typeof sdk.createInstance === 'function') {
      console.log(`[FHEVM] SDK found as window.${name}`);
      return sdk as RelayerSDKType;
    }
  }
  return null;
};

/**
 * Check if relayerSDK is available on window
 */
const isRelayerSDKAvailable = (): boolean => {
  return getSDKFromWindow() !== null;
};

/**
 * Wait for Zama Relayer SDK to be available (loaded from CDN)
 */
export const waitForSdk = async (maxWaitMs = SDK_LOAD_TIMEOUT_MS): Promise<RelayerSDKType> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const sdk = getSDKFromWindow();
    if (sdk) {
      return sdk;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Debug info before throwing
  const relevantKeys = Object.keys(window).filter(k => 
    k.toLowerCase().includes('fhe') || 
    k.toLowerCase().includes('zama') || 
    k.toLowerCase().includes('relay') ||
    k.toLowerCase().includes('sdk')
  );
  console.error('[FHEVM] SDK not found. Relevant window keys:', relevantKeys);
  
  throw new Error('Zama Relayer SDK not loaded. Ensure the CDN script is loaded.');
};

/**
 * Initialize the SDK (loads WASM)
 */
export const initializeSdk = async (): Promise<void> => {
  if (sdkInitialized) return;

  const sdk = await waitForSdk();
  
  // Check if already initialized
  if (sdk.__initialized__ === true) {
    sdkInitialized = true;
    console.log('[FHEVM] SDK already initialized');
    return;
  }

  console.log('[FHEVM] Initializing SDK (loading WASM)...');
  
  const result = await sdk.initSDK();
  
  // Mark SDK as initialized
  sdk.__initialized__ = result !== false;
  sdkInitialized = sdk.__initialized__;
  
  if (!sdkInitialized) {
    throw new Error('window.relayerSDK.initSDK failed');
  }
  
  console.log('[FHEVM] SDK WASM initialized');
};

/**
 * Get or create FHEVM instance (singleton)
 */
export const getFhevmInstance = async (provider?: any): Promise<FhevmInstance> => {
  if (fhevmInstance) return fhevmInstance;
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    // Ensure SDK is initialized
    await initializeSdk();

    const sdk = await waitForSdk();
    
    const networkProvider = provider || (window as any).ethereum;
    if (!networkProvider) {
      throw new Error('No Web3 provider available (window.ethereum)');
    }

    // Verify network is Sepolia or localhost before proceeding
    try {
      const chainId = await networkProvider.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainId, 16);
      console.log('[FHEVM] Connected to chain ID:', chainIdNum);
      
      // Allow both Sepolia (11155111) and localhost (31337) for development
      if (chainIdNum !== 11155111 && chainIdNum !== 31337) {
        throw new Error(`Wrong network! FHEVM requires Sepolia (chain ID 11155111) or localhost (31337). You are on chain ${chainIdNum}. Please switch networks in your wallet.`);
      }
      
      if (chainIdNum === 31337) {
        console.warn('[FHEVM] Running on localhost - FHEVM operations may be limited. For full functionality, use Sepolia testnet.');
      }
    } catch (err: any) {
      if (err.message?.includes('Wrong network')) throw err;
      console.warn('[FHEVM] Could not verify chain ID:', err.message);
    }

    // Get ACL address for public key caching
    const aclAddress = (sdk.SepoliaConfig?.aclContractAddress || ZAMA_SEPOLIA_CONTRACTS.ACL) as `0x${string}`;
    
    // Try to get cached public keys
    console.log('[FHEVM] Checking for cached public keys...');
    const cachedKeys = await publicKeyStorageGet(aclAddress);
    console.log('[FHEVM] Cached keys:', {
      hasPublicKey: !!cachedKeys.publicKey,
      hasPublicParams: !!cachedKeys.publicParams,
    });

    // Use SDK's built-in SepoliaConfig if available, otherwise use our fallback
    let config: FhevmConfig & { publicKey?: any; publicParams?: any };
    
    if (sdk.SepoliaConfig) {
      console.log('[FHEVM] Using SDK built-in SepoliaConfig');
      config = {
        ...sdk.SepoliaConfig,
        network: networkProvider,
        // Add cached public keys if available (avoids relayer fetch)
        ...(cachedKeys.publicKey && { publicKey: cachedKeys.publicKey }),
        ...(cachedKeys.publicParams && { publicParams: cachedKeys.publicParams }),
      };
    } else {
      console.log('[FHEVM] SDK SepoliaConfig not found, using fallback config');
      config = {
        ...SEPOLIA_FHEVM_CONFIG,
        network: networkProvider,
        ...(cachedKeys.publicKey && { publicKey: cachedKeys.publicKey }),
        ...(cachedKeys.publicParams && { publicParams: cachedKeys.publicParams }),
      };
    }

    console.log('[FHEVM] Creating instance with config:', JSON.stringify({
      aclContractAddress: config.aclContractAddress,
      kmsContractAddress: config.kmsContractAddress,
      inputVerifierContractAddress: config.inputVerifierContractAddress,
      chainId: config.chainId,
      gatewayChainId: config.gatewayChainId,
      relayerUrl: config.relayerUrl,
      network: typeof config.network === 'string' ? config.network : 'Eip1193Provider',
      hasPublicKey: !!config.publicKey,
      hasPublicParams: !!config.publicParams,
    }, null, 2));

    try {
      fhevmInstance = await sdk.createInstance(config);
      console.log('[FHEVM] Instance created successfully');
      
      // Cache the public keys for next time
      try {
        const newPublicKey = fhevmInstance.getPublicKey?.();
        const newPublicParams = fhevmInstance.getPublicParams?.(2048);
        if (newPublicKey || newPublicParams) {
          console.log('[FHEVM] Caching public keys for future use...');
          await publicKeyStorageSet(aclAddress, newPublicKey || null, newPublicParams || null);
        }
      } catch (cacheErr) {
        console.warn('[FHEVM] Failed to cache public keys:', cacheErr);
      }
    } catch (err: any) {
      console.error('[FHEVM] createInstance failed:', err);
      console.error('[FHEVM] Error details:', {
        message: err?.message,
        code: err?.code,
        stack: err?.stack?.slice(0, 500),
      });
      throw err;
    }
    
    return fhevmInstance;
  })();

  return instancePromise;
};

/**
 * Check if SDK is ready
 */
export const isSdkReady = (): boolean => sdkInitialized && fhevmInstance !== null;

/**
 * Reset instance (for testing or reconnection)
 */
export const resetFhevmInstance = (): void => {
  fhevmInstance = null;
  instancePromise = null;
  // Note: don't reset sdkInitialized as WASM is still loaded
};
