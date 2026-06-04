import { execSync } from 'child_process';

/**
 * Posts inline comments and a summary comment to a GitHub PR.
 */
export async function postToGitHub({ prNumber, verdict, repo }) {
  if (!prNumber) return;

  const findings = (verdict.findings ?? []).filter(
    (f) => f.confidence >= 0.75 && f.file && f.line
  );

  const repoFlag = repo ? `--repo ${repo}` : '';

  for (const f of findings) {
    const body = formatInlineComment(f);
    try {
      execSync(
        `gh api repos/{owner}/{repo}/pulls/${prNumber}/comments \
          -f body=${JSON.stringify(body)} \
          -f commit_id=$(gh pr view ${prNumber} --json headRefOid -q .headRefOid) \
          -f path=${JSON.stringify(f.file)} \
          -F line=${f.line} \
          -f side=RIGHT \
          ${repoFlag}`,
        { encoding: 'utf8' }
      );
    } catch {
      // Inline comment failed (line not in diff) — skip silently
    }
  }

  const summaryBody = formatSummaryComment(verdict);
  try {
    execSync(
      `gh pr comment ${prNumber} --body ${JSON.stringify(summaryBody)} ${repoFlag}`,
      { encoding: 'utf8' }
    );
  } catch (err) {
    console.warn('Could not post summary comment:', err.message);
  }
}

function formatInlineComment(f) {
  const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[f.severity] ?? '⚪';
  const quorum = f.quorum ? ' _(confirmed by multiple agents)_' : '';
  return [
    `**${icon} Refract — ${f.severity.toUpperCase()}**${quorum}`,
    '',
    f.description,
    '',
    f.suggestion ? `> **Suggestion:** ${f.suggestion}` : '',
    '',
    `_Confidence: ${Math.round(f.confidence * 100)}% · Agents: ${(f.agents ?? []).join(', ')}_`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

function formatSummaryComment(verdict) {
  const vc = {
    APPROVE:               '✅ APPROVE',
    APPROVE_WITH_COMMENTS: '💬 APPROVE WITH COMMENTS',
    REQUEST_CHANGES:       '🔄 REQUEST CHANGES',
    BLOCK:                 '🚫 BLOCKED',
  }[verdict.verdict] ?? '💬 REVIEWED';

  const agentRows = Object.entries(verdict.agentSummaries ?? {})
    .map(([name, summary]) => `| ${name} | ${summary} |`)
    .join('\n');

  const findingRows = (verdict.findings ?? [])
    .filter((f) => f.confidence >= 0.6)
    .map((f) => {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[f.severity] ?? '⚪';
      return `| ${icon} ${f.severity} | ${f.title} | \`${f.file}:${f.line}\` |`;
    })
    .join('\n');

  return [
    `## 🔬 Refract Code Review`,
    '',
    `**Verdict:** ${vc} &nbsp;|&nbsp; **Score:** ${verdict.score}/100`,
    '',
    `> ${verdict.summary}`,
    '',
    '### Agent Summaries',
    '| Agent | Summary |',
    '|-------|---------|',
    agentRows,
    '',
    findingRows
      ? ['### Findings', '| Severity | Issue | Location |', '|----------|-------|----------|', findingRows].join('\n')
      : '### ✅ No significant findings',
    '',
    `---`,
    `_Reviewed by [Refract](https://github.com/yoursshahnawaz/refract) — multi-agent AI code review_`,
  ].join('\n');
}
