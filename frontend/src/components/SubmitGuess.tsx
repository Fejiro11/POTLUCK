'use client';

import { useState } from 'react';
import { Lock, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { useLottery } from '@/hooks/useLottery';

interface SubmitGuessProps {
  selectedNumber: number;
  onSuccess: () => void;
}

export function SubmitGuess({ selectedNumber, onSuccess }: SubmitGuessProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submitGuess } = useLottery();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitGuess(selectedNumber);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Failed to submit guess:', err);
      // Show error in UI instead of blocking alert
      setError(err?.message || 'Failed to submit guess. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Guess Submitted!</h3>
        <p className="text-dark-400">
          Your encrypted guess has been recorded. Good luck!
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold">Encrypt & Submit</h3>
          <p className="text-sm text-dark-400">Your guess will be encrypted client-side</p>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-dark-400 text-sm">Your Number</span>
          <span className="text-2xl font-bold gradient-text">{selectedNumber}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-dark-400 text-sm">Entry Fee</span>
          <span className="font-semibold">0.001 ETH</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{error}</p>
            <p className="text-xs text-red-400/70 mt-1">Check browser console (F12) for details</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Encrypting & Submitting...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            Submit Encrypted Guess
          </>
        )}
      </button>

      <p className="text-xs text-dark-500 text-center mt-3">
        Your guess is encrypted before leaving your device. 
        No one can see your number until settlement.
      </p>
      
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
        <p className="text-xs text-yellow-300">
          <strong>Note:</strong> Some wallets (like OKX) may show a security warning about "legal risk" 
          when you approve the transaction. This is a <strong>false positive</strong> - the warning appears 
          because FHE transactions contain encrypted data that looks unusual to security scanners. 
          The transaction is safe to approve.
        </p>
      </div>
    </div>
  );
}
