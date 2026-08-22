import { loadConfig } from './config.js';
import { AuthError } from './errors.js';
import type { AuthFlags, LinkedInAuth } from './types.js';
import { loadLinkedInCookiesFromChrome } from './chrome-cookies.js';

export function wantsFromChrome(flags?: AuthFlags): boolean {
  return (
    flags?.fromChrome === true ||
    process.env.LINKEDIN_FROM_CHROME === '1' ||
    process.env.LINKEDIN_FROM_CHROME === 'true'
  );
}

export async function resolveAuth(flags?: AuthFlags): Promise<LinkedInAuth> {
  // Priority: --from-chrome / LINKEDIN_FROM_CHROME > CLI flags > env vars > config file
  if (wantsFromChrome(flags)) {
    const profile = flags?.chromeProfile ?? process.env.LINKEDIN_CHROME_PROFILE ?? 'Default';
    try {
      const result = await loadLinkedInCookiesFromChrome(profile);
      return {
        liAt: result.liAt,
        jsessionid: result.jsessionid,
        cookieHeader: result.cookieHeader,
      };
    } catch (err) {
      throw new AuthError(`Could not load LinkedIn cookies from Chrome: ${(err as Error).message}`);
    }
  }

  const config = await loadConfig();

  const liAt = flags?.liAt ?? process.env.LINKEDIN_LI_AT ?? config?.li_at;
  const jsessionid = flags?.jsessionid ?? process.env.LINKEDIN_JSESSIONID ?? config?.jsessionid;

  if (!liAt) {
    throw new AuthError(
      'No li_at cookie found. Set LINKEDIN_LI_AT, use --li-at, run `linkedin login`, or use --from-chrome.',
    );
  }

  if (!jsessionid) {
    throw new AuthError(
      'No JSESSIONID cookie found. Set LINKEDIN_JSESSIONID, use --jsessionid, run `linkedin login`, or use --from-chrome.',
    );
  }

  return { liAt, jsessionid };
}
