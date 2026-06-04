#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getDiff } from './core/diff.js';
import { orchestrate } from './core/orchestrator.js';
import { loadConfig } from './core/config.js';
import { renderVerdict, renderProgress } from './output/renderer.js';
import { postToGitHub } from './output/github.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

program
  .name('refract')
  .description('Multi-agent AI code review — every PR through multiple expert lenses')
  .version(pkg.version);

program
  .command('review')
  .description('Review a PR or local diff')
  .option('-p, --pr <number>', 'GitHub PR number to review')
  .option('-b, --base <branch>', 'Base branch/commit for diff (e.g. main)')
  .option('--head <branch>', 'Head branch/commit for diff')
  .option('--post', 'Post results as GitHub PR comments')
  .option('--repo <owner/repo>', 'GitHub repo (defaults to current repo)')
  .option('--json', 'Output raw JSON instead of formatted output')
  .option('--mock', 'Run with mock responses (no API key needed — for testing)')
  .option('--config <path>', 'Path to config file (default: .refract.json)')
  .action(async (opts) => {
    if (!opts.mock && !process.env.ANTHROPIC_API_KEY) {
      console.error(chalk.red('\n  ✗ ANTHROPIC_API_KEY environment variable is not set.'));
      console.error(chalk.dim('  Create a .env file, export the variable, or use --mock to test without an API key.\n'));
      process.exit(1);
    }

    const config = loadConfig(opts.config ? dirname(opts.config) : process.cwd());
    const spinner = ora({ text: 'Fetching diff...', color: 'cyan' }).start();

    let diffData;
    try {
      diffData = await getDiff({ pr: opts.pr, base: opts.base, head: opts.head });
      spinner.succeed(chalk.dim('Diff loaded'));
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }

    console.log();

    if (opts.mock) {
      console.log(chalk.dim('  ⚠  Mock mode — responses are simulated, no API key used\n'));
    }

    let reviewResult;
    try {
      reviewResult = await orchestrate({
        diff: diffData.diff,
        meta: diffData.meta,
        config,
        onProgress: renderProgress,
        mock: !!opts.mock,
      });
    } catch (err) {
      console.error(chalk.red('\n  ✗ Review failed: ' + err.message));
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(reviewResult, null, 2));
    } else {
      renderVerdict({
        verdict: reviewResult.verdict,
        agentResults: reviewResult.agentResults,
        meta: reviewResult.meta,
      });
    }

    if (opts.post && opts.pr) {
      const postSpinner = ora('Posting to GitHub...').start();
      try {
        await postToGitHub({ prNumber: opts.pr, verdict: reviewResult.verdict, repo: opts.repo });
        postSpinner.succeed('Posted to GitHub PR');
      } catch (err) {
        postSpinner.fail('Could not post to GitHub: ' + err.message);
      }
    }

    if (reviewResult.verdict?.verdict === 'BLOCK') process.exit(1);
  });

program
  .command('agents')
  .description('List available agents and their status')
  .action(() => {
    const config = loadConfig();
    console.log('\n  Available Agents\n');
    const agents = [
      { name: 'security',     emoji: '🔐', desc: 'Finds security vulnerabilities' },
      { name: 'performance',  emoji: '⚡', desc: 'Spots performance bottlenecks' },
      { name: 'logic',        emoji: '🐛', desc: 'Catches bugs and logic errors' },
      { name: 'architecture', emoji: '🏗️',  desc: 'Reviews design and structure' },
      { name: 'tests',        emoji: '🧪', desc: 'Checks test coverage gaps' },
      { name: 'judge',        emoji: '⚖️',  desc: 'Synthesizes all findings' },
    ];
    for (const a of agents) {
      const enabled = config.agents[a.name]?.enabled !== false;
      const status = enabled ? chalk.green('enabled ') : chalk.dim('disabled');
      console.log(`  ${a.emoji}  ${chalk.bold(a.name.padEnd(14))} ${status}  ${chalk.dim(a.desc)}`);
    }
    console.log();
  });

program.parse();
