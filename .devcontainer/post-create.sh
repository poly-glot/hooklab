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

# Wait for parallel installs
FAILED=0

if [ -n "$ROOT_PID" ]; then
    echo "  Waiting for root install..."
    if ! wait $ROOT_PID; then
        echo "❌ root install failed:"; cat /tmp/root-install.log; FAILED=1
    else
        echo "  ✓ root install done"
    fi
fi

if [ -n "$CLIENT_PID" ]; then
    echo "  Waiting for client install..."
    if ! wait $CLIENT_PID; then
        echo "❌ client install failed:"; cat /tmp/client-install.log; FAILED=1
    else
        echo "  ✓ client install done"
    fi
fi

if [ -n "$FUNCTIONS_PID" ]; then
    echo "  Waiting for functions install..."
    if ! wait $FUNCTIONS_PID; then
        echo "❌ functions install failed:"; cat /tmp/functions-install.log; FAILED=1
    else
        echo "  ✓ functions install done"
    fi
fi

[ $FAILED -ne 0 ] && exit 1

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
