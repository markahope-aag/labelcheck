// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill for Next.js Request/Response in Jest environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for Web APIs needed by undici/Next.js
// Jest's environment is missing some globals
if (typeof global.MessageChannel === 'undefined') {
  const { MessageChannel, MessagePort } = require('worker_threads');
  global.MessageChannel = MessageChannel;
  global.MessagePort = MessagePort;
}

if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
}

// Use Node.js native fetch API (available in Node 18+)
// Jest's testEnvironment doesn't always expose them, so we import directly
const { fetch, Request, Response, Headers, FormData } = require('undici');

global.fetch = fetch;
global.Request = Request;
global.Response = Response;
global.Headers = Headers;
global.FormData = FormData;

// Mock OpenAI globally to prevent initialization issues
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-clerk-publishable-key';
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock Clerk authentication globally to prevent ESM parsing issues
// This must be done BEFORE any modules import @clerk/nextjs
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn().mockResolvedValue({
    userId: 'test-clerk-user-id',
    sessionId: 'test-session-id',
    orgId: null,
  }),
  clerkClient: jest.fn(() => ({
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'test-clerk-user-id',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      }),
    },
  })),
  currentUser: jest.fn().mockResolvedValue({
    id: 'test-clerk-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  }),
}));

// Mock Supabase client creation globally to prevent connection attempts
// This must be done BEFORE any modules import @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => {
  const mockSelect = jest.fn().mockReturnThis();
  const mockInsert = jest.fn().mockReturnThis();
  const mockUpdate = jest.fn().mockReturnThis();
  const mockDelete = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

  const mockFrom = jest.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  });

  return {
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
  };
});

// Mock Next.js router (used by many components)
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.error and console.warn in tests unless explicitly needed
  error: jest.fn(),
  warn: jest.fn(),
};
