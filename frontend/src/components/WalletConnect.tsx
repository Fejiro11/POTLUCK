'use client';

import { Wallet } from 'lucide-react';

interface WalletConnectProps {
  onConnect: () => void;
}

export function WalletConnect({ onConnect }: WalletConnectProps) {
  return (
    <button
      onClick={onConnect}
      className="btn-primary flex items-center gap-2 mx-auto"
    >
      <Wallet className="w-5 h-5" />
      Connect Wallet
    </button>
  );
}
