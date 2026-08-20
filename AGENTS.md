# AGENTS.md — LinkedIn CLI Tool Reference for AI Agents

> This file documents every tool available in the LinkedIn CLI / MCP server.
> AI agents (Claude Code, Cursor, Windsurf, OpenClaw, etc.) should use this as the authoritative reference for managing LinkedIn.

## Authentication

**Local harness only.** A live LinkedIn session (cookies, Chrome cookie import, Voyager API calls) must run on the operator's own computer (laptop or Mac mini). Cloud agents and Grok Bot must not set session cookies or call Voyager. Safe remote use is: install the `linkedin` CLI binary, or call an MCP server already running on the local harness. Cookies and Voyager calls never leave that machine.

On the local harness, session cookies are stored in `~/.linkedin-cli/config.json` after `linkedin login`, or set via environment variables:

```
LINKEDIN_LI_AT=<your li_at cookie>
LINKEDIN_JSESSIONID=<your JSESSIONID cookie>
```

Optional **local-only** session-survival settings (see README). Default Node `fetch` is often TLS-fingerprinted and LinkedIn may invalidate `li_at` immediately:

```
LINKEDIN_HTTP=curl-impersonate          # local curl_chrome123 (opt-in)
LINKEDIN_CURL_IMPERSONATE_BIN=...       # override binary path on this machine
LINKEDIN_FROM_CHROME=1                  # read cookies from a local Chrome profile
LINKEDIN_CHROME_PROFILE=Default         # Chrome profile directory name
```

CLI equivalents: `--from-chrome`, `--chrome-profile <name>`. These read the local Chrome profile and must not be used from a remote runner.

To check if the session is valid (local harness):
```bash
linkedin status --verify
```

---

## Tool Reference

### Profile Tools

#### `profile_me`
Get the authenticated user's own LinkedIn profile.
```bash
linkedin profile me
```
**Parameters:** None
**Returns:** Full profile object (firstName, lastName, headline, entityUrn, publicIdentifier, etc.)

---

#### `profile_view`
View any LinkedIn profile by their public identifier (the URL slug).
```bash
linkedin profile view johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | The public profile identifier from their LinkedIn URL |

**Returns:** Full profile view including positions, education, languages, publications, certifications, skills

---

#### `profile_contact-info`
Get contact information for a profile (email, phone, websites, Twitter handles).
```bash
linkedin profile contact-info johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | Public profile identifier |

**Returns:** `emailAddress`, `websites[]`, `twitterHandles[]`, `phoneNumbers[]`, `birthDateOn`

---

#### `profile_skills`
List skills for a profile.
```bash
linkedin profile skills johndoe --count 50
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `public_id` | string | yes | — | Public profile identifier |
| `count` | number | no | 100 | Number of skills to return (1-100) |

---

#### `profile_network`
Get network info: connection count, follower count, connection distance, following state.
```bash
linkedin profile network johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | Public profile identifier |

---

#### `profile_badges`
Check if a profile has premium, influencer, job seeker, or open link badges.
```bash
linkedin profile badges johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | Public profile identifier |

**Returns:** `{ influencer, jobSeeker, openLink, premium }` (booleans)

---

#### `profile_privacy`
Get privacy settings for a profile.
```bash
linkedin profile privacy johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | Public profile identifier |

---

#### `profile_posts`
List recent posts from a profile. Requires the numeric URN ID (not the public identifier).
```bash
linkedin profile posts ACoAABxxxxxxx --count 20
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `urn_id` | string | yes | — | Profile URN ID (numeric part) |
| `count` | number | no | 10 | Number of posts (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

#### `profile_disconnect`
Remove an existing connection (unfriend).
```bash
linkedin profile disconnect johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | Public profile identifier |

---

### Post Tools

#### `posts_create`
Create a new LinkedIn post. Supports text-only and image posts.
```bash
linkedin posts create --text "Hello LinkedIn!"
linkedin posts create --text "Check this out" --image ./photo.jpg
linkedin posts create --text "For connections only" --visibility connections
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `text` | string | yes | — | Post text content (max 3000 chars) |
| `visibility` | enum | no | `anyone` | `anyone` or `connections` |
| `image` | string | no | — | File path to image to attach |
| `comments_scope` | enum | no | `all` | Who can comment: `all`, `connections`, `none` |

---

#### `posts_edit`
Edit the text of an existing post.
```bash
linkedin posts edit "urn:li:share:12345" --text "Updated content"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `share_urn` | string | yes | The share URN of the post |
| `text` | string | yes | New post text (max 3000 chars) |

---

