'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { NumberPicker } from '@/components/NumberPicker';
import { RoundInfo } from '@/components/RoundInfo';
import { WalletConnect } from '@/components/WalletConnect';
import { SubmitGuess } from '@/components/SubmitGuess';
import { PastRounds } from '@/components/PastRounds';
import { ClaimSection } from '@/components/ClaimSection';
import { useWallet } from '@/hooks/useWallet';
import { useLottery } from '@/hooks/useLottery';
import { Shield, Lock, Zap } from 'lucide-react';

export default function Home() {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const { isConnected, address, connect, disconnect } = useWallet();
  const { roundInfo, timeRemaining, isRoundWaiting, isLoading } = useLottery();

  return (
    <main className="min-h-screen">
      <Header 
        isConnected={isConnected} 
        address={address} 
        onConnect={connect} 
        onDisconnect={disconnect} 
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="gradient-text">FHE Lottery</span>
          </h1>
          <p className="text-xl text-dark-300 max-w-2xl mx-auto mb-8">
            The first private-by-default onchain lottery. Your guesses remain encrypted 
            until settlement. Powered by Zama&apos;s fully homomorphic encryption.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-400" />
              <span className="text-sm">Encrypted Guesses</span>
            </div>
            <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary-400" />
              <span className="text-sm">Private Until Settlement</span>
            </div>
            <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-400" />
              <span className="text-sm">Fair & Verifiable</span>
            </div>
          </div>
        </section>

        {/* Main Game Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Number Picker */}
          <div className="lg:col-span-2">
            <div className="card-glow">
              <h2 className="text-2xl font-bold mb-6">Pick Your Number</h2>
              <NumberPicker 
                selectedNumber={selectedNumber} 
                onSelect={setSelectedNumber}
                onClear={() => setSelectedNumber(null)} 
              />
              
              {isConnected && selectedNumber !== null && (
                <div className="mt-8">
                  <SubmitGuess 
                    selectedNumber={selectedNumber} 
                    onSuccess={() => setSelectedNumber(null)} 
                  />
                </div>
              )}

              {!isConnected && (
                <div className="mt-8 text-center">
                  <p className="text-dark-400 mb-4">Connect your wallet to submit a guess</p>
                  <WalletConnect onConnect={connect} />
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Round Info */}
          <div className="space-y-6">
            <RoundInfo 
              roundInfo={roundInfo} 
              timeRemaining={timeRemaining}
              isRoundWaiting={isRoundWaiting}
              isLoading={isLoading} 
            />
            
            {isConnected && (
              <ClaimSection address={address} />
            )}
          </div>
        </div>

        {/* Past Rounds */}
        <section className="mt-12">
          <PastRounds />
        </section>

        {/* How It Works */}
        <section className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Pick a Number',
                description: 'Select any number from 0 to 100',
              },
              {
                step: '02',
                title: 'Encrypt & Submit',
                description: 'Your guess is encrypted client-side before submission',
              },
              {
                step: '03',
                title: 'Wait for Settlement',
                description: 'Round ends after 10 minutes, followed by encrypted computation',
              },
              {
                step: '04',
                title: 'Claim Winnings',
                description: 'Winners are revealed and can claim their prizes',
              },
            ].map((item, i) => (
              <div key={i} className="card text-center">
                <div className="text-4xl font-bold text-primary-500 mb-2">{item.step}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-dark-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Notice */}
        <section className="mt-16 text-center">
          <div className="glass rounded-2xl p-8 max-w-3xl mx-auto">
            <Lock className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Your Privacy is Protected</h3>
            <p className="text-dark-300">
              All guesses remain encrypted throughout the round. Only winning guesses are 
              revealed after settlement. Losing guesses stay encrypted permanently. 
              No one—not validators, not indexers, not observers—can see your strategy.
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-dark-800 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-dark-400">
          <p>Powered by Zama&apos;s Fully Homomorphic Encryption</p>
          <p className="text-sm mt-2">Entry fee: 0.001 ETH • Platform fee: 0.3%</p>
        </div>
      </footer>
    </main>
  );
}
