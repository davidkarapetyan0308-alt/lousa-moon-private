export class LousaApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) {
    super(message);
  }
}

type ApiClientOptions = { baseUrl: string; getToken?: () => string | null | undefined };

export class LousaApiClient {
  constructor(private options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    const token = this.options.getToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${this.options.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = payload?.error || {};
      throw new LousaApiError(res.status, error.code || 'API_ERROR', error.message || 'Ошибка API', error.requestId);
    }
    return payload as T;
  }
}
