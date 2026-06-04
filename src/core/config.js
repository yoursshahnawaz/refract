import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DEFAULTS = {
  agents: {
    security:     { enabled: true, weight: 1.5 },
    performance:  { enabled: true, weight: 1.2 },
    logic:        { enabled: true, weight: 1.3 },
    architecture: { enabled: true, weight: 1.0 },
    tests:        { enabled: true, weight: 1.0 },
  },
  quorum: {
    threshold: 2,
  },
  confidence: {
    minDisplay: 0.6,
    minCritical: 0.85,
  },
  output: {
    inline: true,
    summary: true,
    maxFindings: 20,
  },
  model: 'claude-opus-4-5',
};

export function loadConfig(cwd = process.cwd()) {
  const configPath = join(cwd, '.refract.json');
  if (!existsSync(configPath)) return DEFAULTS;

  try {
    const userConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    return deepMerge(DEFAULTS, userConfig);
  } catch {
    console.warn('⚠️  Could not parse .refract.json — using defaults');
    return DEFAULTS;
  }
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] ?? {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}
