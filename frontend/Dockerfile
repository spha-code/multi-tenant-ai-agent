# Dev-image for the Cloud Portal frontend.
# docker-compose bind-mounts ./frontend over /app and keeps node_modules in a
# named volume (seeded from this image on first run), so dependency installs
# happen once and live code edits are picked up by Vite's HMR.
FROM node:22-alpine

WORKDIR /app

# Install dependencies at build time so the first container start is fast.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Fallback install at start too: harmless no-op when the seeded volume exists,
# guarantees a working state if the volume starts empty.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"]
