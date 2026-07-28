const base = process.env.REAL_QA_API_URL || 'http://127.0.0.1:4100';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const health = await request('/health');
if (!health || health.ok !== true) throw new Error('Health endpoint did not return ok=true');

const session = await request('/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'demo@lousa.app', password: 'Lousa2026' }),
});
const accessToken = session?.accessToken || session?.tokens?.accessToken;
if (!accessToken) throw new Error('Legacy QA login did not return an access token');

const headers = { authorization: `Bearer ${accessToken}` };
const profile = await request('/v1/profile', { headers });
if (!profile?.user?.id && !profile?.id) throw new Error('Authenticated profile response is missing user id');

const catalog = await request('/v1/catalog', { headers });
if (!Array.isArray(catalog?.products || catalog?.items)) throw new Error('Catalog response is missing products/items');

console.log('real QA HTTP smoke PASS — health, session, profile and catalog');
