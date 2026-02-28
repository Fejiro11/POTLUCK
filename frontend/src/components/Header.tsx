'use client';

import { Wallet, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  isConnected: boolean;
  address: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({ isConnected, address, onConnect, onDisconnect }: HeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="border-b border-dark-800 bg-dark-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center">
              <span className="text-xl font-bold">🎰</span>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">POTLUCK FHE</h1>
              <p className="text-xs text-dark-400">Private by Default</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {isConnected && address ? (
              <div className="flex items-center gap-3">
                <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-mono">{formatAddress(address)}</span>
                </div>
                <button
                  onClick={onDisconnect}
                  className="btn-secondary flex items-center gap-2 !py-2 !px-4"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={onConnect}
                className="btn-primary flex items-center gap-2"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 hover:bg-dark-800 rounded-lg"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 pt-4 border-t border-dark-800">
            {isConnected && address ? (
              <div className="space-y-3">
                <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-mono">{formatAddress(address)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onDisconnect();
                    setShowMobileMenu(false);
                  }}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onConnect();
                  setShowMobileMenu(false);
                }}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
