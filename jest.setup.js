// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill for Next.js Request/Response in Jest environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for Web APIs needed by Next.js
// Node.js 18+ has fetch, but may not have all Web APIs
if (typeof global.ReadableStream === 'undefined') {
  // Simple ReadableStream polyfill for Jest
  global.ReadableStream = class ReadableStream {
    constructor() {
      this._data = null;
    }
    getReader() {
      return {
        read: () => Promise.resolve({ done: true, value: undefined }),
      };
    }
  };
}

if (typeof global.Request === 'undefined') {
  // Minimal Request polyfill for Jest tests
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input?.url || 'http://localhost:3000';
      this.method = init.method || 'GET';
      this.headers = new Map();
      if (init.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key.toLowerCase(), value);
        });
      }
      this.body = init.body || null;
      this.bodyUsed = false;
    }

    async arrayBuffer() {
      if (this.bodyUsed) {
        throw new Error('Body already used');
      }
      this.bodyUsed = true;
      if (this.body instanceof ArrayBuffer) {
        return this.body;
      }
      if (this.body instanceof Buffer) {
        return this.body.buffer;
      }
      if (typeof this.body === 'string') {
        return Buffer.from(this.body).buffer;
      }
      return new ArrayBuffer(0);
    }

    async json() {
      const buffer = await this.arrayBuffer();
      const text = Buffer.from(buffer).toString();
      return JSON.parse(text);
    }

    async formData() {
      // Minimal FormData mock
      return new Map();
    }

    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: Object.fromEntries(this.headers),
        body: this.body,
      });
    }
  };

  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Map();
      if (init.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key.toLowerCase(), value);
        });
      }
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }

    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
  };

  global.Headers = class Headers {
    constructor(init) {
      this._headers = new Map();
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), value);
        });
      }
    }

    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }

    set(name, value) {
      this._headers.set(name.toLowerCase(), value);
    }

    has(name) {
      return this._headers.has(name.toLowerCase());
    }

    delete(name) {
      this._headers.delete(name.toLowerCase());
    }

    forEach(callback) {
      this._headers.forEach((value, key) => callback(value, key, this));
    }
  };
}

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-clerk-publishable-key';
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

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
