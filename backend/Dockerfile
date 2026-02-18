# Use Python 3.12 as the base image to avoid Pydantic/spaCy compatibility issues with Python 3.14
FROM python:3.12-slim

# Set environment variables (PORT is used by run.py for the server port)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install spaCy model
RUN python3 -m spacy download en_core_web_trf

# Copy the rest of the application code
COPY . .

# Generate Prisma client (if needed)
RUN prisma generate --schema=prisma/schema.prisma

# Expose the port the app runs on (default 8080; override at run time with -e PORT=3000)
EXPOSE ${PORT}

# Command to run the application
# Using run.py as the entry point based on the project structure
CMD ["python", "run.py"]
