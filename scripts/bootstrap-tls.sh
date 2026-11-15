#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/secrets/tls"
DAYS="${TLS_DAYS:-825}"
NAMES="DNS:localhost,IP:127.0.0.1,DNS:db-bouncer,DNS:redis-cache,DNS:redis-queue,DNS:rabbitmq,DNS:kafka,DNS:temporal,DNS:temporal-tls"

mkdir -p "$DIR"
cd "$DIR"

# The CA may sign only these names: a browser or client that trusts it accepts nothing it signs for any other host,
# so a leaked key can't impersonate google.com. A DNS constraint also covers subdomains (localhost -> marketplace.localhost).
CONSTRAINTS="$(printf '%s' "$NAMES" | tr ',' '\n' | sed -e 's|^IP:\(.*\)$|permitted;IP:\1/255.255.255.255|' -e 's|^DNS:|permitted;DNS:|' | paste -sd, -)"

EXPECTED="$(printf '%s' "$NAMES" | tr ',' '\n' | sed 's|^IP:\(.*\)$|IP:\1/255.255.255.255|' | sort)"
ACTUAL="$( [ -f ca.crt ] && openssl x509 -in ca.crt -noout -ext nameConstraints 2>/dev/null | sed -n 's/^ *\(DNS:\|IP:\)/\1/p' | sort)"

if [ -f ca.crt ] && [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "secrets/tls: the CA's name constraints don't match the names, replacing it; reissue everything it signed" >&2
  shred -u ca.key ca.crt 2>/dev/null || rm -f ca.key ca.crt
fi

if [ ! -f ca.key ]; then
  openssl ecparam -name prime256v1 -genkey -noout -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days "$DAYS" -subj "/CN=marketplace local CA" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "nameConstraints=critical,$CONSTRAINTS" -out ca.crt
fi

openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -out server.key
openssl req -new -key server.key -subj "/CN=marketplace local services" -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -sha256 -days "$DAYS" -out server.crt \
  -extfile <(printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\n' "$NAMES")
rm -f server.csr ca.srl
cat server.key server.crt > server-keystore.pem
chmod 600 ca.key server.key server-keystore.pem

echo "secrets/tls: ca.crt, server.crt ($NAMES), valid $DAYS days" >&2
