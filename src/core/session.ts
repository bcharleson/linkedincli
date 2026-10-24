import { LinkedInError } from './errors.js';

/** Require a recognizable member payload; HTTP 200 HTML is not a valid session. */
export function verifiedProfile(payload: unknown): Record<string, any> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const root = payload as Record<string, any>;
    const candidates = [root, root.miniProfile, root.data?.miniProfile];
    const ref = root.data?.['*miniProfile'] ?? root['*miniProfile'];
    if (typeof ref === 'string' && Array.isArray(root.included)) {
      candidates.push(root.included.find((entry: any) => entry?.entityUrn === ref));
    }
    for (const member of candidates) {
      if (member && typeof member.firstName === 'string' && member.firstName.trim() &&
          typeof member.lastName === 'string' && member.lastName.trim()) return member;
    }
  }
  throw new LinkedInError('LinkedIn returned an unrecognized profile response; session could not be verified.', 'INVALID_SESSION_RESPONSE');
}
