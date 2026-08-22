import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';

/**
 * Reads LinkedIn cookies from Chrome's local cookie store and decrypts them.
 * Local-harness only (the machine that owns the Chrome profile). Do not use
 * from a cloud agent or remote runner.
 * Supports macOS and Linux. Chrome can be running — the SQLite DB is copied
 * to a temp location first so we don't fight Chrome's lock.
 *
 * Cookie values are never written to the process log or thrown error messages.
 */

export interface ChromeCookieResult {
  liAt: string;
  jsessionid: string;
  /** Full cookie header with all linkedin.com cookies (browser-shaped jar). */
  cookieHeader: string;
  /** Raw decoded cookies, keyed by name. */
  cookies: Record<string, string>;
  /** Path to the Chrome profile used. */
  profilePath: string;
}

function chromeUserDataDirs(): string[] {
  if (process.env.LINKEDIN_CHROME_USER_DATA_DIR) {
    return [process.env.LINKEDIN_CHROME_USER_DATA_DIR];
  }

  const home = homedir();
  if (process.platform === 'darwin') {
    return [join(home, 'Library/Application Support/Google/Chrome')];
  }
  if (process.platform === 'linux') {
    return [join(home, '.config/google-chrome'), join(home, '.config/chromium')];
  }
  throw new Error(
    `Chrome cookie reader supports macOS and Linux only (got ${process.platform}). ` +
      `On Windows, Chrome 127+ uses App-Bound Encryption which can't be decrypted from another process.`,
  );
}

function chromeProfileDir(profile: string): string {
  const dirs = chromeUserDataDirs();
  for (const dir of dirs) {
    const candidate = join(dir, profile);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Chrome profile "${profile}" not found. Looked in:\n  ${dirs.map((d) => join(d, profile)).join('\n  ')}`,
  );
}

function chromeCookieDb(profile: string): { dbPath: string; profilePath: string } {
  const profilePath = chromeProfileDir(profile);
  // Chrome ≥ 96 stores cookies under Network/Cookies; older Chrome keeps Cookies at the profile root.
  const candidates = [join(profilePath, 'Network', 'Cookies'), join(profilePath, 'Cookies')];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Chrome cookie database not found for profile "${profile}". Looked in:\n  ${candidates.join('\n  ')}`,
    );
  }
  return { dbPath: found, profilePath };
}

function getMacChromeSafeStoragePassword(): string {
  const result = spawnSync(
    'security',
    ['find-generic-password', '-w', '-s', 'Chrome Safe Storage'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `Could not read "Chrome Safe Storage" from macOS Keychain. ` +
        `You'll need to click "Always Allow" in the Keychain prompt the first time.`,
    );
  }
  return result.stdout.trim();
}

export function deriveChromeCookieKey(password: string, iterations: number): Buffer {
  return pbkdf2Sync(password, 'saltysalt', iterations, 16, 'sha1');
}

function isLikelyCookieByte(b: number): boolean {
  // Printable ASCII range used by cookies (RFC 6265 cookie-octet)
  return b >= 0x20 && b <= 0x7e;
}

export function decryptChromeCookieValue(encrypted: Buffer, key: Buffer): string {
  if (encrypted.length === 0) return '';
  const prefix = encrypted.subarray(0, 3).toString('utf8');

  if (prefix !== 'v10' && prefix !== 'v11') {
    // Legacy unencrypted cookie — return raw bytes as utf8.
    return encrypted.toString('utf8');
  }

  const ciphertext = encrypted.subarray(3);
  const iv = Buffer.alloc(16, 0x20); // 16 space chars
  const decipher = createDecipheriv('aes-128-cbc', key, iv);
  let plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // Chrome ≥ 130 (M130) prepends a 32-byte SHA-256 of the host_key to the cookie
  // plaintext before encrypting. Detect by scanning the leading 32 bytes for
  // non-printable density — a SHA-256 has ~24-25 non-printable bytes on average,
  // while a real cookie value is essentially all printable ASCII.
  if (plaintext.length > 32) {
    let nonPrintable = 0;
    for (let i = 0; i < 32; i++) {
      if (!isLikelyCookieByte(plaintext[i])) nonPrintable++;
    }
    if (nonPrintable >= 4) {
      plaintext = plaintext.subarray(32);
    }
  }

  return plaintext.toString('utf8');
}

function querySqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-separator', '\t', dbPath, sql], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (msg.includes('ENOENT') || (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `The "sqlite3" command-line tool is required to read Chrome cookies but was not found in PATH. ` +
          `Install it: macOS ships it by default; on Linux run \`sudo apt install sqlite3\`.`,
      );
    }
    throw new Error('sqlite3 query failed while reading the Chrome cookie database.');
  }
}

export async function loadLinkedInCookiesFromChrome(
  profile = 'Default',
): Promise<ChromeCookieResult> {
  const { dbPath, profilePath } = chromeCookieDb(profile);

  // Chrome holds an exclusive lock while running. Copy the DB plus its WAL/SHM
  // sidecar files (Chrome runs in WAL mode — recent writes live in the -wal file).
  const tmpDir = mkdtempSync(join(tmpdir(), 'linkedin-cli-chrome-'));
  const tmpDb = join(tmpDir, 'Cookies');
  copyFileSync(dbPath, tmpDb);
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (existsSync(sidecar)) copyFileSync(sidecar, `${tmpDb}${suffix}`);
  }

  let rows: string;
  try {
    rows = querySqlite(
      tmpDb,
      `SELECT name, hex(encrypted_value), host_key
       FROM cookies
       WHERE host_key LIKE '%linkedin.com'
       ORDER BY rowid;`,
    );
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  let key: Buffer;
  if (process.platform === 'darwin') {
    key = deriveChromeCookieKey(getMacChromeSafeStoragePassword(), 1003);
  } else {
    // Linux default when no keyring is configured.
    key = deriveChromeCookieKey('peanuts', 1);
  }

  const cookies: Record<string, string> = {};
  for (const line of rows.split('\n')) {
    if (!line.trim()) continue;
    const [name, hexValue] = line.split('\t');
    if (!name || !hexValue) continue;
    try {
      const buf = Buffer.from(hexValue, 'hex');
      const value = decryptChromeCookieValue(buf, key);
      if (value) cookies[name] = value;
    } catch {
      // Skip cookies we can't decrypt (e.g. v20 app-bound on newer Chrome).
    }
  }

  const liAt = cookies['li_at'];
  const jsessionid = cookies['JSESSIONID'];
  if (!liAt) {
    throw new Error(
      `li_at cookie not found for profile "${profile}". Are you logged into LinkedIn in this Chrome profile?`,
    );
  }
  if (!jsessionid) {
    throw new Error(`JSESSIONID cookie not found for profile "${profile}".`);
  }

  const cookieHeader = Object.entries(cookies)
    .map(([n, v]) => `${n}=${v}`)
    .join('; ');

  return {
    liAt,
    jsessionid,
    cookieHeader,
    cookies,
    profilePath,
  };
}
