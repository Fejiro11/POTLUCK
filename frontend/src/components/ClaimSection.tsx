'use client';

import { useState, useEffect } from 'react';
import { Gift, Loader2, AlertCircle } from 'lucide-react';
import { useLottery } from '@/hooks/useLottery';

interface ClaimSectionProps {
  address: string | null;
}

interface ClaimableRound {
  roundId: number;
  type: 'winner' | 'refund';
  amount: string;
}

export function ClaimSection({ address }: ClaimSectionProps) {
  const [claimableRounds, setClaimableRounds] = useState<ClaimableRound[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { claimRefund, claimWinnings } = useLottery();

  useEffect(() => {
    if (!address) {
      setClaimableRounds([]);
      setIsLoading(false);
      return;
    }

    // Check for claimable rounds - in production, fetch from contract
    const checkClaimable = async () => {
      setIsLoading(true);
      try {
        // Simulated check - replace with actual contract calls
        await new Promise(resolve => setTimeout(resolve, 500));
        setClaimableRounds([]);
      } catch (error) {
        console.error('Error checking claimable rounds:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkClaimable();
  }, [address]);

  const handleClaim = async (round: ClaimableRound) => {
    setIsClaiming(true);
    try {
      if (round.type === 'refund') {
        await claimRefund(round.roundId);
      } else {
        await claimWinnings(round.roundId);
      }
      // Remove claimed round from list
      setClaimableRounds(prev => prev.filter(r => r.roundId !== round.roundId));
    } catch (error) {
      console.error('Claim failed:', error);
      alert('Failed to claim. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-dark-700 rounded w-1/2 mb-4" />
        <div className="h-16 bg-dark-700 rounded" />
      </div>
    );
  }

  if (claimableRounds.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold">Claim Rewards</h3>
        </div>
        <p className="text-dark-400 text-sm">
          No rewards to claim at this time. Play to win!
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <Gift className="w-5 h-5 text-primary-400" />
        <h3 className="font-semibold">Claim Rewards</h3>
        <span className="bg-primary-500/20 text-primary-400 text-xs px-2 py-0.5 rounded-full">
          {claimableRounds.length} available
        </span>
      </div>

      <div className="space-y-3">
        {claimableRounds.map((round) => (
          <div
            key={round.roundId}
            className="bg-dark-800 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium">Round #{round.roundId}</p>
              <p className="text-sm text-dark-400">
                {round.type === 'winner' ? '🏆 Winner' : '↩️ Refund'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-primary-400">{round.amount} ETH</p>
              <button
                onClick={() => handleClaim(round)}
                disabled={isClaiming}
                className="btn-primary text-sm !py-1 !px-3 mt-1"
              >
                {isClaiming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Claim'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
