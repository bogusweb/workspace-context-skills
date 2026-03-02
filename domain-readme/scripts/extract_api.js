#!/usr/bin/env node
// extract_api.js — Extracts public API from a library's index.ts and source files
// Usage: node extract_api.js <library-path>
// Output: JSON with { stores, services, components, types, directives }

const fs = require('fs');
const path = require('path');

const libPath = process.argv[2];
if (!libPath || !fs.existsSync(libPath)) {
  console.error(`ERROR: Path '${libPath}' not found`);
  process.exit(1);
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

function extractExports(content) {
  const exports = [];
  const re = /export\s+(?:(?:abstract|declare)\s+)?(?:class|interface|type|function|const|enum)\s+(\w+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    exports.push(m[1]);
  }
  return exports;
}

function extractNgrxStore(content, fileName) {
  if (!content.includes('signalStore') && !content.includes('createReducer')) return null;
  const name = path.basename(fileName, '.ts');
  const stateProps = [];
  // Match withState({ ... }) properties
  const stateMatch = content.match(/withState[(<]\s*\{([^}]+)\}/s);
  if (stateMatch) {
    const props = stateMatch[1].match(/(\w+)\s*:/g) || [];
    stateProps.push(...props.map(p => p.replace(':', '').trim()));
  }
  // Match computed(() => ...) assignments
  const computed = (content.match(/(\w+)\s*=\s*computed\(/g) || [])
    .map(m => m.split('=')[0].trim());
  // Match method names (functions inside the store)
  const methods = (content.match(/(\w+)\s*\([^)]*\)\s*=>/g) || [])
    .map(m => m.split('(')[0].trim())
    .filter(m => !['computed', 'withState', 'withMethods'].includes(m));

  return { name, stateProps, computed, methods };
}

function extractAngularComponent(content, fileName) {
  if (!content.includes('@Component')) return null;
  const name = path.basename(fileName, '.ts');
  const selectorMatch = content.match(/selector\s*:\s*['"`]([^'"`]+)['"`]/);
  const inputs = (content.match(/@Input\(\)[^;]+\s+(\w+)/g) || [])
    .map(m => m.match(/(\w+)$/)?.[1]).filter(Boolean);
  const outputs = (content.match(/@Output\(\)[^;]+\s+(\w+)/g) || [])
    .map(m => m.match(/(\w+)$/)?.[1]).filter(Boolean);
  return {
    name,
    selector: selectorMatch?.[1] || '',
    inputs,
    outputs,
  };
}

function extractService(content, fileName) {
  if (!content.includes('@Injectable')) return null;
  const name = path.basename(fileName, '.ts');
  const methods = [];
  // Match public methods (no 'private' keyword before)
  const methodRe = /(?:^|\n)\s*(?!private|protected)(async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/g;
  let m;
  while ((m = methodRe.exec(content)) !== null) {
    const methodName = m[2];
    if (['constructor', 'ngOnInit', 'ngOnDestroy', 'ngOnChanges'].includes(methodName)) continue;
    methods.push(methodName);
  }
  return { name, methods };
}

// Main extraction
const srcDir = path.join(libPath, 'src');
const tsFiles = findFiles(srcDir, '.ts').filter(f => !f.includes('.spec.'));

const result = {
  path: libPath,
  stores: [],
  services: [],
  components: [],
  types: [],
  exports: [],
};

// Read public API from index.ts
const indexPath = path.join(libPath, 'index.ts');
const indexContent = readFile(indexPath);
result.exports = extractExports(indexContent);

// Analyze each source file
for (const file of tsFiles) {
  const content = readFile(file);
  const rel = path.relative(libPath, file);

  const store = extractNgrxStore(content, file);
  if (store) { result.stores.push({ ...store, file: rel }); continue; }

  const component = extractAngularComponent(content, file);
  if (component) { result.components.push({ ...component, file: rel }); continue; }

  const service = extractService(content, file);
  if (service) { result.services.push({ ...service, file: rel }); continue; }
}

console.log(JSON.stringify(result, null, 2));
