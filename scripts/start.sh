#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate

echo "Migrations complete. Starting Next.js..."
exec node server.js
