'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Smartphone, X } from 'lucide-react';
import { api } from '@/lib/api';
import { displayKenyanPhone, isSafaricomPhone, normalizeKenyanPhone } from '@/lib/phone';

type CheckoutPackage = { id: string; name: string; price: number };
type PaymentStep = 'phone' | 'prompt' | 'confirmed' | 'failed';

type MpesaCheckoutModalProps = {
  package: CheckoutPackage | null;
  onClose: () => void;
  onConfirmed?: () => void;
};

export function MpesaCheckoutModal({ package: selectedPackage, onClose, onConfirmed }: MpesaCheckoutModalProps) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<PaymentStep>('phone');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [message, setMessage] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPackage) return;
    setPhone(localStorage.getItem('smart-wifi-phone') || '');
    setStep('phone');
    setSecondsLeft(60);
    setMessage('');
    setCheckoutRequestId(null);
  }, [selectedPackage]);

  useEffect(() => {
    if (step !== 'prompt' || !checkoutRequestId) return;
    const timer = window.setInterval(async () => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      try {
        const response = await api.get(`/mpesa/status/${checkoutRequestId}`);
        if (response.data.status === 'COMPLETED') {
          setStep('confirmed');
          onConfirmed?.();
        } else if (response.data.status === 'FAILED' || response.data.status === 'REVERSED') {
          setStep('failed');
          setMessage('The payment was not completed.');
        }
      } catch {
        setMessage('Still waiting for the payment response.');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [checkoutRequestId, onConfirmed, step]);

  async function sendPrompt() {
    if (!selectedPackage) return;
    const normalized = normalizeKenyanPhone(phone);
    if (!normalized || !isSafaricomPhone(phone)) {
      setMessage('Enter a valid Safaricom number, for example 0712 345 678.');
      return;
    }
    setMessage('');
    localStorage.setItem('smart-wifi-phone', normalized);
    try {
      const response = await api.paymentApi.stkPush({ phone: normalized, amount: selectedPackage.price, packageId: selectedPackage.id });
      setCheckoutRequestId(response.data.checkoutRequestID);
      setSecondsLeft(60);
      setStep('prompt');
    } catch {
      setStep('failed');
      setMessage('Unable to send the M-Pesa prompt. Please try again.');
    }
  }

  if (!selectedPackage) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="w-full max-w-lg rounded-t-2xl border border-cyan-300/20 bg-[#0A0F14] p-6 shadow-[0_0_40px_rgba(0,240,255,0.16)] md:rounded-2xl" initial={{ y: 80 }} animate={{ y: 0 }}>
          <div className="mb-6 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-300">M-Pesa checkout</p><h2 className="mt-1 text-xl font-bold text-white">{selectedPackage.name}</h2></div><button onClick={onClose} aria-label="Close checkout" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X /></button></div>
          {step === 'phone' && <div className="space-y-5"><p className="text-slate-400">Pay <strong className="text-white">KES {selectedPackage.price}</strong> and get connected instantly.</p><label className="block text-sm text-slate-300">Safaricom phone number<div className="relative mt-2"><Smartphone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" /><input autoFocus value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0712 345 678" className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-white outline-none focus:border-cyan-300" /></div></label><button onClick={() => void sendPrompt()} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-black hover:bg-white">Send M-Pesa Prompt</button></div>}
          {step === 'prompt' && <div className="space-y-5 text-center"><Smartphone className="mx-auto h-12 w-12 animate-pulse text-cyan-300" /><h3 className="text-lg font-bold text-white">Check {displayKenyanPhone(phone)} and enter your M-Pesa PIN</h3><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#FFE600] transition-all" style={{ width: `${(secondsLeft / 60) * 100}%` }} /></div><p className="font-mono text-2xl text-[#FFE600]">00:{String(secondsLeft).padStart(2, '0')}</p><button onClick={() => { setStep('phone'); setMessage(''); }} className="text-sm text-cyan-300 underline">Did not get the prompt? Retry</button></div>}
          {step === 'confirmed' && <div className="space-y-4 py-6 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-[#00FF66]" /><h3 className="text-xl font-bold text-white">Payment confirmed</h3><p className="text-slate-400">Unlocking high-speed internet now.</p><button onClick={onClose} className="w-full rounded-xl bg-[#00FF66] px-4 py-3 font-bold text-black">Continue</button></div>}
          {step === 'failed' && <div className="space-y-4"><p className="text-[#FF5500]">{message}</p><button onClick={() => setStep('phone')} className="w-full rounded-xl border border-cyan-300/40 px-4 py-3 font-bold text-cyan-300">Retry payment</button><p className="text-center text-xs text-slate-500">You can also restore a completed purchase with its M-Pesa receipt code.</p></div>}
          {message && step === 'phone' && <p className="mt-3 text-sm text-[#FF5500]">{message}</p>}
          {step === 'prompt' && <Loader2 className="mx-auto mt-5 h-4 w-4 animate-spin text-slate-500" />}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
