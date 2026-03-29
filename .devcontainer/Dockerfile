# Dev container for Hooklab – Deno + Node.js
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Deno
ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh

# Install Node.js 22 (for Vite/npm tooling)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN deno --version && node --version && npm --version

# Pre-create cache directories
RUN mkdir -p /home/vscode/.cache/deno \
    && mkdir -p /home/vscode/.npm \
    && chown -R vscode:vscode /home/vscode/.cache /home/vscode/.npm

USER vscode
WORKDIR /workspace
