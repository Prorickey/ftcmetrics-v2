import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { mockPrisma } from '../setup';

describe('authMiddleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
  });

  const setupApp = async () => {
    const { authMiddleware, optionalAuthMiddleware, requireTeamMembership } = await import('../../middleware/auth');
    return { authMiddleware, optionalAuthMiddleware, requireTeamMembership };
  };

  describe('authMiddleware', () => {
    it('returns 401 when no cookie is present', async () => {
      const { authMiddleware } = await setupApp();
      app.use('*', authMiddleware);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid session token', async () => {
      const { authMiddleware } = await setupApp();
      app.use('*', authMiddleware);
      app.get('/test', (c) => c.json({ ok: true }));

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const res = await app.request('/test', {
        headers: { Cookie: 'authjs.session-token=invalid-token' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 for expired session', async () => {
      const { authMiddleware } = await setupApp();
      app.use('*', authMiddleware);
      app.get('/test', (c) => c.json({ ok: true }));

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2020-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });

      const res = await app.request('/test', {
        headers: { Cookie: 'authjs.session-token=expired-token' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 200 and sets userId for valid session', async () => {
      const { authMiddleware } = await setupApp();
      app.use('*', authMiddleware);
      app.get('/test', (c) => {
        return c.json({ userId: c.get('userId') });
      });

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2030-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });

      const res = await app.request('/test', {
        headers: { Cookie: 'authjs.session-token=valid-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe('user-1');
    });

    it('accepts production cookie name', async () => {
      const { authMiddleware } = await setupApp();
      app.use('*', authMiddleware);
      app.get('/test', (c) => c.json({ userId: c.get('userId') }));

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2030-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });

      const res = await app.request('/test', {
        headers: { Cookie: '__Secure-authjs.session-token=valid-token' },
      });
      expect(res.status).toBe(200);
    });

    it('returns 500 on Prisma error', async () => {
      const { authMiddleware } = await setupApp();
      app.use('*', authMiddleware);
      app.get('/test', (c) => c.json({ ok: true }));

      mockPrisma.session.findUnique.mockRejectedValue(new Error('DB down'));

      const res = await app.request('/test', {
        headers: { Cookie: 'authjs.session-token=some-token' },
      });
      expect(res.status).toBe(500);
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('continues without auth when no cookie present', async () => {
      const { optionalAuthMiddleware } = await setupApp();
      app.use('*', optionalAuthMiddleware);
      app.get('/test', (c) => c.json({ userId: c.get('userId') || null }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBeNull();
    });

    it('sets userId when valid session exists', async () => {
      const { optionalAuthMiddleware } = await setupApp();
      app.use('*', optionalAuthMiddleware);
      app.get('/test', (c) => c.json({ userId: c.get('userId') }));

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2030-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });

      const res = await app.request('/test', {
        headers: { Cookie: 'authjs.session-token=valid-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe('user-1');
    });

    it('continues without userId when session is expired', async () => {
      const { optionalAuthMiddleware } = await setupApp();
      app.use('*', optionalAuthMiddleware);
      app.get('/test', (c) => c.json({ userId: c.get('userId') || null }));

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2020-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });

      const res = await app.request('/test', {
        headers: { Cookie: 'authjs.session-token=expired-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBeNull();
    });
  });

  describe('requireTeamMembership', () => {
    it('returns 403 when user is not a team member', async () => {
      const { authMiddleware, requireTeamMembership } = await setupApp();
      app.use('/:teamId/*', authMiddleware);
      app.use('/:teamId/*', requireTeamMembership('teamId'));
      app.get('/:teamId/info', (c) => c.json({ ok: true }));

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2030-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });
      mockPrisma.teamMember.findUnique.mockResolvedValue(null);

      const res = await app.request('/team-123/info', {
        headers: { Cookie: 'authjs.session-token=valid-token' },
      });
      expect(res.status).toBe(403);
    });

    it('sets teamRole when membership exists', async () => {
      const { authMiddleware, requireTeamMembership } = await setupApp();
      app.use('/:teamId/*', authMiddleware);
      app.use('/:teamId/*', requireTeamMembership('teamId'));
      app.get('/:teamId/info', (c) => c.json({ role: c.get('teamRole') }));

      mockPrisma.session.findUnique.mockResolvedValue({
        expires: new Date('2030-01-01'),
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
        userId: 'user-1',
      });
      mockPrisma.teamMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        teamId: 'team-123',
        role: 'MENTOR',
      });

      const res = await app.request('/team-123/info', {
        headers: { Cookie: 'authjs.session-token=valid-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.role).toBe('MENTOR');
    });
  });
});
