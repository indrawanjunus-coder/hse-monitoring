#!/bin/bash
set -e

echo "=== Pushing DB schema to production ==="
pnpm --filter @workspace/db run push-force

echo "=== Pruning pnpm store ==="
pnpm store prune

echo "=== Deploy script complete ==="
