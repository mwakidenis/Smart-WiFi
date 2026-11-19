/* frontend/src/app/layout.tsx */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Smart Wifi | M-Pesa Hotspot Billing',
  description: 'Instant M-Pesa Wi-Fi hotspot billing and ISP management for Kenyan operators.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      <html lang="en" className="h-full">
        <body className={`${inter.variable} h-full bg-[#0a0a0c] text-slate-200 antialiased`}>
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0c]/80 backdrop-blur-md py-4 px-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-neon-cyan">
                  <WifiIcon />
                </div>
                <span className="font-bold text-xl tracking-tight" aria-label="SmartWifi">
                  <span style={{ color: '#a7adb5' }}>S</span>
                  <span style={{ color: '#94a3b8' }}>m</span>
                  <span style={{ color: '#b8bdc5' }}>a</span>
                  <span style={{ color: '#8993a1' }}>r</span>
                  <span style={{ color: '#aab0b8' }}>t</span>
                  <span style={{ color: '#8d96a3' }}>W</span>
                  <span style={{ color: '#b1b5bc' }}>i</span>
                  <span style={{ color: '#969fa9' }}>f</span>
                  <span style={{ color: '#afb4bb' }}>i</span>
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-6 text-sm">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-slate-300 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <ThemeToggleButton />
                <NavButton href="/login" label="Get Connected" />
              </div>
            </div>
          </header>

          <main className="min-h-full">{children}</main>

          <footer className="border-t border-white/10 bg-[#0a0a0c] py-8 mt-auto">
            <div className="px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
              <span>
                Smart Wifi &copy; 2026 mwakidenis. All rights reserved.
              </span>
              <div className="flex gap-4">
                <span className="hover:text-white cursor-pointer">Privacy</span>
                <span className="hover:text-white cursor-pointer">Terms</span>
                <span className="hover:text-white cursor-pointer">Support</span>
              </div>
            </div>
          </footer>
        </body>
      </html>
    </NextThemesProvider>
  );
}

function WifiIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2v-6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2m-2-2h6" />
    </svg>
  );
}

function ThemeToggleButton() {
  return (
    <button
      onClick={() => {}}
      className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors"
      aria-label="Toggle theme"
    >
      <span className="w-5 h-5">🌙</span>
    </button>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold shadow-neon-cyan hover:from-cyan-400 hover:to-blue-500 transition-all"
    >
      {label}
    </Link>
  );
}

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Packages', href: '/packages' },
  { name: 'About', href: '/about' },
  { name: 'Dashboard', href: '/dashboard' },
];

import Link from 'next/link';
