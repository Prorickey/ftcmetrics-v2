import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

describe('CORS configuration', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    // Mirror the actual CORS config from index.ts
    app.use('*', cors({
      origin: ['http://localhost:3000', process.env.CORS_ORIGIN || ''].filter(Boolean),
      credentials: true,
    }));
    app.get('/test', (c) => c.json({ ok: true }));
    app.options('/test', (c) => c.text(''));
  });

  it('returns correct header for allowed origin', async () => {
    const res = await app.request('/test', {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('does not set header for unknown origin', async () => {
    const res = await app.request('/test', {
      headers: { Origin: 'http://evil.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('does not set header when no origin present', async () => {
    const res = await app.request('/test');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('handles OPTIONS preflight with 204', async () => {
    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status).toBe(204);
  });
});
