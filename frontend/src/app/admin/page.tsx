/* frontend/src/app/admin/page.tsx */
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Shield, Users, CreditCard, Wifi, Cpu, Memory, Activity } from 'lucide-react';

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [routerHealth, setRouterHealth] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await api.auth.me();
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.user.role !== 'ADMIN') {
          toast.error('Admin access required');
        }
      }
    } catch {
      toast.error('Session expired');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminData() {
    try {
      const [healthRes, sessionsRes, revenueRes] = await Promise.all([
        api.admin.routerHealth(),
        api.admin.sessions(),
        api.admin.revenue(),
      ]);
      if (healthRes.ok) setRouterHealth(await healthRes.json());
      if (sessionsRes.ok) setSessions((await sessionsRes.json()).sessions || []);
      if (revenueRes.ok) setRevenue(await revenueRes.json());
    } catch (err) {
      toast.error('Failed to load admin data');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <Shield className="w-16 h-16 text-slate-700 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Admin Access Required</h1>
        <p className="text-slate-400 mb-6">You do not have permission to access the ISP Control Center.</p>
        <a href="/" className="text-cyan-400 hover:text-cyan-300">Return to Home</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">ISP Control Center</h1>
          <p className="text-slate-400 text-sm">Router health, sessions, and revenue analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase">Logged in as {user.email}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Router Health</h3>
            <Wifi className="w-5 h-5 text-slate-500" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">CPU Load</div>
              <div className="text-lg font-bold text-white">
                {routerHealth?.resource ? Math.round(Number(routerHealth.resource.cpuLoad || 0)) : '--'}%
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Memory</div>
              <div className="text-lg font-bold text-white">
                {routerHealth?.resource ? `${Math.round(Number(routerHealth.resource.totalMemory || 0) / 1024 / 1024)} MB` : '--'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Uptime</div>
              <div className="text-lg font-bold text-white">
                {routerHealth?.resource ? `${Math.round(Number(routerHealth.resource.uptime || 0) / 60)} min` : '--'}
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Active Sessions</h3>
            <span className="text-xs font-semibold text-cyan-400 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              {sessions.length} active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="text-left pb-2">User</th>
                  <th className="text-left pb-2">IP Address</th>
                  <th className="text-left pb-2">MAC</th>
                  <th className="text-left pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">No active sessions.</td></tr>
                ) : (
                  sessions.map((s: any) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/3">
                      <td className="py-3 text-white">{s.user?.name || s.user?.email || 'Unknown'}</td>
                      <td className="py-3 text-slate-300 font-mono">{s.ipAddress || '--'}</td>
                      <td className="py-3 text-slate-300 font-mono">{s.macAddress || '--'}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Revenue</h3>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 mb-4">
            <span className="text-slate-400">Total Revenue</span>
            <span className="text-white font-mono">KES {revenue?.total?.toLocaleString() ?? '0'}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-300 space-y-1">
            <div>
              <span className="font-mono">24h:</span>
              <span className="text-white font-mono ml-2">KES {revenue?.day24h?.toLocaleString() ?? '0'}</span>
            </div>
            <div>
              <span className="font-mono">30d:</span>
              <span className="text-white font-mono ml-2">KES {revenue?.month30d?.toLocaleString() ?? '0'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
