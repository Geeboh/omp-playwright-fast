#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE=plugin; PROJECT=""; FORCE=0
while (($#)); do
 case "$1" in
   --plugin) MODE=plugin; shift;;
   --global-skill) MODE=global; shift;;
   --project-skill) MODE=project; PROJECT="${2:?missing project directory}"; shift 2;;
   --force) FORCE=1; shift;;
   -h|--help) echo 'Usage: ./install.sh [--plugin|--global-skill|--project-skill DIR] [--force]'; exit 0;;
   *) echo "Unknown argument: $1" >&2; exit 2;;
 esac
done
if [[ "$MODE" == plugin ]]; then
 command -v omp >/dev/null || { echo 'omp CLI not found; install OMP first' >&2; exit 2; }
 echo "Linking OMP plugin from $HERE"
 omp plugin link "$HERE"
 echo 'Restart OMP or reload plugins, then run /pw-fast plan --profile affected'
 echo 'In new OMP: /pw-fast version (must say v2.0.3); then /pw-fast doctor.'
 exit 0
fi
if [[ "$MODE" == global ]]; then dest="$HOME/.omp/agent/skills/playwright-fast"; else
 [[ -d "$PROJECT" ]] || { echo 'Project directory missing' >&2; exit 2; }
 dest="$(cd "$PROJECT" && pwd)/.omp/skills/playwright-fast"
fi
if [[ -e "$dest" ]]; then
 if (( ! FORCE )); then echo "Already exists: $dest (use --force)" >&2; exit 1; fi
 mv "$dest" "${dest}.bak.$(date +%s)"
fi
mkdir -p "$(dirname "$dest")"
cp -a "$HERE/skills/playwright-fast" "$dest"
echo "Installed standalone skill: $dest (plugin commands/tools unavailable in standalone mode)"
