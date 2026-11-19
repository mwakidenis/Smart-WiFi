/* frontend/src/app/dashboard/page.tsx */
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Wallet, Smartphone, Wifi } from 'lucide-react';
import { NetworkStatusHero } from '@/components/NetworkStatusHero';
import { SessionRestoreModal } from '@/components/SessionRestoreModal';
import { usePortalSession } from '@/hooks/usePortalSession';

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; phone: string; balance?: number; creditUsed?: number; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { status, setManualMac } = usePortalSession();
  const [manualMac, setManualMacInput] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await api.auth.me();
      setUser(res.data.user);
    } catch {
      toast.error('Session expired');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <p>Not authenticated. <a href="/login" className="text-cyan-400">Login</a></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <NetworkStatusHero {...status} />
      <button type="button" onClick={() => setRestoreOpen(true)} className="mt-4 rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-300/10">Restore session</button>
      {status.state === 'DISCONNECTED' && (
        <form className="mt-6 flex max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); setManualMac(manualMac); }}>
          <input value={manualMac} onChange={(event) => setManualMacInput(event.target.value)} placeholder="Device MAC (AA:BB:CC:DD:EE:FF)" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-300" />
          <button type="submit" className="rounded-xl bg-cyan-400 px-4 py-3 font-bold text-black">Reconnect</button>
        </form>
      )}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Welcome back, {user.name}</p>
        </div>
        <div className="flex items-center gap-3">
              <div className="glass-card px-4 py-3">
            <div className="text-xs text-slate-400">Balance</div>
            <div className="text-lg font-bold text-white">KES {Number(user.balance || 0).toLocaleString()}</div>
          </div>
          <div className="glass-card px-4 py-3">
            <div className="text-xs text-slate-400">Credit Used</div>
            <div className="text-lg font-bold text-white">KES {Number(user.creditUsed || 0).toLocaleString()}</div>
          </div>
        </div>
      </header>

      <SessionRestoreModal open={restoreOpen} macAddress={status.macAddress} onClose={() => setRestoreOpen(false)} />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Account Balance</h3>
          </div>
          <div className="text-3xl font-bold text-white">KES {Number(user.balance || 0).toLocaleString()}</div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="w-5 h-5 text-cyan-300" />
            <h3 className="text-lg font-bold text-white">Phone</h3>
          </div>
          <div className="text-xl font-mono text-white">{user.phone}</div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wifi className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Role</h3>
          </div>
          <div className="text-sm text-slate-300 capitalize">{user.role}</div>
        </div>
      </div>

    </div>
  );
}
