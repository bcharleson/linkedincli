# linkedincli

Full LinkedIn platform management from your terminal. 43 commands for profiles, posts, messaging, connections, search, feed, engagement, and more — powered by cookie session auth.

Works as a **CLI** and an **MCP server** (for Claude Code, Cursor, Windsurf, and other AI agents).

## Install

```bash
# Install globally
npm install -g @bcharleson/linkedincli

# This installs the `linkedin` command:
linkedin --help

# Or run without installing
npx @bcharleson/linkedincli --help
```

> **Note:** The npm package is `@bcharleson/linkedincli` but the CLI command is just **`linkedin`**.

## Sessions keep getting killed?

Default Node `fetch` has a TLS/JA3 fingerprint that is not Chrome. LinkedIn often detects that and **invalidates `li_at` on the first Voyager call** (issue [#1](https://github.com/bcharleson/linkedincli/issues/1)). Manual `li_at` + `JSESSIONID` paste still works for some accounts, but is the fragile path.

Two **opt-in** workarounds (default transport remains Node `fetch`):

1. **`LINKEDIN_HTTP=curl-impersonate`** — shell out to `curl_chrome123` so the TLS ClientHello matches Chrome.
2. **`--from-chrome` / `LINKEDIN_FROM_CHROME=1`** — read the full `linkedin.com` cookie jar from a local Chrome profile (not just the two auth tokens).

Use them together when possible.

### Install curl-impersonate

The transport looks for `curl_chrome123` on `PATH` (override with `LINKEDIN_CURL_IMPERSONATE_BIN`).

```bash
# Nix
nix profile install nixpkgs#curl-impersonate-chrome

# Homebrew
brew install curl-impersonate

# Confirm the binary exists
curl_chrome123 --version
export LINKEDIN_HTTP=curl-impersonate
```

If the binary is named differently on your platform, point at it:

```bash
export LINKEDIN_CURL_IMPERSONATE_BIN=/usr/local/bin/curl_chrome123
export LINKEDIN_HTTP=curl-impersonate
```

## Quick Start

### Option A — Read cookies from Chrome (recommended on macOS/Linux)

If you are already logged into LinkedIn in Chrome, the CLI can decrypt cookies from the local profile. This sends the full cookie jar (not just `li_at` + `JSESSIONID`), which matches a real browser more closely.

```bash
# macOS will prompt to unlock Keychain ("Chrome Safe Storage") the first time.
# Requires the `sqlite3` CLI (preinstalled on macOS; `sudo apt install sqlite3` on Linux).
linkedin --from-chrome profile me --pretty

# Or persist the two auth tokens into ~/.linkedin-cli/config.json
linkedin login --from-chrome

# Non-default Chrome profile
linkedin --from-chrome --chrome-profile "Profile 1" status --verify
```

Environment equivalents: `LINKEDIN_FROM_CHROME=1`, `LINKEDIN_CHROME_PROFILE=Default`. Optional: `LINKEDIN_CHROME_USER_DATA_DIR` to point at a custom user-data directory (Chrome/Chromium).

Windows is not supported for `--from-chrome` (Chrome 127+ App-Bound Encryption).

Cookie values are never printed to stdout/stderr.

### Option B — Paste cookies manually

Open LinkedIn in your browser → DevTools (`F12`) → Application → Cookies → `linkedin.com`

Copy these two values:
- **`li_at`** — your session token (long string starting with `AQED...`)
- **`JSESSIONID`** — your session ID (starts with `ajax:`)

```bash
linkedin login
# Paste your li_at and JSESSIONID when prompted
```

Or non-interactively:

```bash
linkedin login --li-at "AQEDxxxxxxx" --jsessionid "ajax:1234567890"
```

Manual paste + default Node fetch may still get the session killed. Prefer Option A plus `LINKEDIN_HTTP=curl-impersonate`.

### Use it

```bash
# View your profile
linkedin profile me --pretty

# Create a post
linkedin posts create --text "Hello LinkedIn! Posted from my terminal."

# Search for people
linkedin search people --keywords "software engineer" --network F --pretty

# Check your messages
linkedin messaging conversations --pretty

# React to a post
linkedin engage react 7123456789 --type LIKE
```

## All Commands

### Profile (9 commands)

```bash
linkedin profile me                           # Your own profile
linkedin profile view <public-id>             # View any profile
linkedin profile contact-info <public-id>     # Email, phone, websites
linkedin profile skills <public-id>           # List skills
linkedin profile network <public-id>          # Connections, followers, distance
linkedin profile badges <public-id>           # Premium, influencer, etc.
linkedin profile privacy <public-id>          # Privacy settings
linkedin profile posts <urn-id>               # Recent posts by a user
linkedin profile disconnect <public-id>       # Remove a connection
```

### Posts (3 commands)

```bash
linkedin posts create --text "My post"                     # Text post
linkedin posts create --text "With image" --image ./pic.jpg  # Image post
linkedin posts create --text "Inner circle" --visibility connections
linkedin posts edit <share-urn> --text "Updated text"      # Edit a post
linkedin posts delete <share-urn>                          # Delete a post
```

### Feed (3 commands)

```bash
linkedin feed view                            # Your feed (chronological)
linkedin feed view --count 50                 # More items
linkedin feed user <profile-id>               # Someone's activity
linkedin feed company <company-name>          # Company updates
```

### Engagement (5 commands)

```bash
linkedin engage react <post-urn> --type LIKE          # Like
linkedin engage react <post-urn> --type PRAISE        # Celebrate
linkedin engage react <post-urn> --type EMPATHY       # Love
linkedin engage react <post-urn> --type INTEREST      # Insightful
linkedin engage react <post-urn> --type ENTERTAINMENT # Funny
linkedin engage react <post-urn> --type APPRECIATION  # Support

linkedin engage comment <post-urn> --text "Great post!"
linkedin engage comments-list <post-urn>
linkedin engage reactions <post-urn>
linkedin engage share <share-urn> --text "Worth reading"
```

### Connections (7 commands)

```bash
linkedin connections send <profile-urn>                     # Send request
linkedin connections send <profile-urn> -m "Let's connect!" # With message
linkedin connections received                               # Pending received
linkedin connections sent                                   # Pending sent
linkedin connections accept <id> --secret <secret>          # Accept
linkedin connections reject <id> --secret <secret>          # Reject
linkedin connections withdraw <id>                          # Withdraw sent
linkedin connections remove <public-id>                     # Unfriend
```

### Messaging (6 commands)

```bash
linkedin messaging conversations                        # All conversations
linkedin messaging conversation-with <profile-urn>      # With specific person
linkedin messaging messages <conversation-id>           # Read messages
linkedin messaging send <conversation-id> -t "Hello!"   # Reply
linkedin messaging send-new -r <urn1>,<urn2> -t "Hi!"   # New conversation
linkedin messaging mark-read <conversation-id>          # Mark as read
```

### Search (4 commands)

```bash
linkedin search people --keywords "CTO" --network F         # 1st connections
linkedin search people --keywords "engineer" --company 1035 # At a company
linkedin search people --title "VP Sales" --geo 103644278   # By region
linkedin search companies --keywords "AI startups"
linkedin search jobs --keywords "engineer" --remote --experience 4
# search posts is unavailable (LinkedIn CONTENT SRP). Use profile posts for a known author:
linkedin profile posts ACoAABxxxxxxx --limit 20
```

### Companies (3 commands)

```bash
linkedin companies view <company-name>                  # Company info
linkedin companies follow <following-state-urn>         # Follow
linkedin companies unfollow <entity-urn>                # Unfollow
```

### Jobs (2 commands)

```bash
linkedin jobs view <job-id>                  # Job details
linkedin jobs skills <job-id>                # Skill match insights
```

### Analytics (1 command)

```bash
linkedin analytics profile-views             # Who viewed your profile
```

## Global Options

Every command supports these flags:

| Flag | Description |
|------|-------------|
| `--li-at <cookie>` | Override li_at cookie |
| `--jsessionid <cookie>` | Override JSESSIONID cookie |
| `--from-chrome` | Read cookies from a local Chrome profile |
| `--chrome-profile <name>` | Chrome profile directory (default: `Default`) |
| `--output pretty` | Pretty-printed JSON |
| `--pretty` | Shorthand for `--output pretty` |
| `--quiet` | No output, exit codes only |
| `--fields <list>` | Comma-separated fields to include |

## Environment Variables

```bash
export LINKEDIN_LI_AT="your_li_at_cookie"
export LINKEDIN_JSESSIONID="your_jsessionid_cookie"

# Opt-in: avoid Node fetch TLS fingerprint (requires curl_chrome123)
export LINKEDIN_HTTP=curl-impersonate
# export LINKEDIN_CURL_IMPERSONATE_BIN=/path/to/curl_chrome123

# Opt-in: read the full LinkedIn cookie jar from Chrome
export LINKEDIN_FROM_CHROME=1
# export LINKEDIN_CHROME_PROFILE="Profile 1"
```

Auth resolution order: `--from-chrome` / `LINKEDIN_FROM_CHROME` → `--li-at`/`--jsessionid` flags → env vars → `~/.linkedin-cli/config.json`

`linkedin status --verify` now classifies LinkedIn 3xx login/challenge redirects as `session_valid: false` with an auth message instead of a generic network error.

## MCP Server (AI Agents)

All 43 commands are available as MCP tools for Claude Code, Cursor, Windsurf, and other AI agents.

### Claude Code / Cursor / Windsurf

Add to your MCP config:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "linkedin",
      "args": ["mcp"],
      "env": {
        "LINKEDIN_LI_AT": "your_li_at_cookie",
        "LINKEDIN_JSESSIONID": "your_jsessionid_cookie",
        "LINKEDIN_HTTP": "curl-impersonate"
      }
    }
  }
}
```

Or if using `npx`:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "@bcharleson/linkedincli", "mcp"]
    }
  }
}
```

Then your AI agent can manage your entire LinkedIn presence — create posts, respond to messages, manage connections, search for people, and more.

## Cookie Expiration

LinkedIn `li_at` cookies expire periodically (usually every few weeks). They can also be invalidated immediately when the client TLS fingerprint does not look like Chrome. When your session expires:

```bash
linkedin status --verify    # Check if session is valid
linkedin login --from-chrome
# or: linkedin login
```

## Search posts limitation

`linkedin search posts` is **not available**. LinkedIn's CONTENT resultType on `voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0` still returns HTTP 200 but `included[]` is only a `FeedbackCard` (issue [#2](https://github.com/bcharleson/linkedincli/issues/2)). People and company search on the same queryId still work. A replacement content-search `queryId` has not been verified from public/in-repo sources, so this CLI does not invent one.

For posts **by a specific member**, use `profile posts` (`identity/profileUpdatesV2`):

```bash
linkedin profile posts <urn-id> --limit 20
```

## Disclaimer

This tool uses LinkedIn's internal Voyager API via cookie session authentication. It is not affiliated with or endorsed by LinkedIn. Use responsibly and in compliance with LinkedIn's terms of service. The authors are not responsible for any account restrictions that may result from automated usage.

## License

MIT
