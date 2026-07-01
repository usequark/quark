FROM oven/bun:1 AS base

# Install OpenCode globally
RUN bun install -g opencode-ai@1.17.0

# Create config directory and copy files
# Note: COPY paths are relative to the Docker build context.
# When building locally from deploy/:  docker build -f deploy/Dockerfile .
# When building on Railway:            set Root Directory to apps/opencode/
#                                       build context is apps/opencode/
#                                       paths are relative (config/..., skills/...)
RUN mkdir -p /root/.config/opencode
COPY config/opencode.json /root/.config/opencode/opencode.json
COPY config/prompts/ /root/.config/opencode/prompts/
COPY skills/ /root/.config/opencode/skills/

# Setup MCP server
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/* && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY mcp/ /app/mcp/
RUN cd /app/mcp && npm install --omit=dev

# Expose the OpenCode server port
EXPOSE 4096

# Start the headless server
CMD ["opencode", "serve", "--port", "4096", "--hostname", "0.0.0.0"]
