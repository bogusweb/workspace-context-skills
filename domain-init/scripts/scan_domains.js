#!/usr/bin/env node
// scan_domains.js — Cross-platform fallback scanner for domain-init skill
// Usage: node scan_domains.js [root_path]
// Output: JSON array of { path, importPath, description }

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || 'libs';

if (!fs.existsSync(root)) {
  console.error(`ERROR: Directory '${root}' not found`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getDescription(dir) {
  const readmePath = path.join(dir, 'README.md');
  if (fs.existsSync(readmePath)) {
    const lines = fs.readFileSync(readmePath, 'utf8').split('\n');
    // First non-empty, non-heading line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('<!--')) {
        return trimmed.replace(/^\*+|\*+$/g, '').trim(); // strip bold
      }
    }
    // Fallback: H1 text
    const h1 = lines.find(l => l.startsWith('# '));
    if (h1) return h1.replace(/^#\s+/, '').trim();
  }

  // Heuristic from directory name
  const basename = path.basename(dir);
  const heuristics = {
    domain:   'Domain layer: business logic and state management',
    feature:  'Feature layer: container components and routing',
    ui:       'UI layer: presentational components',
    util:     'Utilities and helper functions',
    utils:    'Utilities and helper functions',
    shared:   'Shared library',
  };
  if (heuristics[basename]) return heuristics[basename];
  if (basename.startsWith('domain-')) return `Domain: ${basename.slice(7)}`;
  if (basename.startsWith('feature-')) return `Feature: ${basename.slice(8)}`;
  if (basename.startsWith('ui-')) return `UI components: ${basename.slice(3)}`;
  if (basename.startsWith('util-')) return `Utilities: ${basename.slice(5)}`;
  if (basename.startsWith('widget-')) return `Widget: ${basename.slice(7)}`;
  return basename;
}

function scanDir(dir) {
  // 1. Nx project.json
  const projectJsonPath = path.join(dir, 'project.json');
  if (fs.existsSync(projectJsonPath)) {
    const pj = readJson(projectJsonPath);
    if (pj) {
      const importPath =
        pj.importPath ||
        (pj.targets?.build?.options?.importPath) ||
        pj.name || '';
      if (importPath) {
        return { path: dir, importPath, description: getDescription(dir) };
      }
    }
  }

  // 2. Angular ng-package.json + package.json
  const ngPkgPath = path.join(dir, 'ng-package.json');
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(ngPkgPath) && fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath);
    if (pkg?.name) {
      return { path: dir, importPath: pkg.name, description: getDescription(dir) };
    }
  }

  // 3. Plain package.json (skip workspace root)
  if (fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath);
    if (pkg?.name && (pkg.main || pkg.module || pkg.exports || pkg.publishConfig)) {
      return { path: dir, importPath: pkg.name, description: getDescription(dir) };
    }
  }

  return null;
}

function walk(dir, depth = 0) {
  if (depth > 3) return [];
  const results = [];
  const entry = scanDir(dir);
  if (entry && dir !== root) results.push(entry);

  let children;
  try {
    children = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const child of children) {
    if (!child.isDirectory()) continue;
    const name = child.name;
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue;
    results.push(...walk(path.join(dir, name), depth + 1));
  }

  return results;
}

const domains = walk(root);
// Sort by path for deterministic output
domains.sort((a, b) => a.path.localeCompare(b.path));
console.log(JSON.stringify(domains, null, 2));
