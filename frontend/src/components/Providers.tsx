'use client';

import { ReactNode } from 'react';
import { FhevmProvider } from '@/fhevm';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <FhevmProvider autoInitialize={false}>
      {children}
    </FhevmProvider>
  );
}
