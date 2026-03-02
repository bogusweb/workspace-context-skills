# Domain Registry Format Reference

The Domain Registry is a Markdown table embedded in `CLAUDE.md` between two HTML comments.

## Full Format

```markdown
## Domain Registry

> Auto-loaded by domain-context skill. Run `/domain-init` to regenerate.

<!-- domain-registry-start -->
| Path | Import Path | Description |
|------|-------------|-------------|
| libs/widget-chat | @myapp/widget-chat | Chat widget with AI integration |
| libs/shared/sidebar | @myapp/shared/sidebar | Sidebar navigation and layout |
| libs/dashboards-manager | @myapp/dashboards-manager | Dashboard CRUD and state |
<!-- domain-registry-end -->
```

## Column Descriptions

| Column | Required | Description |
|--------|----------|-------------|
| `Path` | ✅ | Relative path from project root to the domain directory |
| `Import Path` | ✅ | NPM/TypeScript import path for this domain (`importPath` from project.json) |
| `Description` | ✅ | One-line description of what this domain does |

## Matching Rules

The skill matches a task to a domain using these checks (in order):

1. **Exact file path prefix** — task file starts with `Path`
2. **Import path substring** — code imports something containing `Import Path`
3. **Name mention** — user message contains the domain directory name

## Notes

- The `<!-- domain-registry-start -->` and `<!-- domain-registry-end -->` markers are required for reliable parsing
- The table must use `|` pipe syntax
- Extra columns are allowed and ignored
- Paths should be relative to the workspace root (no leading `/`)
