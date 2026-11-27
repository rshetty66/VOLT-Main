#!/usr/bin/env bash
# Usage: VOLT_USER=name verify_live.sh [base_url] path [path...]
# Waits up to 8 minutes for the site to answer, signs in with a username, prints each path's HTTP status.
set -u
BASE="${1:-https://volt-console.onrender.com}"; shift || true
USER_NAME="${VOLT_USER:?set VOLT_USER}"
jar=$(mktemp)
for i in $(seq 1 32); do
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/healthz"); [ "$c" = 200 ] && break; sleep 15
done
[ "$c" = 200 ] || { echo "site not healthy: $c"; exit 1; }
sleep 20
curl -s -c "$jar" -X POST "$BASE/api/login" -H 'content-type: application/json' -d "{\"username\":\"$USER_NAME\"}" >/dev/null
for p in "$@"; do echo "$p $(curl -s -b "$jar" -o /dev/null -w '%{http_code}' "$BASE$p")"; done
rm -f "$jar"
