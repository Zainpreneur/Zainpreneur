#!/usr/bin/env bash
# Bring the API and the client up together, and keep them up.
#
# Written because of an actual failure: the API was restarted once, the database was
# reset, and the API was never restarted again — so the app sat there reporting
# "Something went wrong" with no way to tell that the process simply was not running.
#
#   bash tools/dev.sh          run both until Ctrl-C
#   bash tools/dev.sh --check  report whether both are up, start whatever is not
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_PORT="${PORT:-5178}"
CLIENT_PORT=5173
BIN="$ROOT/node_modules/.bin"

api_up() { curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$API_PORT/api/health"; }
client_up() { curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$CLIENT_PORT/"; }

wait_for() {  # wait_for <name> <probe> <tries>
  local name="$1" probe="$2" tries="${3:-30}" i=0
  while [ "$i" -lt "$tries" ]; do
    $probe && { echo "  $name is up"; return 0; }
    i=$((i + 1))
    sleep 1
  done
  echo "  $name did NOT come up — see the log above"
  return 1
}

pids=()
stop_children() {
  for pid in "${pids[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null
  done
}

start_api() {
  if api_up; then echo "  api already running on $API_PORT"; return 0; fi
  echo "starting api on http://127.0.0.1:$API_PORT"
  PORT="$API_PORT" "$BIN/tsx" --experimental-sqlite server/src/index.ts &
  pids+=($!)
  wait_for "api" api_up
}

start_client() {
  if client_up; then echo "  client already running on $CLIENT_PORT"; return 0; fi
  echo "starting client on http://127.0.0.1:$CLIENT_PORT"
  (cd client && "$BIN/vite") &
  pids+=($!)
  wait_for "client" client_up
}

if [ "${1:-}" = "--check" ]; then
  echo "checking…"
  rc=0
  api_up    || { echo "  api    DOWN on $API_PORT"; rc=1; }
  client_up || { echo "  client DOWN on $CLIENT_PORT"; rc=1; }
  [ "$rc" = 0 ] && echo "  both are up"
  # No trap is installed for --check, so nothing needs stopping here.
  exit "$rc"
fi

trap 'echo; echo "stopping…"; stop_children' EXIT INT TERM

echo "zainpreneur"
start_api
start_client
echo
echo "  register → http://127.0.0.1:$CLIENT_PORT"
echo "  api      → http://127.0.0.1:$API_PORT/api/health"
echo
echo "Ctrl-C stops both."

# Keep running; exit as soon as either process does, so a crash is visible rather
# than leaving one half of the app up and looking like the other half is broken.
while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "a process exited — stopping the other"
      exit 1
    fi
  done
  sleep 2
done