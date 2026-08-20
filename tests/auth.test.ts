import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/chrome-cookies.js', () => ({
  loadLinkedInCookiesFromChrome: async () => ({
    liAt: 'unit-test-li-at',
    jsessionid: 'ajax:unit-test',
    cookieHeader: 'li_at=unit-test-li-at; JSESSIONID=ajax:unit-test; lidc=unit-test-lidc',
    cookies: { li_at: 'unit-test-li-at', JSESSIONID: 'ajax:unit-test', lidc: 'unit-test-lidc' },
    profilePath: '/tmp/linkedin-cli-unit-chrome',
  }),
}));

vi.mock('../src/core/config.js', () => ({
  loadConfig: async () => null,
}));

import { resolveAuth, wantsFromChrome } from '../src/core/auth.js';

describe('wantsFromChrome', () => {
  afterEach(() => {
    delete process.env.LINKEDIN_FROM_CHROME;
  });

  it('is false by default', () => {
    expect(wantsFromChrome()).toBe(false);
    expect(wantsFromChrome({ fromChrome: false })).toBe(false);
  });

  it('honors the flag and env var', () => {
    expect(wantsFromChrome({ fromChrome: true })).toBe(true);
    process.env.LINKEDIN_FROM_CHROME = '1';
    expect(wantsFromChrome()).toBe(true);
    process.env.LINKEDIN_FROM_CHROME = 'true';
    expect(wantsFromChrome()).toBe(true);
  });
});

describe('resolveAuth', () => {
  afterEach(() => {
    delete process.env.LINKEDIN_FROM_CHROME;
    delete process.env.LINKEDIN_LI_AT;
    delete process.env.LINKEDIN_JSESSIONID;
  });

  it('prefers Chrome when requested and returns a full cookie header', async () => {
    const auth = await resolveAuth({ fromChrome: true });
    expect(auth.liAt).toBe('unit-test-li-at');
    expect(auth.jsessionid).toBe('ajax:unit-test');
    expect(auth.cookieHeader).toContain('lidc=');
  });

  it('reads dummy env cookies when Chrome is not requested', async () => {
    process.env.LINKEDIN_LI_AT = 'unit-test-env-li-at';
    process.env.LINKEDIN_JSESSIONID = 'ajax:unit-test-env';
    const auth = await resolveAuth();
    expect(auth.liAt).toBe('unit-test-env-li-at');
    expect(auth.jsessionid).toBe('ajax:unit-test-env');
    expect(auth.cookieHeader).toBeUndefined();
  });

  it('throws AUTH_ERROR when nothing is configured', async () => {
    await expect(resolveAuth()).rejects.toMatchObject({ code: 'AUTH_ERROR' });
  });
});
