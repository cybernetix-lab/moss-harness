#!/usr/bin/env bash

set -e

echo "🦞 Installing mosscli globally..."

# Get the directory of the current script, then go up to the mosscli root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOSSCLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📁 Working directory: $MOSSCLI_ROOT"

cd "$MOSSCLI_ROOT"

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building mosscli..."
npm run build

echo "🔗 Linking mosscli globally..."
npm link

echo "✅ Success! mosscli has been installed globally."
echo ""
echo "You can now run:"
echo "  mosscli --help"
echo "  mosscli claw-migrate  (to integrate with OpenClaw)"
