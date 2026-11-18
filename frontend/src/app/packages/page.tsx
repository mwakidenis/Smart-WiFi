/* frontend/src/app/packages/page.tsx */
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Wifi, Smartphone, CreditCard, Clock } from 'lucide-react';

const PACKAGES = [
  { id: 'pkg_1', name: '1 Hour', dataMb: 500, durationMin: 60, price: 10, currency: 'KES', description: '1 hour unlimited for 1 device', speedMbps: 5 },
  { id: 'pkg_2', name: '12 Hours 1 Device', dataMb: 0, durationMin: 720, price: 15, currency: 'KES', description: '12 hours unlimited for 1 device', speedMbps: 10 },
  { id: 'pkg_3', name: '12 Hours 2 Devices', dataMb: 0, durationMin: 720, price: 25, currency: 'KES', description: '12 hours unlimited for 2 devices', speedMbps: 10 },
  { id: 'pkg_4', name: '24 Hours 1 Device', dataMb: 0, durationMin: 1440, price: 30, currency: 'KES', description: '24 hours unlimited for 1 device', speedMbps: 15 },
  { id: 'pkg_5', name: '2 Weeks 1 Device', dataMb: 0, durationMin: 20160, price: 450, currency: 'KES', description: '2 weeks unlimited for 1 device', speedMbps: 15 },
  { id: 'pkg_6', name: '1 Month 1 Device', dataMb: 0, durationMin: 43200, price: 750, currency: 'KES', description: '1 month unlimited for 1 device', speedMbps: 25 },
];

export default function PackagesPage() {
  const [selected, setSelected] = useState<typeof PACKAGES[number] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [stkLoading, setStkLoading] = useState(false);

  async function handleBuy(pkg: typeof PACKAGES[number]) {
    setSelected(pkg);
    setModalOpen(true);
  }

  async function confirmBuy() {
    const phoneInput = document.getElementById('modalPhone') as HTMLInputElement;
    const phone = phoneInput.value;
    if (!phone) {
      toast.error('Please enter your phone number');
      return;
    }
    setStkLoading(true);
    try {
      const res = await api.paymentApi.stkPush({
        phone,
        amount: selected!.price,
        packageId: selected!.id,
      });
      if (res.ok) {
        toast.success('STK Push sent to your phone.');
        setModalOpen(false);
        setSelected(null);
        phoneInput.value = '';
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Purchase failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setStkLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Choose a Bundle</h1>
          <p className="text-slate-400 text-sm mt-1">Instant M-Pesa checkout — connect in seconds.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {PACKAGES.map((pkg) => {
          const tierColors = ['#10b981', '#22d3ee', '#f59e0b', '#eab308', '#3b82f6', '#8b5cf6'];
          const tierColor = tierColors[PACKAGES.indexOf(pkg)] || '#22d3ee';
          return (
            <div
              key={pkg.id}
              className="rounded-3xl border border-white/10 bg-obsidian-900 p-6 hover:border-cyan-500/50 transition-all group cursor-pointer"
              style={{ borderTop: `4px solid ${tierColor}` }}
              onClick={() => handleBuy(pkg)}
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-cyan-400 mb-4 group-hover:bg-white/10 transition-colors">
                <Wifi className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
              <span className="text-2xl font-bold text-white">{pkg.currency} {pkg.price}</span>
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm text-slate-300">
                <div className="flex items-center gap-1">
                  <span className="text-white">📶</span> {pkg.dataMb} MB
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white">⏱</span> {pkg.durationMin} min
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white">⚡</span> {pkg.speedMbps} Mbps
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4">{pkg.description}</p>
              <button
                onClick={(e) => { e.stopPropagation(); handleBuy(pkg); }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-neon-cyan hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                Buy
              </button>
            </div>
          );
        })}
      </div>

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

      {/* Phone Input Modal */}
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center ${modalOpen ? '' : 'hidden'}`}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
        <div className="relative w-full max-w-md p-6 rounded-3xl bg-obsidian-950 border border-white/10 shadow-neon-violet">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">M-Pesa STK Push</h3>
            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
              <span className="w-6 h-6">✕</span>
            </button>
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Pay <span className="text-white font-mono">KES {selected?.price}</span> via M-Pesa
          </p>
          <form onSubmit={(e) => { e.preventDefault(); confirmBuy(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Phone Number</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="tel"
                  id="modalPhone"
                  value=""
                  onChange={(e) => (document.getElementById('modalPhone') as HTMLInputElement).value = e.target.value.replace(/\D/g, '')}
                  placeholder="0712345678"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  maxLength="10"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={stkLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-neon-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {stkLoading ? <Clock className="w-5 h-5 animate-spin mr-2" /> : 'Send STK Push'}
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-500 text-center">
            You will receive an STK Push on your phone. Enter your M-Pesa PIN to complete.
          </p>
        </div>
      </div>
    </div>
  );
}
