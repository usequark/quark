#!/usr/bin/env bash
set -euo pipefail

echo "Deploying Techstream OpenCode plugin..."

OPENCODE_DIR="${HOME}/.config/opencode"

if [ ! -d "$OPENCODE_DIR" ]; then
  echo "Error: OpenCode config directory not found at $OPENCODE_DIR"
  echo "Install OpenCode first, or manually copy the files."
  exit 1
fi

# Copy plugin entry point
mkdir -p "$OPENCODE_DIR/plugins"
cp src/index.js "$OPENCODE_DIR/plugins/techstream.js"

# Copy config and skills if they exist
if [ -d "config" ]; then
  cp -r config/* "$OPENCODE_DIR/"
fi

if [ -d "skills" ]; then
  mkdir -p "$OPENCODE_DIR/skills"
  cp -r skills/* "$OPENCODE_DIR/skills/"
fi

echo "Done. Techstream OpenCode plugin deployed to $OPENCODE_DIR"
