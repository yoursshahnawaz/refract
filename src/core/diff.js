import { execSync } from 'child_process';
import simpleGit from 'simple-git';

/**
 * Get the diff for a PR or the current staged changes.
 * Supports:
 *   - Local git diff (staged or last commit)
 *   - GitHub PR number (fetches via gh CLI)
 */
export async function getDiff({ pr, base, head, cwd = process.cwd() } = {}) {
  if (pr) return getDiffFromPR(pr);
  return getDiffFromGit({ base, head, cwd });
}

async function getDiffFromPR(prNumber) {
  try {
    const diff = execSync(`gh pr diff ${prNumber}`, { encoding: 'utf8' });
    const meta = JSON.parse(
      execSync(
        `gh pr view ${prNumber} --json title,body,author,additions,deletions,changedFiles`,
        { encoding: 'utf8' }
      )
    );
    return { diff, meta };
  } catch (err) {
    throw new Error(`Failed to fetch PR #${prNumber}: ${err.message}`);
  }
}

async function getDiffFromGit({ base, head, cwd }) {
  const git = simpleGit(cwd);

  let diff;
  if (base && head) {
    diff = await git.diff([`${base}...${head}`]);
  } else if (base) {
    diff = await git.diff([`${base}...HEAD`]);
  } else {
    diff = await git.diff(['--cached']);
    if (!diff) diff = await git.diff(['HEAD~1', 'HEAD']);
  }

  if (!diff) throw new Error('No diff found. Stage some changes or specify --base.');

  const status = await git.status();
  const meta = {
    title: 'Local review',
    branch: status.current,
    additions: (diff.match(/^\+[^+]/gm) || []).length,
    deletions: (diff.match(/^-[^-]/gm) || []).length,
  };

  return { diff, meta };
}

/**
 * Parse a unified diff into structured file hunks.
 */
export function parseDiff(rawDiff) {
  const files = [];
  let current = null;

  for (const line of rawDiff.split('\n')) {
    if (line.startsWith('diff --git')) {
      if (current) files.push(current);
      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      current = { path: match?.[2] ?? 'unknown', hunks: [], raw: '' };
    } else if (current) {
      current.raw += line + '\n';
      if (line.startsWith('@@')) {
        current.hunks.push({ header: line, lines: [] });
      } else if (current.hunks.length > 0) {
        current.hunks.at(-1).lines.push(line);
      }
    }
  }

  if (current) files.push(current);
  return files;
}
