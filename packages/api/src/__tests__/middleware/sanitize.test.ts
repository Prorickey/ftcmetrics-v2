import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('sanitizeInput middleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
  });

  const setupApp = async () => {
    const { sanitizeInput } = await import('../../middleware/auth');
    return { sanitizeInput };
  };

  it('strips null bytes from strings', async () => {
    const { sanitizeInput } = await setupApp();
    app.use('*', sanitizeInput);
    app.post('/test', (c) => {
      const body = (c as any).get('sanitizedBody');
      return c.json(body);
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'hello\0world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('helloworld');
  });

  it('trims whitespace from strings', async () => {
    const { sanitizeInput } = await setupApp();
    app.use('*', sanitizeInput);
    app.post('/test', (c) => {
      const body = (c as any).get('sanitizedBody');
      return c.json(body);
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  hello  ' }),
    });
    const body = await res.json();
    expect(body.name).toBe('hello');
  });

  it('removes __proto__, constructor, and prototype keys', async () => {
    const { sanitizeInput } = await setupApp();
    app.use('*', sanitizeInput);
    app.post('/test', (c) => {
      const body = (c as any).get('sanitizedBody');
      // Check keys directly since JSON serialization may add __proto__ back as {}
      const keys = Object.keys(body);
      return c.json({ keys });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'valid', '__proto__': { admin: true }, 'constructor': 'bad' }),
    });
    const body = await res.json();
    expect(body.keys).toEqual(['name']);
  });

  it('passes through non-JSON content types', async () => {
    const { sanitizeInput } = await setupApp();
    app.use('*', sanitizeInput);
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid JSON', async () => {
    const { sanitizeInput } = await setupApp();
    app.use('*', sanitizeInput);
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    expect(res.status).toBe(400);
  });
});
