import { Command } from 'commander';
import { saveConfig } from '../../core/config.js';
import { createClient } from '../../core/client.js';
import { output, outputError } from '../../core/output.js';
import { resolveAuth, wantsFromChrome } from '../../core/auth.js';
import type { GlobalOptions, LinkedInAuth } from '../../core/types.js';

function sessionInvalidReason(err: { code?: string; statusCode?: number; message?: string }): string | null {
  if (err?.code === 'AUTH_ERROR' || err?.statusCode === 401) {
    return 'Session cookies expired. Run: linkedin login';
  }
  if (err?.code === 'CHALLENGE_ERROR') {
    return err.message ?? 'LinkedIn requires a CAPTCHA or verification challenge. Try refreshing your cookie session.';
  }
  return null;
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Store your LinkedIn session cookies (li_at + JSESSIONID) for CLI use')
    .option('--li-at <cookie>', 'li_at cookie value (from browser DevTools)')
    .option('--jsessionid <cookie>', 'JSESSIONID cookie value (from browser DevTools)')
    .option('--from-chrome', 'Read cookies from a Chrome profile on this local machine (macOS/Linux)')
    .option('--chrome-profile <name>', 'Chrome profile directory name (default: Default)')
    .option('--skip-validation', 'Save cookies without verifying them against LinkedIn')
    .action(async function (this: Command) {
      const localOpts = this.opts() as Record<string, string | boolean | undefined>;
      const globalOpts = this.optsWithGlobals() as GlobalOptions & Record<string, string | boolean | undefined>;

      try {
        let liAt = (localOpts.liAt ?? globalOpts.liAt) as string | undefined;
        let jsessionid = (localOpts.jsessionid ?? globalOpts.jsessionid) as string | undefined;
        const skipValidation = localOpts.skipValidation as boolean | undefined;
        const fromChrome = wantsFromChrome({
          fromChrome: Boolean(localOpts.fromChrome ?? globalOpts.fromChrome),
          chromeProfile: (localOpts.chromeProfile ?? globalOpts.chromeProfile) as string | undefined,
        });
        let chromeAuth: LinkedInAuth | undefined;

        if (fromChrome) {
          chromeAuth = await resolveAuth({
            fromChrome: true,
            chromeProfile: (localOpts.chromeProfile ?? globalOpts.chromeProfile) as string | undefined,
          });
          liAt = chromeAuth.liAt;
          jsessionid = chromeAuth.jsessionid;
        }

        // Interactive mode if cookies not provided as flags and not reading Chrome
        if (!fromChrome && (!liAt || !jsessionid)) {
          const { input: promptInput } = await import('@inquirer/prompts');

          if (!liAt) {
            liAt = await promptInput({
              message: 'Paste your li_at cookie value (from browser DevTools → Application → Cookies → linkedin.com):',
            });
          }
          if (!jsessionid) {
            jsessionid = await promptInput({
              message: 'Paste your JSESSIONID cookie value (include the quotes if present):',
            });
          }
        }

        if (!liAt || !jsessionid) {
          throw new Error('Both li_at and JSESSIONID cookies are required');
        }

        // Clean up JSESSIONID (remove surrounding quotes if present)
        jsessionid = jsessionid.replace(/^"/, '').replace(/"$/, '');

        // Save cookies FIRST — before any validation. Never print cookie values.
        await saveConfig({
          li_at: liAt,
          jsessionid,
        });

        // Optionally validate by fetching /me
        if (!skipValidation) {
          try {
            const client = createClient(
              chromeAuth ?? { liAt, jsessionid },
            );
            const me = await client.get<any>('/me');
            const profileName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || 'Unknown';
            const profileUrn = me?.entityUrn ?? me?.publicIdentifier ?? '';

            // Update config with profile info
            await saveConfig({
              li_at: liAt,
              jsessionid,
              profile_name: profileName,
              profile_urn: profileUrn,
            });

            output({
              message: fromChrome
                ? 'Login successful (cookies imported from Chrome)'
                : 'Login successful',
              profile: profileName,
              urn: profileUrn,
              config: '~/.linkedin-cli/config.json',
              validated: true,
            }, globalOpts);
          } catch (validationErr: any) {
            // Cookies saved but validation failed — warn, don't fail
            output({
              message: 'Cookies saved but validation failed — they may still work',
              warning: validationErr?.message ?? String(validationErr),
              hint: 'Default Node fetch is often fingerprinted. On this local machine, retry with LINKEDIN_HTTP=curl-impersonate or --from-chrome.',
              config: '~/.linkedin-cli/config.json',
              validated: false,
            }, globalOpts);
          }
        } else {
          output({
            message: 'Cookies saved (validation skipped)',
            config: '~/.linkedin-cli/config.json',
            validated: false,
          }, globalOpts);
        }
      } catch (error) {
        outputError(error, globalOpts);
      }
    });
}

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Remove stored LinkedIn session cookies')
    .action(async () => {
      const globalOpts = program.optsWithGlobals() as GlobalOptions;
      try {
        const { deleteConfig } = await import('../../core/config.js');
        await deleteConfig();
        output({ message: 'Logged out. Session cookies removed.' }, globalOpts);
      } catch (error) {
        outputError(error, globalOpts);
      }
    });
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check current login status (reads config only, use --verify to check session live)')
    .option('--verify', 'Make an API call to verify the session is still valid')
    .action(async function (this: Command) {
      const localOpts = this.opts() as Record<string, boolean | undefined>;
      const globalOpts = this.optsWithGlobals() as GlobalOptions;
      try {
        const { loadConfig } = await import('../../core/config.js');
        const config = await loadConfig();
        const fromChrome = wantsFromChrome({
          fromChrome: globalOpts.fromChrome,
          chromeProfile: globalOpts.chromeProfile,
        });
        const hasManual = Boolean(
          (globalOpts.liAt && globalOpts.jsessionid) ||
            (process.env.LINKEDIN_LI_AT && process.env.LINKEDIN_JSESSIONID) ||
            (config?.li_at && config?.jsessionid),
        );

        if (!fromChrome && !hasManual) {
          output({ logged_in: false, message: 'No session cookies stored. Run: linkedin login' }, globalOpts);
          return;
        }

        const source = fromChrome ? 'chrome' : globalOpts.liAt || process.env.LINKEDIN_LI_AT ? 'env-or-flag' : 'config';

        // Default: just show what's stored, no API call
        if (!localOpts.verify) {
          output({
            logged_in: true,
            source,
            profile: config?.profile_name || 'Unknown',
            urn: config?.profile_urn || '',
            config: '~/.linkedin-cli/config.json',
            note: 'Use --verify to check if session is still valid',
          }, globalOpts);
          return;
        }

        // --verify: make a live API call. Use resolveAuth so --from-chrome /
        // LINKEDIN_FROM_CHROME / env vars are honored, not just the config file.
        const auth = await resolveAuth({
          liAt: globalOpts.liAt,
          jsessionid: globalOpts.jsessionid,
          fromChrome: globalOpts.fromChrome,
          chromeProfile: globalOpts.chromeProfile,
        });
        const client = createClient(auth);
        try {
          const me = await client.get<any>('/me');
          const name = [me?.firstName, me?.lastName].filter(Boolean).join(' ');
          output({
            logged_in: true,
            source,
            profile: name || config?.profile_name || 'Unknown',
            urn: me?.entityUrn || config?.profile_urn,
            session_valid: true,
          }, globalOpts);
        } catch (err: any) {
          const authMessage = sessionInvalidReason(err);
          if (authMessage) {
            output({
              logged_in: true,
              source,
              profile: config?.profile_name || 'Unknown',
              session_valid: false,
              message: authMessage,
            }, globalOpts);
          } else {
            output({
              logged_in: true,
              source,
              profile: config?.profile_name || 'Unknown',
              session_valid: 'unknown',
              message: `Could not verify session: ${err?.message ?? err}`,
            }, globalOpts);
          }
        }
      } catch (error) {
        outputError(error, globalOpts);
      }
    });
}
