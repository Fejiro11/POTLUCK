'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NumberPickerProps {
  selectedNumber: number | null;
  onSelect: (num: number) => void;
  onClear?: () => void;
}

export function NumberPicker({ selectedNumber, onSelect, onClear }: NumberPickerProps) {
  const [page, setPage] = useState(0);
  const numbersPerPage = 20;
  const totalNumbers = 101; // 0 to 100
  const totalPages = Math.ceil(totalNumbers / numbersPerPage);

  const startNum = page * numbersPerPage;
  const endNum = Math.min(startNum + numbersPerPage, totalNumbers);
  const numbers = Array.from({ length: endNum - startNum }, (_, i) => startNum + i);

  return (
    <div>
      {/* Quick Input */}
      <div className="mb-6">
        <label className="block text-sm text-dark-400 mb-2">Quick pick (0-100)</label>
        <div className="flex gap-3">
          <input
            type="number"
            min="0"
            max="100"
            value={selectedNumber ?? ''}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 0 && val <= 100) {
                onSelect(val);
              }
            }}
            placeholder="Enter number..."
            className="input-field flex-1"
          />
          <button
            onClick={() => onSelect(Math.floor(Math.random() * 101))}
            className="btn-secondary whitespace-nowrap"
          >
            🎲 Random
          </button>
        </div>
      </div>

      {/* Number Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {numbers.map((num) => (
          <button
            key={num}
            onClick={() => onSelect(num)}
            className={`
              number-picker
              ${selectedNumber === num ? 'number-picker-active' : 'number-picker-inactive'}
            `}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="btn-secondary !p-2 disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`
                w-8 h-8 rounded-lg text-sm font-medium transition-all
                ${page === i 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                }
              `}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page === totalPages - 1}
          className="btn-secondary !p-2 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Selected Number Display */}
      {selectedNumber !== null && (
        <div className="mt-6 text-center">
          <p className="text-dark-400 text-sm mb-1">Your selection</p>
          <div className="inline-flex items-center gap-3 glass rounded-xl px-6 py-3">
            <span className="text-4xl font-bold gradient-text">{selectedNumber}</span>
            <button
              onClick={() => onClear?.()}
              className="text-dark-400 hover:text-white text-sm"
            >
              ✕ Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
