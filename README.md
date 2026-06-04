# 🔬 Refract

> Multi-agent AI code review — every PR examined through multiple expert lenses

Refract runs **5 specialist AI agents in parallel** on your pull request, then a **Judge agent** synthesizes their findings into a clear, actionable verdict. No more single-model reviews that miss things. No more noisy, low-confidence comments.

```
PR Diff
   │
   ├──► 🔐 Security Agent      ──┐
   ├──► ⚡ Performance Agent   ──┤
   ├──► 🐛 Logic & Bug Agent   ──┼──► ⚖️ Judge Agent ──► Verdict
   ├──► 🏗️ Architecture Agent  ──┤
   └──► 🧪 Test Coverage Agent ──┘
```

---

## Features

- **Parallel execution** — all agents run simultaneously, results in seconds
- **Quorum gating** — findings are elevated only when multiple agents agree, dramatically reducing false positives
- **Confidence scoring** — every finding has a confidence %, low-confidence noise is suppressed
- **Inline GitHub comments** — posts directly on the diff lines, not just a wall of text
- **Configurable** — enable/disable agents, set thresholds, tune per-repo via `.refract.json`
- **CLI + GitHub Action** — run locally or drop into any CI pipeline

---

## Quick Start

### 1. Install

```bash
npm install -g refract
```

### 2. Set your API key

```bash
export ANTHROPIC_API_KEY=your_key_here
# or add to .env file
```

### 3. Review

```bash
# Review a GitHub PR
refract review --pr 42

# Review your staged local changes
refract review

# Review and post comments directly to GitHub
refract review --pr 42 --post
```

---

## GitHub Action

Add Refract to any repo in 2 steps:

**1.** Add `ANTHROPIC_API_KEY` to repo secrets (`Settings → Secrets → Actions`)

**2.** Create `.github/workflows/refract.yml`:

```yaml
name: Refract Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g refract
      - env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: refract review --pr ${{ github.event.pull_request.number }} --post
```

---

## Sample Output

```
────────────────────────────────────────────────────────────
  REFRACT — Multi-Agent Code Review
────────────────────────────────────────────────────────────

  PR: Fix user authentication flow
  Changes: +127 -43

  Agents
  ✓ security        Hardcoded fallback secret detected
  ✓ performance     One N+1 query found in user fetch loop
  ✓ logic           Async error path not handled
  ✓ architecture    Auth logic mixed with controller
  ✓ tests           Missing tests for error paths

  Score ████████████░░░░░░░░ 62/100

  🔄  REQUEST CHANGES
  Three issues warrant attention before merging: a critical secret
  exposure, an unhandled async error, and an N+1 query pattern.

────────────────────────────────────────────────────────────
  Findings (3)

  🔴 CRITICAL  ⬡ QUORUM [security, logic]  97% confidence
  JWT secret falls back to hardcoded string
  src/auth/token.js:34
  When JWT_SECRET env var is missing the code falls back to the
  string "secret", exposing all tokens in production.
  → if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required')

  🟠 HIGH   [performance]  84% confidence
  N+1 query inside user fetch loop
  src/api/users.js:112
  user.profile is fetched inside a loop — one DB query per user.
  → Use eager loading: User.findAll({ include: Profile })

  🟡 MEDIUM  [logic]  79% confidence
  Unhandled promise rejection in auth middleware
  src/middleware/auth.js:67
  verifyToken() can throw but is not in a try/catch.
  → Wrap in try/catch or add .catch() to handle token errors
────────────────────────────────────────────────────────────
```

---

## Configuration

Drop a `.refract.json` in your repo root to customize:

```json
{
  "agents": {
    "security":     { "enabled": true,  "weight": 1.5 },
    "performance":  { "enabled": true,  "weight": 1.2 },
    "logic":        { "enabled": true,  "weight": 1.3 },
    "architecture": { "enabled": false },
    "tests":        { "enabled": true,  "weight": 1.0 }
  },
  "quorum": { "threshold": 2 },
  "confidence": { "minDisplay": 0.65 },
  "output": { "maxFindings": 15 }
}
```

---

## CLI Reference

```
refract review [options]

  -p, --pr <number>     GitHub PR number
  -b, --base <branch>   Base branch for local diff (e.g. main)
  --post                Post results as GitHub PR comments
  --repo <owner/repo>   GitHub repo (defaults to current)
  --json                Output raw JSON

refract agents          List available agents and their status
```

---

## How It Works

1. **Diff extraction** — fetches the PR diff via `gh` CLI or from local git
2. **Parallel agents** — 5 specialist agents run concurrently, each focused on one concern
3. **Quorum check** — findings flagged by multiple agents are elevated and marked `⬡ QUORUM`
4. **Judge synthesis** — resolves conflicts, deduplicates, scores the PR, writes the verdict
5. **Output** — renders to terminal and optionally posts inline GitHub comments

---

## Agents

| Agent | Focus |
|-------|-------|
| 🔐 Security | Injection, auth issues, secrets, OWASP top 10 |
| ⚡ Performance | N+1 queries, memory leaks, blocking I/O, complexity |
| 🐛 Logic | Bugs, null dereferences, async errors, edge cases |
| 🏗️ Architecture | SOLID violations, coupling, abstraction leaks |
| 🧪 Tests | Coverage gaps, missing edge case tests, flaky patterns |
| ⚖️ Judge | Synthesizes findings, resolves conflicts, final verdict |

---

## Requirements

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)
- [GitHub CLI](https://cli.github.com/) (for PR reviews and posting comments)

---

## License

MIT © [yoursshahnawaz](https://github.com/yoursshahnawaz)
