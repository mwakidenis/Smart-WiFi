'use client';

import { useEffect, useState } from 'react';
import { detectPortalIdentity, formatMacAddress, type PortalIdentity } from '@/lib/portal';
import { api } from '@/lib/api';

export type ConnectionState = 'DETECTING' | 'DISCONNECTED' | 'AUTHORIZING' | 'ONLINE' | 'EXPIRED';

type SessionStatus = {
  state: ConnectionState;
  expiresAt: string | null;
  serverTime: string;
  speedMbps: number;
  activeDevices: number;
  maxDevices: number;
  macAddress: string | null;
  ipAddress: string | null;
};

const emptyStatus: SessionStatus = {
  state: 'DETECTING', expiresAt: null, serverTime: new Date().toISOString(),
  speedMbps: 0, activeDevices: 0, maxDevices: 1, macAddress: null, ipAddress: null,
};

export function usePortalSession(): { identity: PortalIdentity; status: SessionStatus; setManualMac: (value: string) => void } {
  const [identity, setIdentity] = useState<PortalIdentity>({ macAddress: null, ipAddress: null, loginUrl: null, chapId: null });
  const [status, setStatus] = useState<SessionStatus>(emptyStatus);

  useEffect(() => {
    const detected = detectPortalIdentity();
    setIdentity(detected);
    const mac = detected.macAddress ? formatMacAddress(detected.macAddress) : null;
    if (!mac) {
      setStatus({ ...emptyStatus, state: 'DISCONNECTED', serverTime: new Date().toISOString(), ipAddress: detected.ipAddress });
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await api.sessionApi.status({ macAddress: mac, ipAddress: detected.ipAddress });
        if (!cancelled) setStatus(response.data);
      } catch {
        if (!cancelled) setStatus((current) => ({ ...current, state: 'DISCONNECTED', macAddress: mac, ipAddress: detected.ipAddress }));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const setManualMac = (value: string) => {
    const macAddress = formatMacAddress(value);
    if (!macAddress) return;
    localStorage.setItem('smart-wifi-mac', macAddress);
    document.cookie = `smart-wifi-mac=${encodeURIComponent(macAddress)}; Max-Age=86400; Path=/; SameSite=Lax`;
    setIdentity((current) => ({ ...current, macAddress }));
    setStatus((current) => ({ ...current, state: 'AUTHORIZING', macAddress }));
  };

  return { identity, status, setManualMac };
}
