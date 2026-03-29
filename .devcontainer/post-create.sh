#!/bin/bash
set -e

echo "⚡ ULTRA-FAST post-create setup for Hooklab..."

# ============================================================
# Fix permissions (minimal, non-blocking)
# ============================================================
sudo chown -R "$(id -u):$(id -g)" ~/.cache ~/.npm 2>/dev/null || true

# ============================================================
# Claude Code config - symlink ~/.claude.json from mounted dir
# ============================================================
if [ -f ~/.claude/.claude.json ] && [ ! -e ~/.claude.json ]; then
    ln -s ~/.claude/.claude.json ~/.claude.json
fi

# ============================================================
# NPM - optimized config
# ============================================================
npm config set cache ~/.npm
npm config set update-notifier false
npm config set fund false
npm config set audit false

# ============================================================
# Git - minimal config
# ============================================================
git config --global --add safe.directory /workspace
git config --global init.defaultBranch main
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.ci commit

# ============================================================
# Shell aliases - single write
# ============================================================
cat >> ~/.zshrc <<'EOF'
# Claude
alias claude="claude --dangerously-skip-permissions"

# Hooklab shortcuts
alias dev-client='cd /workspace/client && npm run dev'
alias dev-server='cd /workspace/server && deno task dev'
alias fb-emulators='firebase emulators:start'
alias install-all='npm install && cd client && npm install && cd ..'

# Docker
alias dc='docker compose'
alias dcup='docker compose up -d'
alias dcdown='docker compose down'

EOF

[ -f ~/.bashrc ] && ! grep -q 'exec zsh' ~/.bashrc && echo '[ -t 1 ] && exec zsh' >> ~/.bashrc

# ============================================================
# Install dependencies IN PARALLEL
# ============================================================
echo "📦 Installing dependencies (parallel)..."
cd /workspace

# Only install if package.json exists (skip if none)
if [ -f "package.json" ]; then
    npm install --no-audit --no-fund --prefer-offline > /tmp/root-install.log 2>&1 &
    ROOT_PID=$!
fi

if [ -f "client/package.json" ]; then
    (cd client && npm install --no-audit --no-fund --prefer-offline > /tmp/client-install.log 2>&1) &
    CLIENT_PID=$!
fi

if [ -f "functions/package.json" ]; then
    (cd functions && npm install --no-audit --no-fund --prefer-offline > /tmp/functions-install.log 2>&1) &
    FUNCTIONS_PID=$!
fi

# Show progress while waiting for parallel installs
PIDS=()
[ -n "$ROOT_PID" ] && PIDS+=($ROOT_PID)
[ -n "$CLIENT_PID" ] && PIDS+=($CLIENT_PID)
[ -n "$FUNCTIONS_PID" ] && PIDS+=($FUNCTIONS_PID)

SPINNER='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
i=0
while true; do
    ALL_DONE=true
    for PID in "${PIDS[@]}"; do
        if kill -0 "$PID" 2>/dev/null; then
            ALL_DONE=false
            break
        fi
    done
    $ALL_DONE && break

    # Print spinner with latest log tail
    CHAR="${SPINNER:$((i % ${#SPINNER})):1}"
    ROOT_MSG=$(tail -1 /tmp/root-install.log 2>/dev/null | sed 's/^[[:space:]]*//' | cut -c1-60)
    CLIENT_MSG=$(tail -1 /tmp/client-install.log 2>/dev/null | sed 's/^[[:space:]]*//' | cut -c1-60)
    printf "\r%s  root: %-62s" "$CHAR" "${ROOT_MSG:-waiting...}"
    printf "\n%s  client: %-60s" "$CHAR" "${CLIENT_MSG:-waiting...}"
    printf "\033[1A"  # move cursor up 1 line
    i=$((i + 1))
    sleep 0.3
done
printf "\r%-80s\n%-80s\n" "" ""  # clear spinner lines

# Check exit codes
[ -n "$ROOT_PID" ] && wait $ROOT_PID || { echo "❌ root install failed — see /tmp/root-install.log"; cat /tmp/root-install.log; exit 1; }
[ -n "$CLIENT_PID" ] && wait $CLIENT_PID || { echo "❌ client install failed — see /tmp/client-install.log"; cat /tmp/client-install.log; exit 1; }
[ -n "$FUNCTIONS_PID" ] && wait $FUNCTIONS_PID || { echo "❌ functions install failed — see /tmp/functions-install.log"; cat /tmp/functions-install.log; exit 1; }

# ============================================================
# Done!
# ============================================================
echo ""
echo "✅ Setup complete! (Node $(node --version), NPM $(npm --version))"
echo ""
echo "Quick start:"
echo "  dev-client        → Start Vite dev server (client)"
echo "  dev-server        → Start Deno API server"
echo "  fb-emulators      → Start Firebase emulators"
echo "  install-all       → Install all dependencies"
echo ""
