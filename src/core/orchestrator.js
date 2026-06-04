import pLimit from 'p-limit';
import { runAgent } from './runner.js';
import { AGENTS } from '../agents/index.js';
import { getMockAgentResult } from './mock.js';

/**
 * Orchestrator — runs all enabled agents in parallel, then
 * passes their findings to the Judge for synthesis.
 */
export async function orchestrate({ diff, meta, config, onProgress, mock = false }) {
  const enabledAgents = Object.entries(config.agents)
    .filter(([, cfg]) => cfg.enabled)
    .map(([name]) => name)
    .filter((name) => AGENTS[name]);

  onProgress?.({ stage: 'start', agents: enabledAgents });

  // Run specialist agents in parallel (max 5 concurrent)
  const limit = pLimit(5);
  const agentResults = await Promise.all(
    enabledAgents.map((name) =>
      limit(async () => {
        onProgress?.({ stage: 'running', agent: name });
        try {
          const result = mock
            ? getMockAgentResult(name)
            : await runAgent({ agent: AGENTS[name], diff, meta, config });
          onProgress?.({ stage: 'done', agent: name });
          return { name, result, error: null };
        } catch (err) {
          onProgress?.({ stage: 'error', agent: name, error: err.message });
          return { name, result: null, error: err.message };
        }
      })
    )
  );

  const successful = agentResults.filter((r) => r.result !== null);

  onProgress?.({ stage: 'judging' });

  const verdict = mock
    ? getMockAgentResult('judge')
    : await runAgent({ agent: AGENTS.judge, diff, meta, config, context: successful });

  return { agentResults: successful, verdict, meta };
}
