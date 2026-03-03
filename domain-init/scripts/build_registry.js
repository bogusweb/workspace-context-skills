#!/usr/bin/env node
// build_registry.js — Takes scan_domains.js output and produces a CLAUDE.md registry block
// Usage: node scan_domains.js [root] | node build_registry.js [--group]
// Or:    node build_registry.js [root] [--group]
//
// --group: Collapse same-parent libraries into one entry if none of them have a real README

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const group = args.includes('--group');
const root = args.find(a => !a.startsWith('--')) || 'libs';

// Run scanner
const scannerPath = path.join(__dirname, 'scan_domains.js');
let domains;
try {
  const output = execSync(`node "${scannerPath}" "${root}"`, { encoding: 'utf8' });
  domains = JSON.parse(output);
} catch (e) {
  console.error('Failed to run scanner:', e.message);
  process.exit(1);
}

function hasRealReadme(domainPath) {
  const readmePath = path.join(domainPath, 'README.md');
  if (!fs.existsSync(readmePath)) return false;
  const content = fs.readFileSync(readmePath, 'utf8');
  // Skip auto-generated Nx boilerplate
  const boilerplate = [
    'This library was generated with',
    'This project was generated using',
  ];
  return !boilerplate.some(b => content.includes(b));
}

let filtered = domains;

if (group) {
  // Group by parent: if parent dir has a README but children don't, use parent only
  // If children have READMEs, register children individually
  const byParent = new Map();
  for (const d of domains) {
    const parent = path.dirname(d.path);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(d);
  }

  filtered = [];
  const used = new Set();

  for (const [parent, children] of byParent) {
    // If any child has a real README → keep all children individually
    const anyChildHasReadme = children.some(c => hasRealReadme(c.path));
    if (anyChildHasReadme) {
      children.forEach(c => { if (!used.has(c.path)) { filtered.push(c); used.add(c.path); } });
    } else {
      // All children lack real READMEs → try to register parent
      const parentPkg = path.join(parent, 'project.json');
      const parentHasMeta = fs.existsSync(parentPkg);
      if (parentHasMeta && !used.has(parent)) {
        // Use parent entry (first child's import path prefix for reference)
        const parentJson = JSON.parse(fs.readFileSync(parentPkg, 'utf8'));
        const importPath = parentJson.importPath || parentJson.name || children[0]?.importPath || '';
        const description = getDescription(parent, children);
        filtered.push({ path: parent, importPath, description });
        used.add(parent);
      } else {
        // Just use children as-is
        children.forEach(c => { if (!used.has(c.path)) { filtered.push(c); used.add(c.path); } });
      }
    }
  }
}

function getDescription(dirPath, children) {
  const readmePath = path.join(dirPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    const lines = fs.readFileSync(readmePath, 'utf8').split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (t && !t.startsWith('#') && !t.startsWith('<!--') && !t.includes('generated with')) {
        return t.replace(/^\*+|\*+$/g, '').trim();
      }
    }
  }
  if (children?.length) {
    const basename = path.basename(dirPath);
    return `${basename} (${children.map(c => path.basename(c.path)).join(', ')})`;
  }
  return path.basename(dirPath);
}

// Sort by path
filtered.sort((a, b) => a.path.localeCompare(b.path));

// Remove entries where description is "This library was generated with Nx"
filtered = filtered.map(d => ({
  ...d,
  description: d.description.includes('generated with') ? path.basename(d.path) : d.description,
}));

// Find libraries without real READMEs
const missingReadme = filtered.filter(d => !hasRealReadme(d.path)).map(d => d.path);

// Build the registry block
const tableRows = filtered.map(d =>
  `| ${d.path} | ${d.importPath} | ${d.description} |`
).join('\n');

const registryBlock = `## Domain Registry

> Auto-maintained by domain-init skill. Run \`/domain-init\` to regenerate.

<!-- domain-registry-start -->
| Path | Import Path | Description |
|------|-------------|-------------|
${tableRows}
<!-- domain-registry-end -->`;

const autoLoadInstruction = `
## Domain Context Loading

The \`domain-init\` skill is active for this project. Before working on any library
listed in the Domain Registry above, silently read its \`README.md\` for architecture
and pattern context.`;

console.log(JSON.stringify({
  registryBlock,
  autoLoadInstruction,
  stats: {
    total: filtered.length,
    withReadme: filtered.length - missingReadme.length,
    missingReadme,
  }
}, null, 2));
