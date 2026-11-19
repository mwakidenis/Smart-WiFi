export type RouterAdapterKind = 'mikrotik' | 'coovachilli' | 'mock';

export type RouterAuthorization = {
  macAddress: string;
  expiresAt: Date;
  speedMbps: number;
};

export interface RouterAdapter {
  authorize(input: RouterAuthorization): Promise<{ success: boolean; adapter: RouterAdapterKind }>;
  revoke(macAddress: string): Promise<{ success: boolean; adapter: RouterAdapterKind }>;
}

class MockRouterAdapter implements RouterAdapter {
  private readonly authorized = new Map<string, RouterAuthorization>();

  async authorize(input: RouterAuthorization) {
    this.authorized.set(input.macAddress, input);
    return { success: true, adapter: 'mock' as const };
  }

  async revoke(macAddress: string) {
    return { success: this.authorized.delete(macAddress), adapter: 'mock' as const };
  }
}

class HttpRouterAdapter implements RouterAdapter {
  public constructor(private readonly kind: 'coovachilli' | 'mikrotik', private readonly endpoint: string) {}

  async authorize(input: RouterAuthorization) {
    const response = await fetch(`${this.endpoint}/authorize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    return { success: response.ok, adapter: this.kind };
  }

  async revoke(macAddress: string) {
    const response = await fetch(`${this.endpoint}/revoke`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ macAddress }) });
    return { success: response.ok, adapter: this.kind };
  }
}

export function createRouterAdapter(): RouterAdapter {
  const kind = process.env.ROUTER_ADAPTER || 'mock';
  if (kind === 'coovachilli' && process.env.COOVACHILLI_ENDPOINT) return new HttpRouterAdapter('coovachilli', process.env.COOVACHILLI_ENDPOINT);
  if (kind === 'mikrotik' && process.env.MIKROTIK_ADAPTER_ENDPOINT) return new HttpRouterAdapter('mikrotik', process.env.MIKROTIK_ADAPTER_ENDPOINT);
  return new MockRouterAdapter();
}
