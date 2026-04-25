#!/usr/bin/env bash
# Creates monthly evidence folders and seeds template copies.

CURRENT_MONTH="$(date +%Y-%m)"
BASE_DIR="$(dirname "$0")/../../compliance/evidence"
TEMPLATE_DIR="$BASE_DIR/templates"
RECORD_DIR="$BASE_DIR/records/$CURRENT_MONTH"

mkdir -p "$RECORD_DIR"

for f in "$TEMPLATE_DIR"/*.csv; do
  name="$(basename "$f")"
  out="$RECORD_DIR/$name"
  if [ ! -f "$out" ]; then
    cp "$f" "$out"
  fi
done

echo "Evidence folder prepared: $RECORD_DIR"
