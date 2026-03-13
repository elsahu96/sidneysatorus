# Welcome to Sidney

## Dev Setup Guide

### Frontend

1. Navigate to the frontend directory:
   ```sh
   cd frontend
   ```
2. Install the necessary dependencies:
   ```sh
   npm install
   ```
3. Start the development server with auto-reloading and an instant preview:
   ```sh
   npm run dev
   ```

### Backend

1. Navigate to the backend directory:
   ```sh
   cd backend
   ```
2. Install dependencies using [uv](https://docs.astral.sh/uv/) (reads `pyproject.toml`):
   ```sh
   uv sync --extra dev
   ```
   This automatically creates a `.venv` and a `uv.lock` lockfile. To install without dev dependencies (e.g. in production):
   ```sh
   uv sync
   ```
3. Run the backend server:
   ```sh
   uv run python run.py
   ```
   Or with uvicorn directly:
   ```sh
   uv run uvicorn src.api.main:app --reload
   ```

### Docker

#### Backend

To run the backend service using Docker:

1. Build the Docker image:
   ```sh
   docker build -t backend-service backend/
   ```
2. Run the container:
   ```sh
   docker run -p 8080:8080 backend-service
   ```

#### Frontend

To run the frontend service using Docker:

1. Build the Docker image:
   ```sh
   docker build -t frontend-service frontend/
   ```
2. Run the container:
   ```sh
   docker run -p 4567:4567 frontend-service
   ```

### Docker Compose (Recommended)

To run both frontend and backend together:

```sh
docker-compose up --build
```

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- Python
- React
- shadcn-ui
- Tailwind CSS
