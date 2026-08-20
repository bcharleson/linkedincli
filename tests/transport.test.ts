import { afterEach, describe, expect, it } from 'vitest';
import { httpRequest, parseRawHttpResponse, useCurlImpersonate } from '../src/core/transport.js';

describe('parseRawHttpResponse', () => {
  it('parses a 302 with CRLF headers and no body', async () => {
    const raw = Buffer.from(
      'HTTP/1.1 302 Found\r\n' +
        'Location: https://www.linkedin.com/login\r\n' +
        'Content-Type: text/html\r\n' +
        '\r\n',
    );
    const res = parseRawHttpResponse(raw);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://www.linkedin.com/login');
    expect(await res.text()).toBe('');
  });

  it('parses HTTP/2 status lines and LF-only separators', async () => {
    const raw = Buffer.from('HTTP/2 200\ncontent-type: application/json\n\n{"ok":true}');
    const res = parseRawHttpResponse(raw);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('uses the last header block when curl includes an intermediate response', async () => {
    const raw = Buffer.from(
      'HTTP/1.1 301 Moved Permanently\r\nLocation: https://www.linkedin.com/voyager/api/me\r\n\r\n' +
        'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"firstName":"Ada"}',
    );
    const res = parseRawHttpResponse(raw);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"firstName":"Ada"}');
  });
});

describe('useCurlImpersonate', () => {
  afterEach(() => {
    delete process.env.LINKEDIN_HTTP;
    delete process.env.LINKEDIN_USE_CURL_IMPERSONATE;
  });

  it('is opt-in via LINKEDIN_HTTP', () => {
    expect(useCurlImpersonate()).toBe(false);
    process.env.LINKEDIN_HTTP = 'curl-impersonate';
    expect(useCurlImpersonate()).toBe(true);
  });
});

describe('httpRequest', () => {
  afterEach(() => {
    delete process.env.LINKEDIN_HTTP;
  });

  it('calls fetch with redirect: manual', async () => {
    const calls: RequestInit[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      calls.push(init ?? {});
      return {
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{}',
      } as Response;
    }) as typeof fetch;

    try {
      const res = await httpRequest('https://example.test/voyager', {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      expect(res.status).toBe(200);
      expect(calls[0]?.redirect).toBe('manual');
    } finally {
      globalThis.fetch = original;
    }
  });
});
