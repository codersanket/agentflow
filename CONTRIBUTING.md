# Contributing Guidelines

Thank you for considering contributing to our project! Here are some guidelines to help you get started.

## Setting Up Your Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/repo-name.git
   cd repo-name
   ```

2. **Configure environment variables**
   - Copy `.env.example` to `.env` and configure the necessary environment variables, such as `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET_KEY`.

3. **Start infrastructure**
   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d
   ```
   This starts PostgreSQL, Redis, and any other required services.

4. **Install dependencies**
   - For Python (backend):
     ```bash
     cd apps/api
     poetry install
     ```
   - For Node.js (frontend):
     ```bash
     cd apps/web
     pnpm install
     ```

5. **Run database migrations**
   ```bash
   cd apps/api && alembic upgrade head
   ```

6. **Optional: Run Celery worker**
   - For async task execution, start the Celery worker:
     ```bash
     cd apps/api && celery -A workers.celery_app worker --loglevel=info
     ```
     Ensure `CELERY_ENABLED` is set to `true` in `.env`.

## Coding Standards

- Follow the PEP 8 style guide for Python code.
- Use Prettier and ESLint for JavaScript/TypeScript code. Ensure TypeScript is used in strict mode.
- Use async/await for all backend I/O operations.
- Scope all database queries by `org_id` to support multi-tenancy.
- Write clear, concise commit messages.
- Ensure all code changes are covered by tests.

## Pull Request Process

1. **Fork the repository** and create your feature branch from `main`.
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them. Follow the branch naming conventions and include descriptive commit messages.

3. **Run tests** to ensure everything is working as expected and all code is linted.
   - **Python tests:**
     ```bash
     cd apps/api
     poetry run pytest
     ```
   - **JavaScript/TypeScript tests:**
     ```bash
     cd apps/web
     pnpm lint
     pnpm test
     ```

4. **Push to your fork** and [submit a pull request](https://github.com/your-repo/repo-name/compare).

5. **Code Review**: Engage in the code review process. Reviewers may request changes before merging.

6. After review and passing all CI checks, your changes will be merged by an admin.

## Communication

- Use issues to report bugs or request features.
- Engage in discussions via pull requests and issues for any questions or clarifications.
- Ensure consistent communication with maintainers for a smooth contribution process.

We appreciate your contributions and look forward to collaborating with you!