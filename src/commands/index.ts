import { Command } from 'commander';
import type { CommandDefinition, GlobalOptions, LinkedInClient } from '../core/types.js';
import { resolveAuth } from '../core/auth.js';
import { createClient } from '../core/client.js';
import { output, outputError } from '../core/output.js';
import { registerLoginCommand, registerLogoutCommand, registerStatusCommand } from './auth/login.js';
import { registerMcpCommand } from './mcp/index.js';

// Import all command groups
import { profileCommands } from './profile/view.js';
import { postsCommands } from './posts/create.js';
import { feedCommands } from './feed/feed.js';
import { engageCommands } from './engage/engage.js';
import { connectionsCommands } from './connections/connections.js';
import { messagingCommands } from './messaging/messaging.js';
import { searchCommands } from './search/search.js';
import { companiesCommands } from './companies/companies.js';
import { jobsCommands } from './jobs/jobs.js';
import { analyticsCommands } from './analytics/analytics.js';

export const allCommands: CommandDefinition[] = [
  ...profileCommands,
  ...postsCommands,
  ...feedCommands,
  ...engageCommands,
  ...connectionsCommands,
  ...messagingCommands,
  ...searchCommands,
  ...companiesCommands,
  ...jobsCommands,
  ...analyticsCommands,
];

export function registerAllCommands(program: Command): void {
  // Special commands (auth, MCP)
  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerStatusCommand(program);
  registerMcpCommand(program);

  // Group commands by their `group` field
  const groups = new Map<string, CommandDefinition[]>();
  for (const cmd of allCommands) {
    if (!groups.has(cmd.group)) groups.set(cmd.group, []);
    groups.get(cmd.group)!.push(cmd);
  }

  // Register each group as a subcommand
  for (const [groupName, commands] of groups) {
    const groupCmd = program
      .command(groupName)
      .description(`Manage ${groupName}`);

    for (const cmdDef of commands) {
      registerCommand(groupCmd, cmdDef);
    }

    groupCmd.on('command:*', (operands: string[]) => {
      const available = commands.map((c) => c.subcommand).join(', ');
      console.error(`error: unknown command '${operands[0]}' for '${groupName}'`);
      console.error(`Available commands: ${available}`);
      process.exitCode = 1;
    });
  }
}

function registerCommand(parent: Command, cmdDef: CommandDefinition): void {
  const cmd = parent
    .command(cmdDef.subcommand)
    .description(cmdDef.description);

  // Register positional arguments
  if (cmdDef.cliMappings.args) {
    for (const arg of cmdDef.cliMappings.args) {
      const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
      cmd.argument(argStr, arg.field);
    }
  }

  // Register options
  if (cmdDef.cliMappings.options) {
    for (const opt of cmdDef.cliMappings.options) {
      cmd.option(opt.flags, opt.description ?? '');
    }
  }

  // Add examples
  if (cmdDef.examples?.length) {
    cmd.addHelpText('after', '\nExamples:\n' + cmdDef.examples.map((e) => `  $ ${e}`).join('\n'));
  }

  // Action handler
  cmd.action(async (...actionArgs: any[]) => {
    try {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions & Record<string, any>;

      if (globalOpts.pretty) {
        globalOpts.output = 'pretty';
      }

      // Resolve auth and create client
      const auth = await resolveAuth({
        liAt: globalOpts.liAt,
        jsessionid: globalOpts.jsessionid,
        fromChrome: globalOpts.fromChrome,
        chromeProfile: globalOpts.chromeProfile,
      });
      const client = createClient(auth);

      // Build input from positional args + options
      const input: Record<string, any> = {};

      if (cmdDef.cliMappings.args) {
        for (let i = 0; i < cmdDef.cliMappings.args.length; i++) {
          if (actionArgs[i] !== undefined) {
            input[cmdDef.cliMappings.args[i].field] = actionArgs[i];
          }
        }
      }

      if (cmdDef.cliMappings.options) {
        for (const opt of cmdDef.cliMappings.options) {
          const match = opt.flags.match(/--([a-z-]+)/);
          if (match) {
            const optName = match[1].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
            if (globalOpts[optName] !== undefined) {
              input[opt.field] = globalOpts[optName];
            }
          }
        }
      }

      // Validate input
      const parsed = cmdDef.inputSchema.safeParse(input);
      if (!parsed.success) {
        const issues = (parsed as any).error?.issues ?? [];
        const missing = issues
          .filter((i: any) => i.code === 'invalid_type' && String(i.message).includes('Required'))
          .map((i: any) => '--' + String(i.path?.[0] ?? '').replace(/_/g, '-'));
        if (missing.length > 0) {
          throw new Error(`Missing required option(s): ${missing.join(', ')}`);
        }
        const msg = issues.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Invalid input: ${msg}`);
      }

      // Execute handler
      const result = await cmdDef.handler(parsed.data, client);
      output(result, globalOpts);
    } catch (error) {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      outputError(error, globalOpts);
    }
  });
}
