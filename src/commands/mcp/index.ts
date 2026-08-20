import { Command } from 'commander';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the LinkedIn MCP server (stdio transport)')
    .addHelpText(
      'after',
      `
Configuration for Claude Code / Cursor / Windsurf:

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

Or if installed globally:

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
