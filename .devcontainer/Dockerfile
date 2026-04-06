# Dev container for Hooklab – Deno + Node.js + Playwright
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Deno
ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh

# Install Node.js 22 (for Vite/npm tooling)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies (for Chromium headless)
# These are the shared libraries Chromium needs at runtime.
RUN npx --yes playwright@latest install-deps chromium

# Verify installations
RUN deno --version && node --version && npm --version

# Pre-create cache directories
RUN mkdir -p /home/vscode/.cache/deno \
    && mkdir -p /home/vscode/.npm \
    && mkdir -p /home/vscode/.cache/ms-playwright \
    && chown -R vscode:vscode /home/vscode/.cache /home/vscode/.npm

USER vscode

# Install Playwright browser binaries as vscode user
# This downloads Chromium to ~/.cache/ms-playwright
RUN npx --yes playwright@latest install chromium

WORKDIR /workspace
