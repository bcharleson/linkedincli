import { spawn } from 'node:child_process';

/**
 * Pluggable HTTP transport. Defaults to global `fetch` (Node), but can
 * shell out to `curl_chrome123` (curl-impersonate-chrome) when
 * `LINKEDIN_HTTP=curl-impersonate` is set. That binary is opt-in and
 * local-harness only — install it on the same machine that holds the session.
 * It sends a TLS ClientHello that matches real Chrome so Voyager calls are
 * less likely to get the session killed.
 *
 * Redirects are never followed (fetch `redirect: 'manual'`, curl `--max-redirs 0`)
 * so expired sessions surface as 3xx instead of "redirect count exceeded".
 */

export interface HttpResponse {
  status: number;
  headers: Headers;
  text(): Promise<string>;
}

export type HttpRequestInit = {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

export function useCurlImpersonate(): boolean {
  return (
    process.env.LINKEDIN_HTTP === 'curl-impersonate' ||
    process.env.LINKEDIN_USE_CURL_IMPERSONATE === '1'
  );
}

export async function httpRequest(url: string, init: HttpRequestInit): Promise<HttpResponse> {
  if (useCurlImpersonate()) {
    return curlImpersonateRequest(url, init);
  }
  const res = await fetch(url, { ...init, redirect: 'manual' });
  return res;
}

const CURL_BIN = process.env.LINKEDIN_CURL_IMPERSONATE_BIN ?? 'curl_chrome123';

function curlImpersonateRequest(url: string, init: HttpRequestInit): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const args: string[] = [
      '-sS',
      '-i', // include response headers in output
      '--compressed',
      '--max-redirs',
      '0',
      '-X',
      init.method,
      '--max-time',
      '30',
    ];
    for (const [name, value] of Object.entries(init.headers)) {
      // curl-impersonate already sets sec-ch-ua, user-agent, sec-fetch-*, etc.
      // Skip any we redundantly set so we don't override the Chrome-matching
      // values it provides.
      const lower = name.toLowerCase();
      if (
        lower === 'user-agent' ||
        lower.startsWith('sec-') ||
        lower === 'accept-encoding' ||
        lower === 'accept-language' ||
        lower === 'upgrade-insecure-requests'
      ) {
        continue;
      }
      args.push('-H', `${name}: ${value}`);
    }
    if (init.body !== undefined) {
      args.push('--data-binary', '@-');
    }
    args.push(url);

    const child = spawn(CURL_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    const onAbort = () => child.kill('SIGTERM');
    init.signal?.addEventListener('abort', onAbort);

    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      init.signal?.removeEventListener('abort', onAbort);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `curl-impersonate binary "${CURL_BIN}" not found in PATH. ` +
              `Install curl-impersonate-chrome (binary: curl_chrome123) or set LINKEDIN_CURL_IMPERSONATE_BIN. ` +
              `See README for install options.`,
          ),
        );
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      init.signal?.removeEventListener('abort', onAbort);
      // curl exits 47 when --max-redirs is exceeded; with max-redirs 0 a 3xx
      // is still a successful capture of the redirect response if -i printed it.
      const raw = Buffer.concat(chunks);
      if (code !== 0 && raw.length === 0) {
        reject(new Error(`${CURL_BIN} exited ${code}: ${stderr.trim() || 'no output'}`));
        return;
      }
      try {
        const parsed = parseRawHttpResponse(raw);
        if (process.env.LINKEDIN_DEBUG === '1') {
          process.stderr.write(
            `[transport] ${init.method} ${url} -> ${parsed.status} location=${parsed.headers.get('location') ?? '-'}\n`,
          );
        }
        resolve(parsed);
      } catch (err) {
        if (code !== 0) {
          reject(new Error(`${CURL_BIN} exited ${code}: ${stderr.trim() || 'unparseable response'}`));
          return;
        }
        reject(err);
      }
    });

    if (init.body !== undefined) {
      child.stdin.write(init.body);
    }
    child.stdin.end();
  });
}

function findHeaderBodySplit(raw: Buffer, from: number): { idx: number; sepLen: number } | null {
  const crlf = raw.indexOf('\r\n\r\n', from);
  const lf = raw.indexOf('\n\n', from);
  if (crlf !== -1 && (lf === -1 || crlf <= lf)) {
    return { idx: crlf, sepLen: 4 };
  }
  if (lf !== -1) {
    return { idx: lf, sepLen: 2 };
  }
  return null;
}

/** Parse `curl -i` output. Exported for unit tests. Never logs cookie values. */
export function parseRawHttpResponse(raw: Buffer): HttpResponse {
  // curl -i includes one or more header blocks (one per redirect) then the body.
  // Take the last header block.
  let lastHeadersEnd = -1;
  let lastHeadersStart = 0;
  let lastSepLen = 4;
  while (true) {
    const split = findHeaderBodySplit(raw, lastHeadersStart);
    if (!split) break;
    const next = raw.subarray(split.idx + split.sepLen);
    if (next.subarray(0, 5).toString('utf8') === 'HTTP/') {
      lastHeadersStart = split.idx + split.sepLen;
      continue;
    }
    lastHeadersEnd = split.idx;
    lastSepLen = split.sepLen;
    break;
  }
  if (lastHeadersEnd === -1) {
    throw new Error('Could not parse curl-impersonate response');
  }

  const headerBlock = raw.subarray(lastHeadersStart, lastHeadersEnd).toString('utf8');
  const body = raw.subarray(lastHeadersEnd + lastSepLen);

  const lines = headerBlock.split(/\r?\n/);
  const statusLine = lines.shift() ?? '';
  const statusMatch = statusLine.match(/^HTTP\/[\d.]+\s+(\d+)/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;

  const headers = new Headers();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name) headers.append(name, value);
  }

  return {
    status,
    headers,
    async text() {
      return body.toString('utf8');
    },
  };
}
