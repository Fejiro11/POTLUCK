'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Trophy, Users, Hash, ExternalLink } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { CONTRACTS } from '@/config/contracts';
import { FHE_LOTTERY_ABI } from '@/config/abi';

interface RoundResult {
  roundId: number;
  luckyNumber: number;
  winners: string[];
  payouts: string[];
  totalPool: string;
  hasExactMatch: boolean;
}

export function PastRounds() {
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { provider } = useWallet();

  const fetchPastRounds = useCallback(async () => {
    if (!provider) {
      setIsLoading(false);
      return;
    }

    try {
      const contract = new ethers.Contract(CONTRACTS.FHE_LOTTERY, FHE_LOTTERY_ABI, provider);
      const currentRoundId = Number(await contract.currentRoundId());
      const pastRounds: RoundResult[] = [];

      // Fetch up to 10 most recent settled rounds
      const startRound = Math.max(1, currentRoundId - 10);
      for (let roundId = currentRoundId; roundId >= startRound; roundId--) {
        try {
          const result = await contract.getRoundResults(roundId);
          if (result.isSettled) {
            const formatAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
            pastRounds.push({
              roundId,
              luckyNumber: Number(result.luckyNumber),
              winners: result.winners.map((w: string) => formatAddr(w)),
              payouts: result.payouts.map((p: bigint) => ethers.formatEther(p)),
              totalPool: '—', // totalPool not returned by getRoundResults
              hasExactMatch: result.hasExactMatch,
            });
          }
        } catch {
          // Round not settled yet or doesn't exist — skip
        }
      }

      setRounds(pastRounds);
    } catch (error) {
      console.error('Failed to fetch past rounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchPastRounds();
  }, [fetchPastRounds]);

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Past Rounds</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-dark-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Past Rounds</h2>
        <p className="text-dark-400">No completed rounds yet. Be the first to play!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">Past Rounds</h2>
      
      <div className="space-y-4">
        {rounds.map((round) => (
          <div
            key={round.roundId}
            className="bg-dark-800 rounded-xl p-4 hover:bg-dark-700 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <Hash className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Round #{round.roundId}</h3>
                  <p className="text-sm text-dark-400">
                    Lucky Number: <span className="text-primary-400 font-bold">{round.luckyNumber}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-dark-400 text-sm">
                    <Trophy className="w-4 h-4" />
                    Winners
                  </div>
                  <p className="font-semibold">{round.winners.length}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-dark-400 text-sm">
                    <Users className="w-4 h-4" />
                    Pool
                  </div>
                  <p className="font-semibold">{round.totalPool} ETH</p>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  round.hasExactMatch 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {round.hasExactMatch ? 'Winners' : 'No Match'}
                </span>
              </div>
            </div>

            {/* Winners List */}
            {round.winners.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dark-700">
                <p className="text-sm text-dark-400 mb-2">Winners:</p>
                <div className="flex flex-wrap gap-2">
                  {round.winners.map((winner, idx) => (
                    <div
                      key={idx}
                      className="glass rounded-lg px-3 py-1 text-sm flex items-center gap-2"
                    >
                      <span className="font-mono">{winner}</span>
                      <span className="text-primary-400">{round.payouts[idx]} ETH</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
