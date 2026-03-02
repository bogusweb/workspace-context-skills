# workspace-context-skills

> Claude Code skill package — automatic domain context loading for monorepos and multi-library projects.

When Claude works on code inside a registered library, it silently reads that library's `README.md` before responding. No more re-explaining architecture. No more wrong import paths. No more guessing patterns.

---

## Skills Included

| Skill | Install command | Purpose |
|-------|-----------------|---------|
| `domain-context` | see below | Auto-loads domain READMEs during tasks |
| `domain-init` | see below | Scans your project and writes the Domain Registry to `CLAUDE.md` |
| `domain-readme` | see below | Generates/updates `README.md` for any library |

---

## Quick Start

### 1. Install the skills

```bash
# Global (recommended) — active in all projects
npx skills add YOUR_USERNAME/workspace-context-skills@domain-context -g -y
npx skills add YOUR_USERNAME/workspace-context-skills@domain-init -g -y
npx skills add YOUR_USERNAME/workspace-context-skills@domain-readme -g -y
```

Or project-local:

```bash
npx skills add YOUR_USERNAME/workspace-context-skills@domain-context
npx skills add YOUR_USERNAME/workspace-context-skills@domain-init
npx skills add YOUR_USERNAME/workspace-context-skills@domain-readme
```

### 2. Initialize your project's Domain Registry

Open Claude Code in your project root and run:

```
/domain-init
```

This scans `libs/` (or your configured root), reads each library's `project.json`/`package.json`, and writes a **Domain Registry** table to your `CLAUDE.md`:

```markdown
## Domain Registry

<!-- domain-registry-start -->
| Path | Import Path | Description |
|------|-------------|-------------|
| libs/widget-chat | @myapp/widget-chat | Chat widget with AI integration |
| libs/shared/sidebar | @myapp/shared/sidebar | Sidebar navigation |
<!-- domain-registry-end -->
```

### 3. Generate READMEs for libraries that don't have them

```
/domain-readme libs/widget-chat
/domain-readme libs/shared/sidebar
```

### 4. Done

From now on, when Claude works on files inside a registered domain, it silently reads that domain's `README.md` first.

---

## How It Works

```
User: "Add a new action to the widget-chat store"
                    │
                    ▼
    domain-context skill checks CLAUDE.md
    for Domain Registry
                    │
                    ▼
    Matches "widget-chat" → reads libs/widget-chat/README.md
                    │
                    ▼
    Claude now knows:
    - Store shape (state, computed, methods)
    - Facade pattern used
    - Import paths
    - Existing conventions
                    │
                    ▼
    Accurate implementation on first try
```

---

## Supported Project Structures

| Structure | Detection | Notes |
|-----------|-----------|-------|
| Nx workspaces | `project.json` → `importPath` | Full support |
| Angular libraries | `ng-package.json` + `package.json` | Full support |
| npm workspaces | `package.json` → `name` | Supported |
| Custom monorepos | Manual registry edit | Add rows to the table in CLAUDE.md |

---

## Manual Registry Setup

If auto-detection doesn't work for your structure, manually add entries to `CLAUDE.md`:

```markdown
## Domain Registry

<!-- domain-registry-start -->
| Path | Import Path | Description |
|------|-------------|-------------|
| packages/auth | @myapp/auth | Authentication and session management |
| packages/api-client | @myapp/api | HTTP client with retry logic |
<!-- domain-registry-end -->
```

---

## Domain README Format

The `domain-readme` skill generates READMEs in a format optimized for Claude to parse:

```markdown
# Library Name

One-line description.

## Architecture
Layer structure with file tree.

## Public API
Services, stores, components with method signatures.

## Key Patterns
Domain-specific conventions.

## Usage Example
Minimal code snippet.

## Dependencies
What this library depends on and what uses it.
```

---

## Requirements

- Claude Code CLI
- Node.js ≥ 18 (for the scan scripts)
- `npx skills` CLI

---

## Contributing

Issues and PRs welcome. The skill format follows the [skills.sh](https://skills.sh) specification.

---

## License

MIT
