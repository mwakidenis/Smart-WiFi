'use client';

import { Wifi } from 'lucide-react';

type PackageGridItem = { id: string; name: string; dataLimitMB: number | null; durationMin: number; price: number; currency: string; description?: string; speedMbps: number };

type PackageGridProps = { packages: PackageGridItem[]; onSelect: (packageItem: PackageGridItem) => void };

export function PackageGrid({ packages, onSelect }: PackageGridProps) {
  return <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-4">{packages.map((packageItem, index) => <article key={packageItem.id} className="group rounded-2xl border border-white/10 bg-[#0A0F14] p-5 transition hover:-translate-y-1 hover:border-cyan-300/50" style={{ borderTopColor: ['#00F0FF', '#00FF66', '#CCFF00', '#FFE600'][index % 4], borderTopWidth: 3 }}><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-cyan-300"><Wifi className="h-5 w-5" /></div><h3 className="text-lg font-bold text-white">{packageItem.name}</h3><p className="mt-1 text-2xl font-bold text-white">{packageItem.currency} {packageItem.price}</p><div className="mt-4 space-y-2 text-sm text-slate-400"><div><span className="mr-2 text-cyan-300">∞</span>{packageItem.dataLimitMB === null ? 'Unlimited Data' : `${packageItem.dataLimitMB} MB`}</div><div><span className="mr-2 text-[#FFE600]">◷</span>{packageItem.durationMin} min</div><div><span className="mr-2 text-[#CCFF00]">⚡</span>{packageItem.speedMbps} Mbps</div></div><p className="mt-4 min-h-10 text-xs text-slate-500">{packageItem.description}</p><button type="button" onClick={() => onSelect(packageItem)} className="mt-4 w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold uppercase tracking-wide text-black transition hover:bg-white">Buy package</button></article>)}</div>;
}
