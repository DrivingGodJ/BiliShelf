#!/bin/zsh

set -u

HEALTH_URL="https://bilishelf-memory-proxy.bilishelf-memory-proxy.workers.dev/api/health"
ALLOWED_ORIGIN="https://drivinggodj.github.io"
TUNNEL_LABEL="com.drivinggodj.bilishelf-tunnel"
RESTART_COOLDOWN_SECONDS=600
STATE_FILE="${TMPDIR:-/tmp}/com.drivinggodj.bilishelf-watchdog.last-restart"

is_healthy() {
  /usr/bin/curl \
    --silent \
    --show-error \
    --fail \
    --max-time 8 \
    --header "Origin: ${ALLOWED_ORIGIN}" \
    "${HEALTH_URL}" \
    >/dev/null
}

if is_healthy; then
  exit 0
fi

/bin/sleep 8

if is_healthy; then
  exit 0
fi

timestamp=$(/bin/date "+%Y-%m-%dT%H:%M:%S%z")
now=$(/bin/date "+%s")
last_restart=0
if [[ -r "${STATE_FILE}" ]]; then
  last_restart=$(<"${STATE_FILE}")
fi
if [[ "${last_restart}" == <-> ]] && (( now - last_restart < RESTART_COOLDOWN_SECONDS )); then
  echo "${timestamp} Tunnel remains unhealthy; restart skipped during cooldown"
  exit 0
fi

user_id=$(/usr/bin/id -u)
echo "${timestamp} Tunnel health check failed twice; restarting ${TUNNEL_LABEL}"
print -r -- "${now}" >"${STATE_FILE}"
/bin/launchctl kickstart -k "gui/${user_id}/${TUNNEL_LABEL}"
