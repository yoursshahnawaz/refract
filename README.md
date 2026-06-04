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

## Try it instantly (no API key needed)

```bash
git clone https://github.com/yoursshahnawaz/refract
cd refract
npm install
node test/run-sample.js --mock
```

This runs Refract against a sample auth file packed with real vulnerabilities and shows the full output.

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

The following is a real review of a Node.js auth file with intentional vulnerabilities (see [`test/sample/`](test/sample/)):

```
  ⚠  Mock mode — no API key detected, using simulated responses

  Running security agent...     ✓
  Running performance agent...  ✓
  Running logic agent...        ✓
  Running architecture agent... ✓
  Running tests agent...        ✓

  Judge synthesizing findings...

────────────────────────────────────────────────────────────
  REFRACT — Multi-Agent Code Review
────────────────────────────────────────────────────────────

  PR: feat: refactor auth routes with user enrichment
  Changes: +79 -6

  Agents
  ✓ security       Critical: SQL injection, hardcoded secret, plain-text
                   password storage, sensitive data logged and leaked
  ✓ performance    N+1 query on user fetch, O(n²) tag deduplication,
                   unused lodash import
  ✓ logic          Auth bypass via missing await (every /admin request
                   passes), plain-text password comparison, no input validation
  ✓ architecture   Register route violates SRP, JWT secret duplicated
                   three times across the file
  ✓ tests          Zero test coverage on all three new endpoints including
                   the critical auth bypass route

  Score ████░░░░░░░░░░░░░░░░ 18/100

  🚫  BLOCKED
  This PR must not be merged. It introduces an authentication bypass
  that grants every user admin access, stores passwords in plain text,
  and has a SQL injection vulnerability. These are not theoretical
  risks — they are exploitable in production as written.

────────────────────────────────────────────────────────────
  Findings (7)

  🔴 CRITICAL  ⬡ QUORUM  [logic, security]  99% confidence
  Auth bypass — missing await makes every /admin request succeed
  src/routes/auth.js:25
  verifyToken() is async but called without await, returning a truthy
  Promise. Every request to /admin passes regardless of token validity.
  → Add async to route handler and await verifyToken(token)

  🔴 CRITICAL  [security]  98% confidence
  SQL injection via role query parameter
  src/routes/auth.js:12
  Raw string interpolation of user input into SQL query allows full
  database compromise.
  → db.query("SELECT * FROM users WHERE role = ?", [role])

  🔴 CRITICAL  ⬡ QUORUM  [security, logic]  97% confidence
  Passwords stored and compared in plain text
  src/routes/auth.js:58
  Plain-text password storage means a single DB breach exposes every
  user credential.
  → bcrypt.hash(password, 12) on register, bcrypt.compare() on login

  🔴 CRITICAL  [security]  97% confidence
  Hardcoded JWT fallback secret
  src/routes/auth.js:34
  Fallback to "mysecretkey123" means tokens can be forged in any
  environment missing the env var.
  → Throw if JWT_SECRET is not set — never fall back to a hardcoded value

  🟠 HIGH      [performance]  95% confidence
  N+1 query in /users route
  src/routes/auth.js:16
  One DB query per user in a loop. Fetch all profiles in a single
  IN query instead.
  → db.query("SELECT * FROM profiles WHERE user_id IN (?)", [userIds])

  🟠 HIGH      [security]  95% confidence
  Sensitive data logged and leaked in API response
  src/routes/auth.js:38
  Full user object including password written to logs and returned
  in register response.
  → const { password, ...safeUser } = user

  🟡 MEDIUM    [logic]  85% confidence
  No input validation on register endpoint
  src/routes/auth.js:49
  Null or undefined inputs pass straight to the database.
  → Validate all required fields before processing the request

────────────────────────────────────────────────────────────
```

> Try it yourself: `node test/run-sample.js --mock` — no API key needed.

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
