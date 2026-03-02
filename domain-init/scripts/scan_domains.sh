#!/usr/bin/env bash
# scan_domains.sh — Scans a project for library directories and outputs domain metadata
# Usage: bash scan_domains.sh [root_path]
# Output: TSV lines of: path\timport_path\tdescription
#
# Supports:
#   - Nx workspaces (project.json with importPath)
#   - Angular libraries (ng-package.json + package.json)
#   - Plain npm packages (package.json with name)

set -euo pipefail

ROOT="${1:-libs}"

if [ ! -d "$ROOT" ]; then
  echo "ERROR: Directory '$ROOT' not found" >&2
  exit 1
fi

scan_dir() {
  local dir="$1"

  # Try Nx project.json first
  if [ -f "$dir/project.json" ]; then
    local import_path
    local name
    import_path=$(node -e "
      try {
        const p = require('./$dir/project.json');
        // importPath can be in root or in targets.build.options
        const ip = p.importPath
          || (p.targets && p.targets.build && p.targets.build.options && p.targets.build.options.importPath)
          || '';
        process.stdout.write(ip);
      } catch(e) { process.stdout.write(''); }
    " 2>/dev/null)

    name=$(node -e "
      try {
        const p = require('./$dir/project.json');
        process.stdout.write(p.name || '');
      } catch(e) { process.stdout.write(''); }
    " 2>/dev/null)

    if [ -n "$import_path" ] || [ -n "$name" ]; then
      local description
      description=$(get_description "$dir")
      echo -e "${dir}\t${import_path:-$name}\t${description}"
      return
    fi
  fi

  # Try ng-package.json + package.json
  if [ -f "$dir/ng-package.json" ] && [ -f "$dir/package.json" ]; then
    local import_path
    import_path=$(node -e "
      try {
        const p = require('./$dir/package.json');
        process.stdout.write(p.name || '');
      } catch(e) { process.stdout.write(''); }
    " 2>/dev/null)

    if [ -n "$import_path" ]; then
      local description
      description=$(get_description "$dir")
      echo -e "${dir}\t${import_path}\t${description}"
      return
    fi
  fi

  # Try plain package.json
  if [ -f "$dir/package.json" ]; then
    local import_path
    import_path=$(node -e "
      try {
        const p = require('./$dir/package.json');
        // Skip root/workspace package.json (no publishConfig or private=true without name)
        const name = p.name || '';
        if (!name || name === p.name && p.private && !p.main && !p.module) {
          process.stdout.write('');
        } else {
          process.stdout.write(name);
        }
      } catch(e) { process.stdout.write(''); }
    " 2>/dev/null)

    if [ -n "$import_path" ]; then
      local description
      description=$(get_description "$dir")
      echo -e "${dir}\t${import_path}\t${description}"
    fi
  fi
}

get_description() {
  local dir="$1"
  local readme="$dir/README.md"

  if [ -f "$readme" ]; then
    # Get first non-empty, non-heading line after the H1
    local desc
    desc=$(grep -v "^#" "$readme" | grep -v "^$" | head -1 | sed 's/^[[:space:]]*//')
    if [ -n "$desc" ]; then
      echo "$desc"
      return
    fi
    # Fallback to H1 subtitle
    desc=$(grep "^# " "$readme" | head -1 | sed 's/^# //')
    if [ -n "$desc" ]; then
      echo "$desc"
      return
    fi
  fi

  # Heuristic from path
  local basename
  basename=$(basename "$dir")
  case "$basename" in
    domain)      echo "Domain layer: business logic and state management" ;;
    feature)     echo "Feature layer: container components and routing" ;;
    ui)          echo "UI layer: presentational components" ;;
    util|utils)  echo "Utilities and helper functions" ;;
    domain-*)    echo "Domain: ${basename#domain-}" ;;
    feature-*)   echo "Feature: ${basename#feature-}" ;;
    ui-*)        echo "UI components: ${basename#ui-}" ;;
    util-*)      echo "Utilities: ${basename#util-}" ;;
    widget-*)    echo "Widget: ${basename#widget-}" ;;
    shared)      echo "Shared library" ;;
    *)           echo "${basename}" ;;
  esac
}

# Find all candidate directories (max depth 3 to avoid deep nesting)
while IFS= read -r -d '' dir; do
  # Skip hidden dirs, node_modules, dist
  case "$dir" in
    */.* | */node_modules/* | */dist/* | */.git/*)
      continue ;;
  esac
  scan_dir "$dir"
done < <(find "$ROOT" -maxdepth 3 -type d -print0 | sort -z)
