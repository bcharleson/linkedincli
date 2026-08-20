import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerAllCommands } from './commands/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('linkedin')
  .description('CLI and MCP server for LinkedIn — full platform management via cookie session auth')
  .version(pkg.version)
  .option('--li-at <cookie>', 'li_at cookie (overrides LINKEDIN_LI_AT env var and stored config)')
  .option('--jsessionid <cookie>', 'JSESSIONID cookie (overrides LINKEDIN_JSESSIONID env var and stored config)')
  .option('--from-chrome', 'Read session cookies from a Chrome profile on this local machine (macOS/Linux)')
  .option('--chrome-profile <name>', 'Chrome profile directory name (default: Default)')
  .option('--output <format>', 'Output format: json (default) or pretty', 'json')
  .option('--pretty', 'Shorthand for --output pretty')
  .option('--quiet', 'Suppress output, exit codes only')
  .option('--fields <fields>', 'Comma-separated list of fields to include in output');

registerAllCommands(program);

program.parse();
