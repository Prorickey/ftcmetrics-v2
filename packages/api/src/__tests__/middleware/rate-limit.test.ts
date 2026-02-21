import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { mockRedis } from '../setup';

describe('rateLimit middleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
  });

  const setupApp = async () => {
    const { rateLimit } = await import('../../middleware/auth');
    return { rateLimit };
  };

  it('allows first request', async () => {
    const { rateLimit } = await setupApp();
    app.use('*', rateLimit(5, 60000));
    app.get('/test', (c) => c.json({ ok: true }));

    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('allows request at max limit', async () => {
    const { rateLimit } = await setupApp();
    app.use('*', rateLimit(5, 60000));
    app.get('/test', (c) => c.json({ ok: true }));

    mockRedis.incr.mockResolvedValue(5);

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('returns 429 when over limit', async () => {
    const { rateLimit } = await setupApp();
    app.use('*', rateLimit(5, 60000));
    app.get('/test', (c) => c.json({ ok: true }));

    mockRedis.incr.mockResolvedValue(6);
    mockRedis.ttl.mockResolvedValue(30);

    const res = await app.request('/test');
    expect(res.status).toBe(429);
  });

  it('degrades open when Redis is unavailable', async () => {
    const { rateLimit } = await setupApp();
    app.use('*', rateLimit(5, 60000));
    app.get('/test', (c) => c.json({ ok: true }));

    mockRedis.incr.mockRejectedValue(new Error('Connection refused'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('degrades open on Redis error', async () => {
    const { rateLimit } = await setupApp();
    app.use('*', rateLimit(5, 60000));
    app.get('/test', (c) => c.json({ ok: true }));

    mockRedis.incr.mockRejectedValue(new Error('READONLY'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});
