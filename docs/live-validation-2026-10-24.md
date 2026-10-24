# Bounded local validation — 2026-10-24

The operator authorized read-only tests of their own profile, skills, and latest three posts. All requests ran locally on macOS with Chrome Beta import, curl-impersonate's curl_chrome123 wrapper, and no automatic retries. No cookie values were printed or saved to CLI configuration. Headers passed to curl through stdin rather than argv. No writes, searches, or pagination were performed.

## Observed results

- Earlier session verification: one `/me` request returned the expected member and `session_valid: true`. A browser accessibility snapshot still showed the signed-in feed at that point; that was not a fresh browser request proving continued session validity.
- Full profile: PR #6's profile view handler returned the expected own member, slug, and headline from `/identity/dash/profiles`, using the hardened transport/client from PR #7. This validates the profile request for this account/response, not the entire unmodified PR #6 transport.
- Skills: PR #6's skills handler returned 20 named Skill entities when evaluated against the same cached profile response. This required no additional request. Association/order/completeness and browser comparison remain unverified.
- Latest posts: one `/identity/profileUpdatesV2` request with count=3 and start=0 returned HTTP 401 / AUTH_ERROR. No retry was made. Testing stopped.
- Browser follow-up: fresh navigation to the operator's own profile reached LinkedIn's authwall (sign-in page). The browser session was no longer authenticated. No account suspension/restriction notice was visible. The test does not establish which request caused session loss.

## Implications

Live session survival failed during this bounded trial despite two successful earlier reads (/me and full profile). Do not describe this configuration as safe for a primary account or generally validated. Browser-like TLS and local-only cookie handling do not guarantee session survival. Do not infer that the account itself was suspended, or that the posts endpoint alone caused logout.

No additional API requests should be made from this trial. The operator must recover their browser session manually. Investigate protocol/client compatibility offline before proposing another live trial. Keyword post search, Windows session acceptance, and PR #6's remaining parser/response-validation gaps remain unresolved.
