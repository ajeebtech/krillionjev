import type { Metadata, Viewport } from 'next';
import { VT323 } from 'next/font/google';
import './globals.css';

const pixel = VT323({ weight: '400', subsets: ['latin'], variable: '--font-pixel' });

export const metadata: Metadata = { title: 'The IPL Climb · the daily ascent', description: 'Seven prompts a day, same for everyone. Rare answers climb you higher. Obvious ones barely count.' };
export const viewport: Viewport = { themeColor: '#050a14' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={pixel.variable}><body>{children}</body></html>;
}
