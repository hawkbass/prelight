#!/usr/bin/env node
/**
 * `prelight` CLI entry point.
 *
 * Usage:
 *   prelight                   # load prelight.config.{ts,mts,js,mjs}, run all tests
 *   prelight --reporter json   # machine-readable output on stdout
 *   prelight --fail-fast       # stop at first failing test
 *
 * Exit codes:
 *   0 — all verifications passed
 *   1 — one or more verifications failed
 *   2 — configuration error (missing config, invalid shape)
 *   3 — unexpected runtime error
 */

import { autoPalette } from './color.js';
import { findConfig, loadConfig } from './config.js';
import { runVerification } from './runner.js';
import { createTerminalReporter, jsonReport } from './reporter.js';

interface Args {
  reporter: 'terminal' | 'json';
  failFast: boolean;
  configPath: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { reporter: 'terminal', failFast: false, configPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--reporter') {
      const v = argv[++i];
      if (v !== 'terminal' && v !== 'json') {
        throw new Error(`unknown reporter "${v ?? ''}"`);
      }
      args.reporter = v;
    } else if (a === '--fail-fast') {
      args.failFast = true;
    } else if (a === '--config') {
      args.configPath = argv[++i] ?? null;
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: prelight [--reporter terminal|json] [--fail-fast] [--config path]');
      process.exit(0);
    } else if (a === '--version' || a === '-v') {
      console.log('prelight 0.0.0');
      process.exit(0);
    } else {
      throw new Error(`unknown argument "${a}"`);
    }
  }
  return args;
}

export async function main(argv: string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`prelight: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }

  const configPath = args.configPath ?? findConfig(process.cwd());
  if (!configPath) {
    console.error(
      'prelight: no config found. Create prelight.config.ts in your project root, or pass --config <path>.',
    );
    return 2;
  }

  let config;
  try {
    config = await loadConfig(configPath);
  } catch (e) {
    console.error(`prelight: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  if (args.failFast) config.failFast = true;

  const summary = await runVerification(config);

  if (args.reporter === 'json') {
    process.stdout.write(JSON.stringify(jsonReport(summary), null, 2) + '\n');
  } else {
    const reporter = createTerminalReporter(autoPalette(process.stderr));
    process.stderr.write(reporter.summary(summary) + '\n');
  }

  return summary.ok ? 0 : 1;
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  import.meta.url.startsWith('file:') &&
  (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'));

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('prelight: unexpected error');
      console.error(err);
      process.exit(3);
    });
}
