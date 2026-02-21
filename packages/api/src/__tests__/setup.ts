import { vi } from 'vitest';

// Mock Prisma client
export const mockPrisma = {
  session: {
    findUnique: vi.fn(),
  },
  teamMember: {
    findUnique: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  scoutingEntry: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  scoutingNote: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  ftcTeam: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  invite: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

vi.mock('@ftcmetrics/db', () => ({
  prisma: mockPrisma,
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Mock Redis
export const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  ping: vi.fn(),
};

vi.mock('../lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
  isRedisHealthy: vi.fn(() => Promise.resolve(true)),
}));

// Set test environment variables
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.FTC_API_USERNAME = 'test';
process.env.FTC_API_TOKEN = 'test-token';
process.env.CORS_ORIGIN = 'http://localhost:3000';
