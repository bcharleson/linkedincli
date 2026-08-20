import { afterEach, describe, expect, it } from 'vitest';
import { createClient } from '../src/core/client.js';
import { ChallengeError } from '../src/core/errors.js';

function mockFetch(status: number, location: string): typeof fetch {
  return (async () =>
    ({
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers({ location }),
      text: async () => '',
    }) as Response) as typeof fetch;
}

describe('createClient redirect handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.LINKEDIN_HTTP;
  });

  it('throws AuthError when Voyager redirects to /login', async () => {
    globalThis.fetch = mockFetch(302, 'https://www.linkedin.com/login');
    const client = createClient({ liAt: 'unit-test-li-at', jsessionid: 'ajax:unit-test' });
    await expect(client.get('/me')).rejects.toMatchObject({
      name: 'AuthError',
      code: 'AUTH_ERROR',
      message: expect.stringMatching(/Session redirected/),
    });
  });

  it('throws ChallengeError when Voyager redirects to /checkpoint/', async () => {
    globalThis.fetch = mockFetch(302, 'https://www.linkedin.com/checkpoint/challenge/foo');
    const client = createClient({ liAt: 'unit-test-li-at', jsessionid: 'ajax:unit-test' });
    await expect(client.get('/me')).rejects.toBeInstanceOf(ChallengeError);
  });
});
