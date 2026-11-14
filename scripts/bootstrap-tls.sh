#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/secrets/tls"
DAYS="${TLS_DAYS:-825}"
NAMES="DNS:localhost,IP:127.0.0.1,DNS:db-bouncer,DNS:redis-cache,DNS:redis-queue,DNS:rabbitmq,DNS:kafka,DNS:temporal"

mkdir -p "$DIR"
cd "$DIR"

if [ ! -f ca.key ]; then
  openssl ecparam -name prime256v1 -genkey -noout -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days "$DAYS" -subj "/CN=marketplace local CA" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -out ca.crt
fi

openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -out server.key
openssl req -new -key server.key -subj "/CN=marketplace local services" -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -sha256 -days "$DAYS" -out server.crt \
  -extfile <(printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\n' "$NAMES")
rm -f server.csr ca.srl
cat server.key server.crt > server-keystore.pem
chmod 600 ca.key server.key server-keystore.pem

echo "secrets/tls: ca.crt, server.crt ($NAMES), valid $DAYS days" >&2
