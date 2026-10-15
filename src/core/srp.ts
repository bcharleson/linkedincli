/**
 * Parser for LinkedIn's server-rendered search results pages (SRP).
 *
 * LinkedIn moved web search to server-driven UI: `/search/results/people/` and
 * `/search/results/companies/` now return the results inside the HTML, and the
 * old `voyagerSearchDashClusters` GraphQL queryId answers with HTTP 400.
 *
 * Class names on these pages are hashed and change with every deploy, so this
 * parser only relies on structure: each result is a `role="listitem"` element
 * with a profile/company link, followed by `<p><span>…</span></p>` text lines.
 */

export type SrpKind = 'people' | 'companies';

export interface PersonResult {
  name: string;
  url: string;
  public_id: string;
  /** Profile URN id (ACoAA…), usable with `profile posts` / `feed user` */
  urn_id: string | null;
  /** Connection degree as shown on the page: 1, 2, 3 (null when not shown) */
  degree: number | null;
  headline: string | null;
  location: string | null;
  /** Extra lines such as mutual connections or "Current:" snippets */
  insights: string[];
}

export interface CompanyResult {
  name: string;
  url: string;
  universal_name: string;
  industry: string | null;
  location: string | null;
  /** Extra lines such as follower count or description snippet */
  insights: string[];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function stripTags(html: string): string {
  // "<a>2</a>weitere" renders with a gap in the browser; keep it as a space
  const spaced = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/a>(?=[^\s<])/g, '</a> ');
  return decodeHtml(spaced.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:])/g, '$1')
    .trim();
}

/** Text of every `<p>…</p>` in the chunk, tags stripped, empty lines dropped. */
function paragraphs(chunk: string): string[] {
  const out: string[] = [];
  for (const m of chunk.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = stripTags(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function listItems(html: string): string[] {
  const starts = [...html.matchAll(/role="listitem"/g)].map((m) => m.index ?? 0);
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length));
}

// Innermost link only: verified profiles wrap the whole card in an outer <a>
const INNER = '((?:(?!<a\\b)[\\s\\S])*?)<\\/a>';
const PERSON_LINK = new RegExp(`href="(https:\\/\\/www\\.linkedin\\.com\\/in\\/([^/"?]+)\\/?)[^"]*"[^>]*>${INNER}`);
const COMPANY_LINK = new RegExp(
  `href="(https:\\/\\/www\\.linkedin\\.com\\/company\\/([^/"?]+)\\/?)[^"]*"[^>]*>${INNER}`,
);
const DEGREE = /^(.*?)\s*•\s*(\d)\.?\s*(?:\S+)?$/;

export function parsePeopleResults(html: string): PersonResult[] {
  const results: PersonResult[] = [];
  const seen = new Set<string>();

  for (const chunk of listItems(html)) {
    const link = chunk.match(PERSON_LINK);
    if (!link) continue;
    const publicId = decodeURIComponent(link[2]);
    if (seen.has(publicId)) continue;

    const urn = chunk.match(/id="SearchResults(ACoA[A-Za-z0-9_-]+)"/);
    const lines = paragraphs(chunk);

    // First line is "<Name> • 2." (degree may be missing, e.g. out of network)
    let name = stripTags(link[3]);
    let degree: number | null = null;
    let rest = lines;
    if (lines.length && lines[0].startsWith(name)) {
      const d = lines[0].match(DEGREE);
      if (d) degree = Number(d[2]);
      rest = lines.slice(1);
    }
    if (!name) {
      const label = chunk.match(/<figure[^>]*aria-label="([^"]+)"/);
      name = label ? decodeHtml(label[1]) : publicId;
    }

    seen.add(publicId);
    results.push({
      name,
      url: link[1].endsWith('/') ? link[1] : `${link[1]}/`,
      public_id: publicId,
      urn_id: urn ? urn[1] : null,
      degree,
      headline: rest[0] ?? null,
      location: rest[1] ?? null,
      insights: rest.slice(2),
    });
  }
  return results;
}

export function parseCompanyResults(html: string): CompanyResult[] {
  const results: CompanyResult[] = [];
  const seen = new Set<string>();

  for (const chunk of listItems(html)) {
    const link = chunk.match(COMPANY_LINK);
    if (!link) continue;
    const universalName = decodeURIComponent(link[2]);
    if (seen.has(universalName)) continue;

    const name = stripTags(link[3]);
    const lines = paragraphs(chunk);
    const rest = lines.length && lines[0] === name ? lines.slice(1) : lines;

    seen.add(universalName);
    results.push({
      name,
      url: link[1].endsWith('/') ? link[1] : `${link[1]}/`,
      universal_name: universalName,
      industry: rest[0] ?? null,
      location: rest[1] ?? null,
      insights: rest.slice(2),
    });
  }
  return results;
}

/** LinkedIn SRP list filters are JSON arrays in the query string: network=["F","S"] */
export function srpList(values: string | string[] | undefined): string | undefined {
  if (values === undefined || values === '') return undefined;
  const list = Array.isArray(values) ? values : String(values).split(',').map((v) => v.trim());
  return JSON.stringify(list.filter(Boolean));
}

export const SRP_PAGE_SIZE = 10;

/**
 * Text of the notice LinkedIn shows instead of results (e.g. a search suspension),
 * read from the first `<h2>` (+ following `<p>`) of the search results screen.
 */
export function parseSrpNotice(html: string): string | null {
  const screen = html.search(/data-sdui-screen="[^"]*SearchResults/);
  if (screen < 0) return null;
  const rest = html.slice(screen);
  const firstItem = rest.search(/role="listitem"/);
  const m = rest.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>\s*(?:<p\b[^>]*>([\s\S]*?)<\/p>)?/);
  if (!m || (firstItem >= 0 && (m.index ?? 0) > firstItem)) return null;
  return [m[1], m[2]].filter(Boolean).map(stripTags).join(' ');
}

/** Notice wording when LinkedIn suspends search for an account (seen in de; en variants guessed broadly). */
export const SEARCH_RESTRICTED_PATTERN = /ungewöhnlich|ausgesetzt|unusual|suspended|restricted/i;
