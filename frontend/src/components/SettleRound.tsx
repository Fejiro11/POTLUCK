'use client';

import { useState } from 'react';
import { Gavel, Loader2, CheckCircle, XCircle, Clock, Radio, Shield } from 'lucide-react';
import { SettlementStatus } from '@/hooks/useLottery';

interface SettleRoundProps {
  onSettle: () => Promise<void>;
  status: SettlementStatus;
  error: string | null;
  waitRemaining: number;
}

const STEPS = [
  { key: 'requesting', label: 'Request decryption', icon: Radio },
  { key: 'waiting', label: 'Finality delay', icon: Shield },
  { key: 'decrypting', label: 'Fetch decrypted values', icon: Clock },
  { key: 'finalizing', label: 'Finalize on-chain', icon: Gavel },
] as const;

const STATUS_ORDER: SettlementStatus[] = ['requesting', 'waiting', 'decrypting', 'finalizing', 'done'];

function getStepState(stepKey: string, currentStatus: SettlementStatus): 'pending' | 'active' | 'done' {
  const stepIdx = STATUS_ORDER.indexOf(stepKey as SettlementStatus);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  if (currentIdx < 0) return 'pending';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export function SettleRound({ onSettle, status, error, waitRemaining }: SettleRoundProps) {
  const [confirming, setConfirming] = useState(false);
  const isActive = status !== 'idle' && status !== 'done' && status !== 'error';

  const handleClick = async () => {
    if (isActive) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    try {
      await onSettle();
    } catch {
      // Error handled in hook
    }
  };

  const formatWait = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Idle state — show button
  if (status === 'idle' || status === 'error') {
    return (
      <div className="card border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Gavel className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-yellow-400">Round Ended</h3>
        </div>
        <p className="text-dark-300 text-sm mb-4">
          This round has ended and needs settlement. Anyone can trigger this process.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleClick}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${
            confirming
              ? 'bg-yellow-500 text-black hover:bg-yellow-400'
              : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
          }`}
        >
          {confirming ? 'Confirm — Start Settlement' : 'Settle Round'}
        </button>
        {confirming && (
          <p className="text-dark-400 text-xs text-center mt-2">
            This will send transactions from your wallet. Gas fees apply.
          </p>
        )}
      </div>
    );
  }

  // Done state
  if (status === 'done') {
    return (
      <div className="card border border-green-500/30 bg-green-500/5">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-green-400">Settlement Complete</h3>
        </div>
        <p className="text-dark-300 text-sm mt-2">
          Round settled successfully. A new round is starting.
        </p>
      </div>
    );
  }

  // In-progress state — show steps
  return (
    <div className="card border border-primary-500/30 bg-primary-500/5">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
        <h3 className="text-lg font-semibold text-primary-400">Settling Round...</h3>
      </div>

      <div className="space-y-3">
        {STEPS.map(({ key, label, icon: Icon }) => {
          const state = getStepState(key, status);
          return (
            <div key={key} className="flex items-center gap-3">
              {state === 'done' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
              {state === 'active' && <Loader2 className="w-4 h-4 text-primary-400 animate-spin flex-shrink-0" />}
              {state === 'pending' && <div className="w-4 h-4 rounded-full border border-dark-600 flex-shrink-0" />}
              <span className={`text-sm ${
                state === 'done' ? 'text-green-400' :
                state === 'active' ? 'text-white' :
                'text-dark-500'
              }`}>
                {label}
                {key === 'waiting' && state === 'active' && waitRemaining > 0 && (
                  <span className="text-primary-400 ml-2 font-mono">{formatWait(waitRemaining)}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-dark-500 text-xs mt-4">
        Do not close this page until settlement is complete.
      </p>
    </div>
  );
}
