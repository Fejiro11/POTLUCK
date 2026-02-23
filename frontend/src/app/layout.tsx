import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FHE Lottery | Private Onchain Lottery',
  description: 'A private-by-default lottery using Zama\'s fully homomorphic encryption. All guesses remain encrypted until settlement.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-dark-950 text-white min-h-screen`}>
        {/* Load Zama Relayer SDK from CDN - beforeInteractive ensures it loads early */}
        <Script 
          src="https://cdn.zama.org/relayer-sdk-js/0.3.0-8/relayer-sdk-js.umd.cjs"
          strategy="afterInteractive"
          id="zama-relayer-sdk"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
