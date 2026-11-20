#!/usr/bin/env bash
set -euo pipefail
COMMAND="${1:-help}"; [[ $# -gt 0 ]] && shift
PROFILE=quick; BROWSER=chromium; WORKERS=""; SHARD=""; DRY=0; WITH_DEPS=0; CI_MODE=0; TARGET=""; BASE_URL=""; GREP=""; MAX_FAILURES=""; LIST=0
usage(){ cat <<'HELP'
pw-fast.sh <doctor|setup|run|help> [options]
  --profile smoke|quick|changed|failed|matrix|full (default quick)
  --browser chromium|firefox|webkit|all (setup; run profiles select their documented projects)
  --workers N       positive integer, maximum worker pool size
  --shard I/N        Playwright shard (intended for separate CI agents)
  --target PATTERN   Playwright test file path or filter
  --grep REGEX       Playwright test title/tag filter
  --base-url URL     set PW_BASE_URL (if config supports it)
  --max-failures N   fail-fast threshold
  --with-deps        opt in to Linux system package changes (setup only)
  --ci               CI mode (sets CI=1 for run)
  --list             list selected tests without executing
  --dry-run          print operations; do not install or execute
Requires project-local @playwright/test (or bootstrap via setup).
HELP
}
die(){ echo "ERROR: $*" >&2; exit 2; }
while (($#)); do
 case "$1" in
  --profile|--browser|--workers|--shard|--target|--grep|--base-url|--max-failures)
    opt="$1"; (($# >= 2)) || die "$opt needs value"; val="$2"; shift 2
    case "$opt" in
    --profile) PROFILE="$val";; --browser) BROWSER="$val";; --workers) WORKERS="$val";; --shard) SHARD="$val";; --target) TARGET="$val";; --grep) GREP="$val";; --base-url) BASE_URL="$val";; --max-failures) MAX_FAILURES="$val";; esac;;
  --dry-run) DRY=1; shift;; --with-deps) WITH_DEPS=1; shift;; --ci) CI_MODE=1; shift;; --list) LIST=1; shift;;
  -h|--help) usage; exit 0;; *) die "Unknown arg: $1";;
 esac
done
[[ -f package.json ]] || { [[ "$COMMAND" == help ]] && { usage; exit 0; }; die 'Run from a Node project root (package.json missing).'; }
case "$BROWSER" in chromium|firefox|webkit|all) ;; *) die 'Invalid browser' ;; esac
case "$PROFILE" in smoke|quick|changed|failed|matrix|full) ;; *) die 'Invalid profile' ;; esac
if [[ -n "$WORKERS" ]]; then [[ "$WORKERS" =~ ^[1-9][0-9]*$ ]] || die 'workers must be positive integer'; fi
if [[ -n "$MAX_FAILURES" ]]; then [[ "$MAX_FAILURES" =~ ^[1-9][0-9]*$ ]] || die 'max-failures must be positive integer'; fi
if [[ -n "$SHARD" ]]; then [[ "$SHARD" =~ ^[1-9][0-9]*/[1-9][0-9]*$ ]] || die 'shard should be I/N'; I="${SHARD%/*}"; N="${SHARD#*/}"; ((I<=N)) || die 'shard index exceeds total'; fi
[[ -z "$TARGET" || "$TARGET" != -* ]] || die 'target must not start with -'
PM=npm
if [[ -f pnpm-lock.yaml ]]; then PM=pnpm
elif [[ -f yarn.lock ]]; then PM=yarn
elif [[ -f bun.lock || -f bun.lockb ]]; then PM=bun
fi
case "$PM" in npm) EXEC=(./node_modules/.bin/playwright); ADD=(npm install --save-dev @playwright/test);; pnpm) EXEC=(pnpm exec playwright); ADD=(pnpm add -D @playwright/test);; yarn) EXEC=(yarn playwright); ADD=(yarn add -D @playwright/test);; bun) EXEC=(bunx --no-install playwright); ADD=(bun add -d @playwright/test);; esac
run_command(){ if ((DRY)); then printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
configured(){ [[ -f playwright.config.ts || -f playwright.config.js || -f playwright.config.mts || -f playwright.config.mjs || -f playwright.config.cts || -f playwright.config.cjs ]]; }
installed(){ [[ -x node_modules/.bin/playwright ]]; }
case "$COMMAND" in
 help) usage;;
 doctor)
  echo "pwd=$PWD manager=$PM playwright_installed=$(installed && echo yes || echo no) config_present=$(configured && echo yes || echo no)"
  command -v node >/dev/null && node -v || true
  command -v "$PM" >/dev/null && "$PM" --version || true
  if installed; then run_command ./node_modules/.bin/playwright --version; fi
  ;;
 setup)
  command -v "$PM" >/dev/null || die "Package manager $PM not found"
  if ! installed; then run_command "${ADD[@]}"; fi
  if ! configured; then
    src="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/templates/playwright.config.ts"
    if ((DRY)); then echo "DRY RUN: copy $src -> $PWD/playwright.config.ts"; else cp "$src" playwright.config.ts; echo 'Created playwright.config.ts'; fi
  else echo 'Preserving existing playwright config'; fi
  if [[ "$BROWSER" == all ]]; then browsers=(chromium firefox webkit); else browsers=("$BROWSER"); fi
  if ((WITH_DEPS)); then
     run_command "${EXEC[@]}" install --with-deps "${browsers[@]}"
  else
     run_command "${EXEC[@]}" install "${browsers[@]}"
  fi
  ;;
 run)
  installed || die 'Playwright not installed; first run setup'
  configured || die 'Playwright config missing; run setup'
  cmd=("${EXEC[@]}" test)
  [[ -z "$TARGET" ]] || cmd+=("$TARGET")
  case "$PROFILE" in
   smoke) cmd+=(--project=chromium --grep @smoke);;
   quick|changed|failed) cmd+=(--project=chromium);;
   matrix|full) ;;
  esac
  [[ "$PROFILE" == changed ]] && cmd+=(--only-changed)
  [[ "$PROFILE" == failed ]] && cmd+=(--last-failed)
  [[ -z "$GREP" ]] || cmd+=(--grep "$GREP")
  [[ -z "$WORKERS" ]] || cmd+=(--workers "$WORKERS")
  [[ -z "$SHARD" ]] || cmd+=(--shard "$SHARD")
  [[ -z "$MAX_FAILURES" ]] || cmd+=(--max-failures "$MAX_FAILURES")
  ((LIST)) && cmd+=(--list)
  if ((DRY)); then
    printf 'DRY RUN:'
    ((CI_MODE)) && printf ' CI=1'
    [[ -z "$BASE_URL" ]] || printf ' PW_BASE_URL=%q' "$BASE_URL"
    printf ' %q' "${cmd[@]}"
    printf '\n'
    exit 0
  fi
  mkdir -p .playwright-fast
  started=$SECONDS
  set +e
  if ((CI_MODE)); then export CI=1; fi
  [[ -z "$BASE_URL" ]] || export PW_BASE_URL="$BASE_URL"
  "${cmd[@]}" 2>&1 | tee .playwright-fast/last-run.log
  status=${PIPESTATUS[0]}
  set -e
  printf 'profile=%s browsers=%s elapsed_seconds=%s exit_code=%s log=%s\n' "$PROFILE" "$([[ $PROFILE == matrix || $PROFILE == full ]] && echo 'configured projects' || echo chromium)" "$((SECONDS-started))" "$status" '.playwright-fast/last-run.log' | tee .playwright-fast/last-run.summary
  exit "$status";;
 *) die "Unknown command: $COMMAND";;
esac