#### `posts_delete`
Delete a post.
```bash
linkedin posts delete "urn:li:share:12345"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `share_urn` | string | yes | The share URN of the post to delete |

---

### Feed Tools

#### `feed_view`
View your LinkedIn feed in chronological order.
```bash
linkedin feed view --count 20
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `count` | number | no | 10 | Number of feed items (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

#### `feed_user`
View a specific user's activity feed.
```bash
linkedin feed user johndoe --count 20
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `profile_id` | string | yes | — | Public profile ID or URN ID |
| `count` | number | no | 10 | Number of items (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

#### `feed_company`
View a company's feed/updates.
```bash
linkedin feed company google --count 20
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `company_name` | string | yes | — | Company universal name (URL slug) |
| `count` | number | no | 10 | Number of items (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

### Engagement Tools

#### `engage_react`
React to a post. Six reaction types available.
```bash
linkedin engage react 7123456789 --type LIKE
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `post_urn` | string | yes | — | Activity URN ID (numeric part) |
| `type` | enum | no | `LIKE` | Reaction type (see below) |

**Reaction types:**
| Value | Meaning |
|-------|---------|
| `LIKE` | Thumbs up |
| `PRAISE` | Celebrate (clapping) |
| `APPRECIATION` | Support (heart-hands) |
| `EMPATHY` | Love (heart) |
| `INTEREST` | Insightful (lightbulb) |
| `ENTERTAINMENT` | Funny (laughing) |

---

#### `engage_reactions`
Get reactions on a post.
```bash
linkedin engage reactions 7123456789 --count 50
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `post_urn` | string | yes | — | Activity URN ID |
| `count` | number | no | 10 | Number of reactions (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

#### `engage_comment`
Comment on a post.
```bash
linkedin engage comment 7123456789 --text "Great post!"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `post_urn` | string | yes | Activity URN ID |
| `text` | string | yes | Comment text (max 1250 chars) |

---

#### `engage_comments-list`
List comments on a post.
```bash
linkedin engage comments-list 7123456789 --sort REVERSE_CHRONOLOGICAL
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `post_urn` | string | yes | — | Activity URN ID |
| `count` | number | no | 10 | Number of comments (1-100) |
| `start` | number | no | 0 | Pagination offset |
| `sort` | enum | no | `RELEVANCE` | `RELEVANCE` or `REVERSE_CHRONOLOGICAL` |

---

#### `engage_share`
Share/repost a post with optional commentary.
```bash
linkedin engage share "urn:li:share:12345" --text "This is worth reading"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `share_urn` | string | yes | Original share URN to repost |
| `text` | string | no | Optional commentary (max 3000 chars) |

---

### Connection Tools

#### `connections_send`
Send a connection request. Optional personalized message (max 300 chars).
```bash
linkedin connections send ACoAABxxxxxxx --message "Hi, I'd love to connect!"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `profile_urn` | string | yes | Profile URN ID |
| `message` | string | no | Personalized message (max 300 chars) |

---

#### `connections_received`
List received (pending) connection invitations.
```bash
linkedin connections received --count 50
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `count` | number | no | 100 | Number of invitations (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

#### `connections_sent`
List sent (pending) connection invitations.
```bash
linkedin connections sent
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `count` | number | no | 100 | Number of invitations (1-100) |
| `start` | number | no | 0 | Pagination offset |

---

#### `connections_accept`
Accept a connection invitation. Requires the invitation ID and shared secret (from the `connections received` response).
```bash
linkedin connections accept 12345 --secret abc123
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invitation_id` | string | yes | Invitation ID |
| `secret` | string | yes | Invitation shared secret |

---

#### `connections_reject`
Reject/ignore a connection invitation.
```bash
linkedin connections reject 12345 --secret abc123
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invitation_id` | string | yes | Invitation ID |
| `secret` | string | yes | Invitation shared secret |

---

#### `connections_withdraw`
Withdraw a pending sent connection request.
```bash
linkedin connections withdraw 12345
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invitation_id` | string | yes | Invitation ID to withdraw |

---

#### `connections_remove`
Remove an existing connection.
```bash
linkedin connections remove johndoe
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_id` | string | yes | Public profile identifier |

---

### Messaging Tools

#### `messaging_conversations`
List all messaging conversations.
```bash
linkedin messaging conversations
```
**Parameters:** None

---

#### `messaging_conversation-with`
Get the conversation with a specific person.
```bash
linkedin messaging conversation-with ACoAABxxxxxxx
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `profile_urn` | string | yes | Profile URN ID of the person |

---

#### `messaging_messages`
Get messages from a specific conversation.
```bash
linkedin messaging messages CONVERSATION_URN_ID
linkedin messaging messages CONVERSATION_URN_ID --before 1700000000000
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversation_id` | string | yes | Conversation URN ID |
| `before` | number | no | Timestamp (ms) for pagination — get messages before this time |

---

#### `messaging_send`
Send a message in an existing conversation.
```bash
linkedin messaging send CONVERSATION_URN_ID --text "Hello!"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversation_id` | string | yes | Conversation URN ID |
| `text` | string | yes | Message text |

---

#### `messaging_send-new`
Start a new conversation with one or more people.
```bash
linkedin messaging send-new --recipients ACoAABxxxxxxx --text "Hi there!"
linkedin messaging send-new --recipients ACoAABxxxxxxx,ACoAAByyyyyyy --text "Group message"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `recipients` | string | yes | Comma-separated profile URN IDs |
| `text` | string | yes | Message text |

---

#### `messaging_mark-read`
Mark a conversation as read.
```bash
linkedin messaging mark-read CONVERSATION_URN_ID
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversation_id` | string | yes | Conversation URN ID |

---

### Search Tools

#### `search_people`
Search for people with advanced filters.
```bash
linkedin search people --keywords "software engineer" --network F
linkedin search people --title "VP Sales" --company 1035 --geo 103644278
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `keywords` | string | no | — | Search keywords |
| `network` | enum | no | — | Connection depth: `F` (1st), `S` (2nd), `O` (3rd+) |
| `company` | string | no | — | Current company ID |
| `industry` | string | no | — | Industry ID |
| `school` | string | no | — | School ID |
| `title` | string | no | — | Title filter |
| `first_name` | string | no | — | First name filter |
| `last_name` | string | no | — | Last name filter |
| `geo` | string | no | — | Geographic region URN |
| `limit` | number | no | 10 | Results per page (max 49) |
| `start` | number | no | 0 | Pagination offset |

---

#### `search_companies`
Search for companies.
```bash
linkedin search companies --keywords "AI startups"
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `keywords` | string | yes | — | Search keywords |
| `limit` | number | no | 10 | Results per page (max 49) |
| `start` | number | no | 0 | Pagination offset |

---

#### `search_jobs`
Search for jobs with filters for experience, type, location, remote, and recency.
```bash
linkedin search jobs --keywords "product manager" --remote --experience 4
linkedin search jobs --keywords "engineer" --location "San Francisco" --job-type F
```
**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `keywords` | string | yes | — | Job search keywords |
| `location` | string | no | — | Location filter |
| `experience` | string | no | — | Level: `1`=Intern, `2`=Entry, `3`=Assoc, `4`=Mid, `5`=Dir, `6`=Exec |
| `job_type` | string | no | — | Type: `F`=Full, `C`=Contract, `P`=Part, `T`=Temp, `I`=Intern |
| `remote` | boolean | no | — | Filter for remote jobs |
| `posted_within` | string | no | — | Recency: `r86400`=24h, `r604800`=week, `r2592000`=month |
| `count` | number | no | 25 | Results per page (max 49) |
| `start` | number | no | 0 | Pagination offset |

---

#### `search_posts`
Keyword post search is **unavailable**. LinkedIn's CONTENT resultType on `voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0` returns HTTP 200 with only a `FeedbackCard`. No replacement content-search `queryId` has been verified from public sources (do not invent one).

For posts **by a known member**, use `profile posts` (`profileUpdatesV2`):
```bash
linkedin profile posts ACoAABxxxxxxx --limit 20
```
`search posts` exits with code `SEARCH_UNAVAILABLE` and the same guidance.

---

### Company Tools

#### `companies_view`
View a company profile.
```bash
linkedin companies view google
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `company_name` | string | yes | Company universal name (URL slug from their LinkedIn URL) |

---

#### `companies_follow`
Follow a company.
```bash
linkedin companies follow "urn:li:fs_followingInfo:12345"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `following_state_urn` | string | yes | Following state URN |

---

#### `companies_unfollow`
Unfollow a company or entity.
```bash
linkedin companies unfollow "urn:li:fs_followingInfo:12345"
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entity_urn` | string | yes | Entity URN to unfollow |

---

### Job Tools

#### `jobs_view`
Get details for a specific job posting.
```bash
linkedin jobs view 3456789012
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `job_id` | string | yes | Job posting ID |

---

#### `jobs_skills`
Get skill match insights for a job posting (how your skills match).
```bash
linkedin jobs skills 3456789012
```
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `job_id` | string | yes | Job posting ID |

---

### Analytics Tools

#### `analytics_profile-views`
Get "who viewed my profile" summary and view count.
```bash
linkedin analytics profile-views
```
**Parameters:** None

---

## Output Formats

All tools return JSON by default. Use these flags to control output:

```bash
linkedin profile me                     # Compact JSON (default)
linkedin profile me --pretty            # Pretty-printed JSON
linkedin profile me --fields "firstName,lastName,headline"  # Only specific fields
linkedin profile me --quiet             # No output, exit code only
```

## Rate Limiting

LinkedIn has aggressive rate limiting. The client automatically:
- Enforces minimum 1-second gaps between requests
- Retries on 429 (rate limit) and 5xx errors with exponential backoff
- Detects CAPTCHA/challenge pages and throws a clear error

For bulk operations, add your own delays between calls.

## Common URN Patterns

| Entity | URN Format | Example |
|--------|-----------|---------|
| Profile | `urn:li:fsd_profile:{id}` | `urn:li:fsd_profile:ACoAABxxxxxxx` |
| Activity | `urn:li:activity:{id}` | `urn:li:activity:7123456789` |
| Share | `urn:li:share:{id}` | `urn:li:share:7123456789` |
| Company | `urn:li:company:{id}` | `urn:li:company:1035` |
| Conversation | `urn:li:fs_conversation:{id}` | `urn:li:fs_conversation:abc123` |
| Invitation | `urn:li:invitation:{id}` | `urn:li:invitation:12345` |
