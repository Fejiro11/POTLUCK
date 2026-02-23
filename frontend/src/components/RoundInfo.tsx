'use client';

import { Clock, Users, Coins, Trophy } from 'lucide-react';

interface RoundInfoProps {
  roundInfo: {
    roundId: number;
    totalPool: string;
    playerCount: number;
    guessCount: number;
    maxWinners: number;
    isSettled: boolean;
    isWaiting?: boolean;
  } | null;
  timeRemaining: number;
  isRoundWaiting?: boolean;
  isLoading: boolean;
}

export function RoundInfo({ roundInfo, timeRemaining, isRoundWaiting, isLoading }: RoundInfoProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getMaxWinners = (playerCount: number) => {
    if (playerCount <= 10) return 1;
    if (playerCount <= 20) return 3;
    if (playerCount <= 30) return 5;
    if (playerCount <= 40) return 7;
    if (playerCount <= 50) return 9;
    return 11;
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-dark-700 rounded w-1/2 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-dark-700 rounded" />
          <div className="h-4 bg-dark-700 rounded" />
          <div className="h-4 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Round #{roundInfo?.roundId || 1}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          roundInfo?.isSettled 
            ? 'bg-dark-700 text-dark-400' 
            : isRoundWaiting
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-green-500/20 text-green-400'
        }`}>
          {roundInfo?.isSettled ? 'Settled' : isRoundWaiting ? 'Waiting' : 'Active'}
        </span>
      </div>

      {/* Timer */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
          <Clock className="w-4 h-4" />
          Time Remaining
        </div>
        <div className="text-3xl font-mono font-bold gradient-text">
          {isRoundWaiting ? '--:--' : timeRemaining > 0 ? formatTime(timeRemaining) : '00:00'}
        </div>
        {isRoundWaiting && (
          <p className="text-blue-400 text-xs mt-1">Timer starts when first guess is submitted</p>
        )}
        {!isRoundWaiting && timeRemaining <= 0 && !roundInfo?.isSettled && (
          <p className="text-yellow-500 text-xs mt-1">Awaiting settlement...</p>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-dark-400">
            <Coins className="w-4 h-4" />
            Prize Pool
          </div>
          <span className="font-semibold">{roundInfo?.totalPool || '0'} ETH</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-dark-400">
            <Users className="w-4 h-4" />
            Players
          </div>
          <span className="font-semibold">{roundInfo?.playerCount || 0} / 60</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-dark-400">
            <Trophy className="w-4 h-4" />
            Max Winners
          </div>
          <span className="font-semibold">
            {getMaxWinners(roundInfo?.playerCount || 0)}
          </span>
        </div>
      </div>

      {/* Entry Fee Info */}
      <div className="mt-4 pt-4 border-t border-dark-700">
        <div className="flex justify-between text-sm">
          <span className="text-dark-400">Entry Fee</span>
          <span>0.001 ETH</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-dark-400">Platform Fee</span>
          <span>0.3%</span>
        </div>
      </div>
    </div>
  );
}
