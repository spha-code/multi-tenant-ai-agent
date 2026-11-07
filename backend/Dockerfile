# uv base image: python 3.12 + uv preinstalled (self-managed uv keeps the
# Dockerfile free of pip upgrade steps).
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Deps first for layer caching: sync the exact lockfile (reproducible builds).
# The project is "virtual" (no build-system), so sync only installs deps
# into /app/.venv.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

# --no-sync: don't re-resolve at container start; the venv was frozen at build.
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
