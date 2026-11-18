/* frontend/src/app/dashboard/page.tsx */
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Wallet, Smartphone, Wifi, Clock, Activity, Cpu, Memory, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [routerHealth, setRouterHealth] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await api.auth.me();
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      toast.error('Session expired');
    } finally {
      setLoading(false);
    }
  }

  async function loadRouterHealth() {
    try {
      const res = await api.admin.routerHealth();
      if (res.ok) {
        const data = await res.json();
        setRouterHealth(data.routerHealth);
      }
    } catch {
      // Admin only endpoint, may fail for non-admin
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
            <Smartphone className="w-5 h-5 text-violet-400" />
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

      {routerHealth && (
        <div className="mt-8 glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Router Health</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">CPU Load</div>
              <div className="text-lg font-bold text-white">{Math.round(Number(routerHealth.resource?.cpuLoad || 0))}%</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Memory</div>
              <div className="text-lg font-bold text-white">
                {Math.round(Number(routerHealth.resource?.totalMemory || 0) / 1024 / 1024)} MB
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Uptime</div>
              <div className="text-lg font-bold text-white">
                {Math.round(Number(routerHealth.resource?.uptime || 0) / 60)} min
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
