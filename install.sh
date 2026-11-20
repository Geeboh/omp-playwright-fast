#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE=plugin; PROJECT=""; DIAG_PROJECT=""; FORCE=0
while (($#)); do
 case "$1" in
   --plugin) MODE=plugin; shift;;
   --diagnose) MODE=diagnose; shift;;
   --project) DIAG_PROJECT="${2:?missing project directory}"; shift 2;;
   --global-skill) MODE=global; shift;;
   --project-skill) MODE=project; PROJECT="${2:?missing project directory}"; shift 2;;
   --force) FORCE=1; shift;;
   -h|--help) echo 'Usage: ./install.sh [--plugin|--diagnose [--project DIR]|--global-skill|--project-skill DIR] [--force]'; exit 0;;
   *) echo "Unknown argument: $1" >&2; exit 2;;
 esac
done
if [[ "$MODE" == diagnose ]]; then
 if [[ -n "$DIAG_PROJECT" ]]; then node "$HERE/scripts/diagnose-install.mjs" --project "$DIAG_PROJECT"; else node "$HERE/scripts/diagnose-install.mjs"; fi
 exit $?
fi
if [[ "$MODE" == plugin ]]; then
 command -v omp >/dev/null || { echo 'omp CLI not found; install OMP first' >&2; exit 2; }
 echo "Linking OMP plugin from $HERE"
 omp plugin link "$HERE"
 echo "--- Installation inventory (read-only) ---"
 node "$HERE/scripts/diagnose-install.mjs" || true
 echo 'IMPORTANT: Quit running OMP instances and START A NEW OMP PROCESS to load the new extension.'
 echo 'In new OMP: /pw-fast version (must say v2.0.3); then /pw-fast doctor.'
 exit 0
fi
if [[ "$MODE" == global ]]; then dest="$HOME/.omp/agent/skills/playwright-fast"; else
 [[ -d "$PROJECT" ]] || { echo 'Project directory missing' >&2; exit 2; }
 dest="$(cd "$PROJECT" && pwd)/.omp/skills/playwright-fast"
fi
if [[ -e "$dest" ]]; then
 if (( ! FORCE )); then echo "Already exists: $dest (use --force)" >&2; exit 1; fi
  backup="${dest}.bak.$(date +%s).$$"
  if [[ -e "$backup" ]]; then echo "Backup already exists: $backup" >&2; exit 1; fi
  mv -- "$dest" "$backup"
fi
mkdir -p "$(dirname "$dest")"
cp -a "$HERE/skills/playwright-fast" "$dest"
echo "Installed standalone skill: $dest (plugin commands/tools unavailable in standalone mode)"
