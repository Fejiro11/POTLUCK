'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { NETWORK } from '@/config/contracts';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface UseWalletReturn {
  isConnected: boolean;
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      
      if (accounts.length > 0) {
        const userSigner = await browserProvider.getSigner();
        const network = await browserProvider.getNetwork();
        
        setProvider(browserProvider);
        setSigner(userSigner);
        setAddress(accounts[0]);
        setChainId(Number(network.chainId));
        setIsConnected(true);

        // Store connection state
        localStorage.setItem('walletConnected', 'true');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
    localStorage.removeItem('walletConnected');
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error: any) {
      // If network doesn't exist, add it
      if (error.code === 4902) {
        // Add Sepolia testnet (with Zama FHEVM)
        if (targetChainId === NETWORK.chainId) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${NETWORK.chainId.toString(16)}`,
              chainName: NETWORK.name,
              nativeCurrency: {
                name: 'Sepolia ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [NETWORK.rpcUrl],
              blockExplorerUrls: [NETWORK.blockExplorer],
            }],
          });
        } else {
          console.error('Network not found, please add it manually');
          throw error;
        }
      } else {
        throw error;
      }
    }
  }, []);

  // Auto-connect if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem('walletConnected') === 'true';
    if (wasConnected && window.ethereum) {
      connect().catch(console.error);
    }
  }, [connect]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(parseInt(newChainId, 16));
      // Reload to ensure consistent state
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [address, disconnect]);

  return {
    isConnected,
    address,
    provider,
    signer,
    chainId,
    connect,
    disconnect,
    switchNetwork,
  };
}
