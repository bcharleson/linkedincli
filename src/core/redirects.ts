import { AuthError, ChallengeError, LinkedInError } from './errors.js';

/**
 * Classify a 3xx Voyager response. LinkedIn uses redirects for expired
 * sessions and verification walls; following them hides that as a generic
 * fetch / "redirect count exceeded" failure.
 */
export function classifyLinkedInRedirect(
  status: number,
  location: string,
  requestUrl: string,
): LinkedInError | null {
  if (status < 300 || status >= 400) {
    return null;
  }

  if (location.includes('/checkpoint/') || location.includes('/challenge/')) {
    return new ChallengeError();
  }

  if (location.includes('/login') || location.includes('/uas/') || location === requestUrl) {
    return new AuthError('Session redirected by LinkedIn. Run: linkedin login');
  }

  return new LinkedInError(
    `LinkedIn redirected request to: ${location || 'unknown location'}`,
    'REDIRECT_ERROR',
    status,
  );
}
