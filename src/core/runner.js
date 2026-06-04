import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Runs a single agent against the diff.
 * Each agent is a plain object with { name, systemPrompt, buildPrompt }.
 */
export async function runAgent({ agent, diff, meta, config, context }) {
  const userPrompt = agent.buildPrompt({ diff, meta, config, context });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: agent.systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0]?.text ?? '';

  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    return JSON.parse(text);
  } catch {
    return { raw: text, findings: [] };
  }
}
