#!/bin/sh
# ~/Workspaces/graphx es la fuente única del motor. Esto regenera dist/ y copia el motor
# a las otras dos instalaciones: la skill pr-review-artifact-v5 y la carpeta de desarrollo.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
node "$HERE/tools/build-dist.mjs" 2>&1 | grep -v "equals-negative\|3402\|~~~\|Floating\|╵\|WARNING" | sed '/^$/d'
# la skill lleva una réplica exacta del paquete (misma estructura, tools/ incluido)
SK="$HOME/.claude/skills/pr-review-artifact-v5/assets/graphx"
if [ -d "$(dirname "$SK")" ]; then
  rsync -a --delete --delete-excluded --exclude node_modules --exclude '*.html' --exclude '.DS_Store' --exclude '*.bak*' \
    --exclude package-lock.json --exclude 'examples/warehouses-*' --exclude tools/sync.sh "$HERE/" "$SK/"
  echo "  → $SK (réplica)"
fi
for DEST in "$HOME/Workspaces/pr-artifact-review-v5/graph-engine"; do
  [ -d "$DEST" ] || continue
  mkdir -p "$DEST/dist" "$DEST/vendor"
  cp "$HERE/graphx.js" "$HERE/graphx.css" "$HERE/graphx-mermaid.js" "$HERE/graphx-shapes.js" "$HERE/graphx-build.mjs" "$DEST/"
  cp "$HERE"/dist/*.js "$HERE"/dist/*.css "$DEST/dist/"
  cp "$HERE/vendor/elk.bundled.js" "$DEST/vendor/"
  for t in verify.mjs snap-depth.mjs snapshot-svg.mjs build-dist.mjs; do
    # en las otras instalaciones las herramientas viven junto al motor, no en tools/
    sed -e "s#new URL('../graphx.css'#new URL('./graphx.css'#" -e "s#path.dirname(path.dirname(fileURLToPath(import.meta.url)))#path.dirname(fileURLToPath(import.meta.url))#" "$HERE/tools/$t" > "$DEST/$t"
  done
  echo "  → $DEST"
done
for f in graphx.js graphx.css graphx-mermaid.js graphx-shapes.js; do
  diff -q "$HERE/$f" "$HOME/.claude/skills/pr-review-artifact-v5/assets/graphx/$f" >/dev/null && diff -q "$HERE/$f" "$HOME/Workspaces/pr-artifact-review-v5/graph-engine/$f" >/dev/null || { echo "✗ $f distinto"; exit 1; }
done
echo "✓ las tres copias del motor son idénticas (v$(grep -o "version: '[0-9.]*'" "$HERE/graphx.js" | grep -o "[0-9.]*[0-9]"))"
