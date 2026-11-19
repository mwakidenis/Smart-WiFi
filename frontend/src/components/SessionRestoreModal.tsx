'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMacAddress } from '@/lib/portal';

type SessionRestoreModalProps = { open: boolean; macAddress: string | null; onClose: () => void; onRestored?: () => void };

export function SessionRestoreModal({ open, macAddress, onClose, onRestored }: SessionRestoreModalProps) {
  const [phone, setPhone] = useState('');
  const [receipt, setReceipt] = useState('');
  const [manualMac, setManualMac] = useState(macAddress || '');
  const [message, setMessage] = useState('');

  if (!open) return null;
  async function restore() {
    const normalizedMac = formatMacAddress(manualMac);
    if (!normalizedMac || (!phone.trim() && !receipt.trim())) {
      setMessage('Enter a valid MAC and either your phone number or M-Pesa receipt.');
      return;
    }
    try {
      await api.sessionApi.restore({ phone: phone.trim() || undefined, mpesaReceiptNumber: receipt.trim() || undefined, macAddress: normalizedMac });
      localStorage.setItem('smart-wifi-mac', normalizedMac);
      setMessage('Session restored. Reconnecting this device now.');
      onRestored?.();
    } catch {
      setMessage('No active package matched those details.');
    }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"><motion.div className="w-full max-w-lg rounded-t-2xl border border-cyan-300/20 bg-[#0A0F14] p-6 md:rounded-2xl" initial={{ y: 80 }} animate={{ y: 0 }}><div className="mb-6 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Session recovery</p><h2 className="mt-1 text-xl font-bold text-white">Restore connection</h2></div><button onClick={onClose} aria-label="Close recovery" className="p-2 text-slate-400"><X /></button></div><div className="space-y-4"><input value={manualMac} onChange={(event) => setManualMac(event.target.value)} placeholder="Device MAC" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white outline-none focus:border-cyan-300" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300" /><div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500"><span className="h-px flex-1 bg-white/10" />or receipt code<span className="h-px flex-1 bg-white/10" /></div><input value={receipt} onChange={(event) => setReceipt(event.target.value.toUpperCase())} placeholder="M-Pesa receipt, e.g. QWE123ABC" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white outline-none focus:border-cyan-300" /><button onClick={() => void restore()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-bold text-black"><RotateCcw className="h-4 w-4" />Restore and reconnect</button>{message && <p className="text-sm text-slate-300">{message}</p>}</div></motion.div></div>;
}
