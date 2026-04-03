# Use Python 3.12 as the base image to avoid Pydantic/spaCy compatibility issues with Python 3.14
FROM python:3.12-slim

# Set environment variables (PORT is used by run.py for the server port)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app

# Set working directory
WORKDIR /app

# Install system dependencies + uv
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -Ls https://astral.sh/uv/install.sh | sh \
    && mv /root/.local/bin/uv /usr/local/bin/uv

# Copy dependency files first for better layer caching
COPY pyproject.toml uv.lock ./

# Install Python dependencies (no dev extras, no editable install)
RUN uv sync --no-dev --no-editable

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN prisma generate --schema=prisma/schema.prisma

# Expose the port the app runs on (default 8080; override at run time with -e PORT=3000)
EXPOSE ${PORT}

CMD ["python", "run.py"]
