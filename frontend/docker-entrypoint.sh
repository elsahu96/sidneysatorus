#!/bin/sh
set -e
# Cloud Run sets PORT; default 8080 for nginx
export PORT="${PORT:-8080}"
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
