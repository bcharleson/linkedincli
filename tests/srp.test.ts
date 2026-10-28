import { describe, expect, it } from 'vitest';
import { parseCompanyResults, parsePeopleResults, parseSrpNotice, srpList } from '../src/core/srp.js';
import { searchCompaniesCommand, searchPeopleCommand } from '../src/commands/search/search.js';
import { getDashProfile, profileViewCommand } from '../src/commands/profile/view.js';

// Trimmed copies of the server-rendered SRP markup (hashed class names removed,
// names and ids are fictional).
const person = (o: { slug: string; urn: string; name: string; degree?: string; verified?: boolean; lines: string[] }) => `
<div role="listitem"><div data-display-contents="true">
  <a tabindex="0" href="https://www.linkedin.com/in/${o.slug}/"><div><div><div id="x">${o.name}<span> </span></div>
  <figure aria-hidden="true"></figure><div>
  <p><a href="https://www.linkedin.com/in/${o.slug}/">${o.name}${o.verified ? '<span> </span><span role="img" aria-label="Verified"></span>' : ''}</a>${o.degree ? `<span><span> • ${o.degree}</span></span>` : ''}</p>
  ${o.lines.map((l) => `<div><p><span>${l}</span></p></div>`).join('')}
  </div><div><div id="SearchResults${o.urn}"><div></div></div></div></div>
  <div id="SearchResultssnippet_${o.urn}"></div></a></div></div>`;

const PEOPLE_HTML = `<html><body><main>
${person({ slug: 'erika-muster-1a2b', urn: 'ACoAAA111', name: 'Erika Muster', degree: '2.', verified: true, lines: ['Vertriebsleiterin bei Beispiel GmbH', 'Stuttgart, Deutschland'] })}
${person({ slug: 'max-m%C3%BCller', urn: 'ACoAAA222', name: 'Max M&#xFC;ller', degree: '1st', lines: ['Head of E-Commerce &amp; CRM', 'Berlin', '<a href="https://www.linkedin.com/in/a/">Anna</a><span> </span>und<span> </span><a href="#">2</a>weitere gemeinsame Kontakte'] })}
${person({ slug: 'out-of-network', urn: 'ACoAAA333', name: 'LinkedIn Member', lines: [] })}
</main></body></html>`;

const COMPANY_HTML = `<div role="listitem"><div><figure aria-hidden="true"></figure><div>
<p><a href="https://www.linkedin.com/company/beispiel-ag/">Beispiel AG</a></p>
<div><p><span>Herstellung von Industriemaschinen</span></p></div>
<div><p><span>Leonberg<!-- --></span></p></div></div></div>
<div><p><span>12.345 Follower:innen</span></p></div></div>`;

describe('parsePeopleResults', () => {
  const results = parsePeopleResults(PEOPLE_HTML);

  it('reads one result per list item', () => {
    expect(results).toHaveLength(3);
  });

  it('extracts name, degree, headline, location and urn', () => {
    expect(results[0]).toEqual({
      name: 'Erika Muster',
      url: 'https://www.linkedin.com/in/erika-muster-1a2b/',
      public_id: 'erika-muster-1a2b',
      urn_id: 'ACoAAA111',
      degree: 2,
      headline: 'Vertriebsleiterin bei Beispiel GmbH',
      location: 'Stuttgart, Deutschland',
      insights: [],
    });
  });

  it('decodes entities and slugs, handles English degrees and keeps word gaps', () => {
    expect(results[1].public_id).toBe('max-müller');
    expect(results[1].name).toBe('Max Müller');
    expect(results[1].degree).toBe(1);
    expect(results[1].headline).toBe('Head of E-Commerce & CRM');
    expect(results[1].insights).toEqual(['Anna und 2 weitere gemeinsame Kontakte']);
  });

  it('copes with results that show no degree', () => {
    expect(results[2].degree).toBeNull();
    expect(results[2].headline).toBeNull();
  });
});

describe('parseCompanyResults', () => {
  it('extracts name, industry, location and extra lines', () => {
    expect(parseCompanyResults(COMPANY_HTML)).toEqual([
      {
        name: 'Beispiel AG',
        url: 'https://www.linkedin.com/company/beispiel-ag/',
        universal_name: 'beispiel-ag',
        industry: 'Herstellung von Industriemaschinen',
        location: 'Leonberg',
        insights: ['12.345 Follower:innen'],
      },
    ]);
  });
});

describe('srpList', () => {
  it('encodes filters as JSON arrays', () => {
    expect(srpList('F')).toBe('["F"]');
    expect(srpList('F,S')).toBe('["F","S"]');
    expect(srpList(undefined)).toBeUndefined();
  });
});

