import { Command } from 'commander';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the LinkedIn MCP server (stdio transport)')
    .addHelpText(
      'after',
      `
Run this MCP server on a local harness only (your computer / Mac mini).
Cloud agents and Grok Bot may install the CLI or call this local MCP —
they must not hold cookies or originate Voyager calls.

Local Claude Code / Cursor / Windsurf config:

  {
    "mcpServers": {
      "linkedin": {
        "command": "npx",
        "args": ["-y", "@bcharleson/linkedincli", "mcp"],
        "env": {
          "LINKEDIN_LI_AT": "your_li_at_cookie",
          "LINKEDIN_JSESSIONID": "your_jsessionid_cookie",
          "LINKEDIN_HTTP": "curl-impersonate"
        }
      }
    }
  }

Or if installed globally on the local machine:

  {
    "mcpServers": {
      "linkedin": {
        "command": "linkedin",
        "args": ["mcp"]
      }
    }
  }
`,
    )
    .action(async () => {
      const { startMcpServer } = await import('../../mcp/server.js');
      await startMcpServer();
    });
}
