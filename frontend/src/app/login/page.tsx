/* frontend/src/app/login/page.tsx */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { User, Mail, Phone, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.auth.login({ email: email || undefined, phone: phone || undefined, password });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.data.token || data.token || '');
          toast.success('Welcome back');
          router.push('/dashboard');
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || 'Login failed');
        }
      } else {
        const res = await api.auth.register({ email, phone, password, name });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.data.token || data.token || '');
          toast.success('Account created');
          router.push('/dashboard');
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || 'Registration failed');
        }
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md glass-card p-8 md:p-12">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-slate-400 text-sm mt-2">
            {mode === 'login' ? 'Sign in to your Smart Wifi account' : 'Join the fastest hotspot billing platform'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="0712345678"
              className="w-full pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              maxLength="10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-neon-cyan disabled:opacity-50 transition-all"
          >
            {loading ? <ArrowRight className="w-5 h-5 animate-spin mr-2" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-cyan-400 font-semibold hover:text-cyan-300"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
