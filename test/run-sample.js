/**
 * Local test runner — feeds the sample diff directly into Refract's
 * orchestrator so you can test without a real GitHub PR.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node test/run-sample.js
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { orchestrate } from '../src/core/orchestrator.js';
import { loadConfig } from '../src/core/config.js';
import { renderVerdict, renderProgress } from '../src/output/renderer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Generate diff from sample files
// git diff --no-index exits with code 1 when files differ — that's expected, not an error
let diff = '';
try {
  diff = execSync(
    'git diff --no-index test/sample/before.js test/sample/after.js',
    { cwd: join(__dirname, '..'), encoding: 'utf8' }
  );
} catch (e) {
  diff = e.stdout ?? '';
}

if (!diff) {
  console.error('Could not generate diff from sample files.');
  process.exit(1);
}

const meta = {
  title: 'feat: refactor auth routes with user enrichment',
  additions: 79,
  deletions: 6,
  changedFiles: 1,
  branch: 'feat/auth-refactor',
};

const config = loadConfig(join(__dirname, '..'));

const isMock = process.argv.includes('--mock') || !process.env.ANTHROPIC_API_KEY;

if (isMock) {
  console.log('\n  ⚠  Mock mode — no API key detected, using simulated responses\n');
} else {
  console.log('\n  Starting Refract local test (live API)...\n');
}

const result = await orchestrate({
  diff,
  meta,
  config,
  onProgress: renderProgress,
  mock: isMock,
});

renderVerdict({
  verdict: result.verdict,
  agentResults: result.agentResults,
  meta: result.meta,
});
