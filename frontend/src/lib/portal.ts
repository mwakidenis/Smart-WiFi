export type PortalIdentity = {
  macAddress: string | null;
  ipAddress: string | null;
  loginUrl: string | null;
  chapId: string | null;
};

const identityKeys = {
  macAddress: 'smart-wifi-mac',
  ipAddress: 'smart-wifi-ip',
  loginUrl: 'smart-wifi-login-url',
  chapId: 'smart-wifi-chap-id',
} as const;

function clean(value: string | null): string | null {
  return value?.trim() || null;
}

export function detectPortalIdentity(search = typeof window !== 'undefined' ? window.location.search : ''): PortalIdentity {
  const params = new URLSearchParams(search);
  const detected: PortalIdentity = {
    macAddress: clean(params.get('mac') || params.get('macAddress')),
    ipAddress: clean(params.get('ip') || params.get('ipAddress')),
    loginUrl: clean(params.get('link-login') || params.get('link_login') || params.get('login')),
    chapId: clean(params.get('chap-id') || params.get('chap_id')),
  };

  if (typeof window === 'undefined') return detected;

  const stored: PortalIdentity = {
    macAddress: localStorage.getItem(identityKeys.macAddress),
    ipAddress: localStorage.getItem(identityKeys.ipAddress),
    loginUrl: localStorage.getItem(identityKeys.loginUrl),
    chapId: localStorage.getItem(identityKeys.chapId),
  };
  const identity = {
    macAddress: detected.macAddress || stored.macAddress,
    ipAddress: detected.ipAddress || stored.ipAddress,
    loginUrl: detected.loginUrl || stored.loginUrl,
    chapId: detected.chapId || stored.chapId,
  };

  for (const [key, value] of Object.entries(identity)) {
    if (value) {
      localStorage.setItem(identityKeys[key as keyof typeof identityKeys], value);
      document.cookie = `${identityKeys[key as keyof typeof identityKeys]}=${encodeURIComponent(value)}; Max-Age=86400; Path=/; SameSite=Lax`;
    }
  }
  return identity;
}

export function formatMacAddress(value: string): string | null {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').slice(0, 12);
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)?.join(':').toUpperCase() || null;
}