function fakeClient(pages: string[]) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    request: async (opts: Record<string, unknown>) => {
      calls.push(opts);
      return pages[calls.length - 1] ?? '';
    },
  };
}

describe('search handlers', () => {
  it('requests the HTML results page with SRP filters', async () => {
    const client = fakeClient([PEOPLE_HTML]);
    const out = (await searchPeopleCommand.handler(
      { keywords: 'Vertrieb', network: 'F', company: '1035', limit: 10, start: 0 },
      client as never,
    )) as { count: number };

    expect(out.count).toBe(3);
    expect(client.calls[0]).toMatchObject({
      method: 'GET',
      path: '/search/results/people/',
      baseRequest: true,
      headers: { accept: 'text/html,application/xhtml+xml' },
      query: { keywords: 'Vertrieb', network: '["F"]', currentCompany: '["1035"]' },
    });
  });

  it('pages through results until the limit is reached', async () => {
    const full = Array.from({ length: 10 }, (_, i) =>
      person({ slug: `p${i}`, urn: `ACoAAAP${i}`, name: `Person ${i}`, degree: '2.', lines: [] }),
    ).join('');
    const client = fakeClient([full, full.replaceAll('/in/p', '/in/q')]);
    const out = (await searchPeopleCommand.handler(
      { keywords: 'x', limit: 12, start: 5 },
      client as never,
    )) as { results: Array<{ public_id: string }> };

    expect(out.results).toHaveLength(12);
    expect(out.results[0].public_id).toBe('p5');
    expect(client.calls.map((c) => (c.query as Record<string, unknown>).page)).toEqual([undefined, 2]);
  });

  it('searches companies on the companies SRP', async () => {
    const client = fakeClient([COMPANY_HTML]);
    const out = (await searchCompaniesCommand.handler(
      { keywords: 'Beispiel', limit: 10, start: 0 },
      client as never,
    )) as { results: Array<{ universal_name: string }> };
    expect(out.results[0].universal_name).toBe('beispiel-ag');
    expect(client.calls[0].path).toBe('/search/results/companies/');
  });
});

// Trimmed copy of the page LinkedIn served after too many searches (HTTP 200).
const SUSPENDED_HTML = `<main id="workspace"><div data-sdui-screen="com.linkedin.sdui.flagshipnav.search.SearchResultsPeople">
<div data-testid="lazy-column"><div><span data-dynamic-icon-loading=""></span>
<h2>Unsere Systeme haben ungewöhnlichen Suchverkehr von Ihrem Konto erkannt</h2>
<p>Zum Schutz der Privatsphäre unserer Mitglieder und der Systemsicherheit wurde die Suchaktivität in Ihrem Konto ausgesetzt. Versuchen Sie es später erneut.</p>
</div></div></div></main>`;

describe('search suspension', () => {
  it('reads the notice shown instead of results', () => {
    expect(parseSrpNotice(SUSPENDED_HTML)).toMatch(/^Unsere Systeme haben ungewöhnlichen Suchverkehr/);
    expect(parseSrpNotice(PEOPLE_HTML)).toBeNull();
  });

  it('fails with SEARCH_RESTRICTED instead of returning 0 results', async () => {
    await expect(
      searchPeopleCommand.handler({ keywords: 'x', limit: 10, start: 0 }, fakeClient([SUSPENDED_HTML]) as never),
    ).rejects.toMatchObject({ code: 'SEARCH_RESTRICTED' });
  });

  it('still returns an empty list for a plain empty page', async () => {
    const out = (await searchPeopleCommand.handler(
      { keywords: 'x', limit: 10, start: 0 },
      fakeClient(['<main></main>']) as never,
    )) as { count: number };
    expect(out.count).toBe(0);
  });
});

describe('profile view', () => {
  it('uses the dash profile endpoint and accepts profile URNs', async () => {
    const calls: unknown[][] = [];
    const client = { get: async (...args: unknown[]) => (calls.push(args), {}) };
    await profileViewCommand.handler({ public_id: 'erika-muster' }, client as never);
    await getDashProfile(client as never, 'urn:li:fsd_profile:ACoAAA111');
    expect(calls[0][0]).toBe('/identity/dash/profiles');
    expect(calls[0][1]).toMatchObject({ q: 'memberIdentity', memberIdentity: 'erika-muster' });
    expect((calls[1][1] as Record<string, string>).memberIdentity).toBe('ACoAAA111');
  });
});
