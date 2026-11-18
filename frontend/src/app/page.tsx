/* frontend/src/app/page.tsx */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wifi, Smartphone, CreditCard, Shield, Zap, Clock, Activity, Cpu, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cms } from '@/lib/contentManager';
import { usePackageStore } from '@/store/useStore';

const PACKAGES = [
  { id: 'pkg_1', name: '1 Hour', dataMb: 500, durationMin: 60, price: 10, currency: 'KES', description: '1 hour unlimited for 1 device', speedMbps: 5 },
  { id: 'pkg_2', name: '12 Hours 1 Device', dataMb: 0, durationMin: 720, price: 15, currency: 'KES', description: '12 hours unlimited for 1 device', speedMbps: 10 },
  { id: 'pkg_3', name: '12 Hours 2 Devices', dataMb: 0, durationMin: 720, price: 25, currency: 'KES', description: '12 hours unlimited for 2 devices', speedMbps: 10 },
  { id: 'pkg_4', name: '24 Hours 1 Device', dataMb: 0, durationMin: 1440, price: 30, currency: 'KES', description: '24 hours unlimited for 1 device', speedMbps: 15 },
  { id: 'pkg_5', name: '2 Weeks 1 Device', dataMb: 0, durationMin: 20160, price: 450, currency: 'KES', description: '2 weeks unlimited for 1 device', speedMbps: 15 },
  { id: 'pkg_6', name: '1 Month 1 Device', dataMb: 0, durationMin: 43200, price: 750, currency: 'KES', description: '1 month unlimited for 1 device', speedMbps: 25 },
];

export default function PackagesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { packages, setPackages, isLoading: storeLoading, error: storeError } = usePackageStore((s) => ({
    packages: s.packages,
    setPackages: s.setPackages,
    isLoading: s.isLoading,
    error: s.error,
  }));

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        // Try API first
        const res = await api.packageApi.list();
        if (mounted) {
          setPackages(res.data.packages || PACKAGES);
          setIsLoading(false);
        }
      } catch (err) {
        // Fallback to hardcoded packages
        if (mounted) {
          setPackages(PACKAGES);
          setIsLoading(false);
          setError('Using fallback packages');
        }
      }
    }
    init();
    return () => { mounted = false; };
  }, [setPackages]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400">Loading packages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white text-balance mb-1">
            Choose a Bundle<span className="text-cyan-400">.</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Instant M-Pesa checkout — connect in seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadPackages()}
            className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white transition-all"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {packages.map((pkg) => {
          const tierColors = ['#10b981', '#22d3ee', '#f59e0b', '#eab308', '#3b82f6', '#8b5cf6'];
          const tierColor = tierColors[i] || '#22d3ee';
          return (
            <div
              key={pkg.id}
              className="pkg-card cursor-pointer group"
              style={{ borderTop: `4px solid ${tierColor}` }}
              onClick={() => window.open(`/packages/${pkg.id}`, '_self')}
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-cyan-400 mb-4 group-hover:bg-white/10 transition-colors">
                <Wifi className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
              <span className="text-2xl font-bold text-white mb-2 block">{pkg.currency} {pkg.price}</span>
              <div className="space-y-1 text-sm text-slate-400 mb-4">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-white">📶</span> {pkg.dataMb} MB
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-white">⏱</span> {pkg.durationMin} min
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-white">⚡</span> {pkg.speedMbps} Mbps
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4">{pkg.description}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/packages/${pkg.id}`, '_self');
                }}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-neon-cyan hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                Buy
              </button>
            </div>
          );
        })}
      </div>

      {/* Network Status Info */}
      <div className="mt-12 border-t border-white/5 pt-8 grid md:grid-cols-3 gap-8 text-center">
        {[Wifi, Smartphone, CreditCard].map((Icon) => (
          <div key={Icon.name} className="glass-card p-6">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-cyan-400 mx-auto mb-3">
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-400">
              {Icon.name === 'Wifi' ? 'High-speed hotspots' : Icon.name === 'Smartphone' ? 'M-Pesa ready' : 'Secure payments'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
