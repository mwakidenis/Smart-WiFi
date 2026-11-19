// frontend/src/store/useStore.ts
// Zustand state management for Smart Wifi
// Follows the Comprehensive System Prompt & Engineering Specification

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
  balance: number;
  creditLimit: number;
  creditUsed: number;
  isActive: boolean;
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  dataLimitMB: number | null;
  durationMin: number;
  speedMbps: number;
  price: number;
  currency: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  packageId?: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  mpesaReceipt?: string;
  checkoutRequestId?: string;
  phone?: string;
  description?: string;
  provisioned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  interestRate: number;
  dueAt?: string;
  repaidAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  logout: () => void;
}

interface PackageState {
  packages: Package[];
  isLoading: boolean;
  error: string | null;
  setPackages: (packages: Package[]) => void;
  fetchPackages: () => Promise<void>;
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  setTransactions: (transactions: Transaction[]) => void;
}

interface LoanState {
  loans: Loan[];
  isLoading: boolean;
  setLoans: (loans: Loan[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('token');
        }
      },
    }),
    {
      name: 'smart-wifi-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const usePackageStore = create<PackageState>((set) => ({
  packages: [],
  isLoading: false,
  error: null,
  setPackages: (packages) => set({ packages, isLoading: false }),
  fetchPackages: async () => {
    set({ isLoading: true, error: null });
    try {
      const { api } = await import('@/lib/api');
      const res = await api.packageApi.list();
      set({ packages: res.data.packages || [], isLoading: false });
    } catch (err: unknown) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load packages' });
    }
  },
}));

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,
  setTransactions: (transactions) => set({ transactions, isLoading: false }),
}));

export const useLoanStore = create<LoanState>((set) => ({
  loans: [],
  isLoading: false,
  setLoans: (loans) => set({ loans, isLoading: false }),
}));
