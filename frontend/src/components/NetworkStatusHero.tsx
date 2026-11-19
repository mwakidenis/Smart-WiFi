'use client';

import { useEffect, useState } from 'react';
import { Activity, Gauge, Radio, Smartphone, Wifi } from 'lucide-react';
import type { ConnectionState } from '@/hooks/usePortalSession';

type NetworkStatusHeroProps = {
  state: ConnectionState;
  expiresAt: string | null;
  serverTime: string;
  speedMbps: number;
  activeDevices: number;
  maxDevices: number;
  macAddress: string | null;
};

function formatRemaining(expiresAt: string | null, serverTime: string, now: number): string {
  if (!expiresAt) return '--:--:--';
  const serverOffset = new Date(serverTime).getTime() - Date.now();
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - (now + serverOffset)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
}

export function NetworkStatusHero(props: NetworkStatusHeroProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const online = props.state === 'ONLINE';
  const remaining = formatRemaining(props.expiresAt, props.serverTime, now);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0A0F14] p-6 shadow-[0_0_35px_rgba(0,240,255,0.12)]">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.12),transparent_65%)]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-[#00FF66] shadow-[0_0_12px_#00FF66]' : 'bg-[#FF5500]'}`} />
            Network Status
          </div>
          <div className="flex items-center gap-3">
            <Wifi className="h-7 w-7 text-cyan-300" />
            <h2 className="text-2xl font-bold text-white">{props.state.replace('_', ' ')}</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">{online ? 'Your high-speed session is active.' : 'Connect a device to begin a session.'}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-cyan-300/20">
            <svg className={`absolute inset-0 h-full w-full -rotate-90 ${online ? 'animate-spin' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,240,255,0.12)" strokeWidth="4" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="#00F0FF" strokeWidth="4" strokeLinecap="round" strokeDasharray="276" strokeDashoffset={online ? '35' : '210'} />
            </svg>
            <div className="text-center"><div className="font-mono text-xl font-bold text-white">{remaining}</div><div className="text-[10px] uppercase text-slate-500">remaining</div></div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><Gauge className="mr-1 inline h-4 w-4 text-[#CCFF00]" />{props.speedMbps || 0} Mbps</div>
            <div><Smartphone className="mr-1 inline h-4 w-4 text-cyan-300" />{props.activeDevices}/{props.maxDevices}</div>
            <div className="col-span-2 truncate font-mono text-xs text-slate-500"><Radio className="mr-1 inline h-4 w-4 text-[#00FF66]" />{props.macAddress || 'MAC pending'}</div>
            <div className="col-span-2 text-xs text-slate-500"><Activity className="mr-1 inline h-4 w-4 text-[#00FF66]" />heartbeat {online ? 'live' : 'waiting'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
