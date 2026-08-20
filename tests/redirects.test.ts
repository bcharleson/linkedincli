import { describe, expect, it } from 'vitest';
import { classifyLinkedInRedirect } from '../src/core/redirects.js';
import { AuthError, ChallengeError, LinkedInError } from '../src/core/errors.js';

const URL = 'https://www.linkedin.com/voyager/api/me';

describe('classifyLinkedInRedirect', () => {
  it('returns null for non-redirect statuses', () => {
    expect(classifyLinkedInRedirect(200, '/login', URL)).toBeNull();
    expect(classifyLinkedInRedirect(401, '/login', URL)).toBeNull();
    expect(classifyLinkedInRedirect(404, '', URL)).toBeNull();
  });

  it('classifies login and uas redirects as AuthError', () => {
    const login = classifyLinkedInRedirect(302, 'https://www.linkedin.com/login', URL);
    expect(login).toBeInstanceOf(AuthError);
    expect(login?.code).toBe('AUTH_ERROR');
    expect(login?.message).toMatch(/Session redirected/);

    const uas = classifyLinkedInRedirect(303, 'https://www.linkedin.com/uas/login', URL);
    expect(uas).toBeInstanceOf(AuthError);
  });

  it('classifies checkpoint and challenge redirects as ChallengeError', () => {
    const checkpoint = classifyLinkedInRedirect(302, 'https://www.linkedin.com/checkpoint/challenge/', URL);
    expect(checkpoint).toBeInstanceOf(ChallengeError);
    expect(checkpoint?.code).toBe('CHALLENGE_ERROR');

    const challenge = classifyLinkedInRedirect(302, 'https://www.linkedin.com/challenge/foo', URL);
    expect(challenge).toBeInstanceOf(ChallengeError);
  });

  it('classifies self-redirects as AuthError', () => {
    const err = classifyLinkedInRedirect(302, URL, URL);
    expect(err).toBeInstanceOf(AuthError);
  });

  it('classifies unexpected locations as REDIRECT_ERROR', () => {
    const err = classifyLinkedInRedirect(302, 'https://www.linkedin.com/feed/', URL);
    expect(err).toBeInstanceOf(LinkedInError);
    expect(err?.code).toBe('REDIRECT_ERROR');
    expect(err?.statusCode).toBe(302);
  });
});
