import chalk from 'chalk';

const SEVERITY_CONFIG = {
  critical: { color: chalk.bgRed.white.bold, icon: '🔴', label: 'CRITICAL' },
  high:     { color: chalk.red.bold,         icon: '🟠', label: 'HIGH    ' },
  medium:   { color: chalk.yellow.bold,      icon: '🟡', label: 'MEDIUM  ' },
  low:      { color: chalk.blue,             icon: '🔵', label: 'LOW     ' },
};

const VERDICT_CONFIG = {
  APPROVE:               { color: chalk.green.bold,        icon: '✅', label: 'APPROVE' },
  APPROVE_WITH_COMMENTS: { color: chalk.yellow.bold,       icon: '💬', label: 'APPROVE WITH COMMENTS' },
  REQUEST_CHANGES:       { color: chalk.red.bold,          icon: '🔄', label: 'REQUEST CHANGES' },
  BLOCK:                 { color: chalk.bgRed.white.bold,  icon: '🚫', label: 'BLOCKED' },
};

export function renderVerdict({ verdict, agentResults, meta }) {
  const v = verdict;
  const vc = VERDICT_CONFIG[v.verdict] ?? VERDICT_CONFIG.APPROVE_WITH_COMMENTS;

  console.log('\n' + chalk.dim('─'.repeat(60)));
  console.log(chalk.bold.white('  REFRACT') + chalk.dim(' — Multi-Agent Code Review'));
  console.log(chalk.dim('─'.repeat(60)));

  console.log(`\n  ${chalk.dim('PR:')} ${chalk.white(meta.title ?? 'Local review')}`);
  console.log(`  ${chalk.dim('Changes:')} ${chalk.green('+' + (meta.additions ?? 0))} ${chalk.red('-' + (meta.deletions ?? 0))}`);

  console.log('\n' + chalk.dim('  Agents'));
  for (const [name, summary] of Object.entries(v.agentSummaries ?? {})) {
    const agent = agentResults.find((r) => r.name === name);
    const status = agent ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${status} ${chalk.bold(name.padEnd(14))} ${chalk.dim(summary)}`);
  }

  const score = v.score ?? 0;
  const filled = Math.round(score / 5);
  const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(20 - filled));
  console.log(`\n  ${chalk.dim('Score')} ${bar} ${chalk.bold(score + '/100')}`);

  console.log(`\n  ${vc.icon}  ${vc.color(vc.label)}`);
  console.log(`  ${chalk.dim(v.summary)}\n`);

  const findings = (v.findings ?? []).filter((f) => f.confidence >= 0.6);

  if (findings.length === 0) {
    console.log(chalk.green('  No significant findings.\n'));
  } else {
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.bold(`  Findings (${findings.length})\n`));

    for (const f of findings) {
      const sc = SEVERITY_CONFIG[f.severity] ?? SEVERITY_CONFIG.low;
      const quorumBadge = f.quorum ? chalk.magenta(' ⬡ QUORUM') : '';
      const agents = f.agents ? chalk.dim(` [${f.agents.join(', ')}]`) : '';
      const confidence = chalk.dim(` ${Math.round(f.confidence * 100)}% confidence`);

      console.log(`  ${sc.icon} ${sc.color(sc.label)}${quorumBadge}${agents}${confidence}`);
      console.log(`  ${chalk.bold(f.title)}`);
      console.log(`  ${chalk.dim(f.file ?? '')}${f.line ? chalk.dim(':' + f.line) : ''}`);
      console.log(`  ${f.description}`);
      if (f.suggestion) {
        console.log(`  ${chalk.cyan('→')} ${chalk.cyan(f.suggestion)}`);
      }
      console.log();
    }
  }

  console.log(chalk.dim('─'.repeat(60) + '\n'));
}

export function renderProgress({ stage, agent, error }) {
  if (stage === 'start') return;
  if (stage === 'running') process.stdout.write(chalk.dim(`  Running ${agent} agent...`));
  if (stage === 'done')    process.stdout.write(chalk.green(' ✓\n'));
  if (stage === 'error')   process.stdout.write(chalk.red(` ✗ ${error}\n`));
  if (stage === 'judging') console.log(chalk.dim('\n  Judge synthesizing findings...'));
}
