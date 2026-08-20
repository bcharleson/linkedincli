import { describe, expect, it } from 'vitest';
import {
  SEARCH_POSTS_UNAVAILABLE_MESSAGE,
  searchPostsCommand,
} from '../src/commands/search/search.js';
import { LinkedInError } from '../src/core/errors.js';

describe('searchPostsCommand', () => {
  it('fails closed with SEARCH_UNAVAILABLE and does not call the client', async () => {
    const client = {
      get: async () => {
        throw new Error('search posts must not call Voyager');
      },
    };

    await expect(
      searchPostsCommand.handler({ keywords: 'AI', limit: 10, start: 0 }, client as never),
    ).rejects.toMatchObject({
      name: 'LinkedInError',
      code: 'SEARCH_UNAVAILABLE',
    });

    await expect(
      searchPostsCommand.handler({ keywords: 'AI', limit: 10, start: 0 }, client as never),
    ).rejects.toBeInstanceOf(LinkedInError);

    expect(SEARCH_POSTS_UNAVAILABLE_MESSAGE).toContain('profile posts');
    expect(SEARCH_POSTS_UNAVAILABLE_MESSAGE).toContain('FeedbackCard');
  });
});
