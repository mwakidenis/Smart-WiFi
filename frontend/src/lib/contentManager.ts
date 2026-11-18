// frontend/src/lib/contentManager.ts
// AJAX content manager for Smart Wifi
// Follows the Comprehensive System Prompt & Engineering Specification:
// Async/await, caching, retries, AbortController timeout handling

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
}

export class ContentManager {
  private baseUrl: string;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheTTL: number;
  private retryAttempts: number;
  private retryDelay: number;
  private eventListeners: Map<string, Array<(data: any) => void>> = new Map();

  constructor(baseUrl: string, options?: { cacheTTL?: number; retryAttempts?: number; retryDelay?: number }) {
    this.baseUrl = baseUrl;
    this.cacheTTL = options?.cacheTTL ?? 30000;
    this.retryAttempts = options?.retryAttempts ?? 3;
    this.retryDelay = options?.retryDelay ?? 1000;
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const cacheKey = `${options.method || 'GET'}:${endpoint}`;
    const now = Date.now();

    // Return cached data if fresh (GET only)
    if ((!options.method || options.method === 'GET') && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (now - cached.timestamp < this.cacheTTL) {
        this.dispatch('contentLoaded', { endpoint, data: cached.data });
        return cached.data;
      }
    }

    let lastError: any;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Cache GET responses
        if (!options.method || options.method === 'GET') {
          this.cache.set(cacheKey, { data, timestamp: now });
        }

        this.dispatch('contentLoaded', { endpoint, data });
        return data;
      } catch (err: any) {
        lastError = err;
        if (attempt < this.retryAttempts && err.name !== 'AbortError') {
          await new Promise((r) => setTimeout(r, this.retryDelay * attempt));
        }
      }
    }

    this.dispatch('contentError', { endpoint, error: lastError.message });
    throw lastError;
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, body: any): Promise<T> {
    this.cache.delete(endpoint);
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: (data: any) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.set(
        event,
        this.eventListeners.get(event)!.filter((l) => l !== listener)
      );
    }
  }

  private dispatch(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach((l) => l(data));
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const cms = new ContentManager('/api', {
  cacheTTL: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
});
