# Small Society Management

A containerized MVP for managing a small residential society.

## Included
- React + Nginx frontend
- FastAPI backend
- PostgreSQL 16 database
- JWT login
- Dashboard
- Members / flats
- Monthly maintenance and payment status
- Expenses
- Complaints
- Notices
- Docker Compose
- Seed data

## Run

Prerequisite: Docker Desktop / Docker Engine with Compose.

```bash
docker compose up -d --build
```

Open: http://localhost:3000

API docs: http://localhost:8000/docs

Default login:
- Email: admin@pleasantpalace.local
- Password: admin123

## Stop
```bash
docker compose down
```

## Remove database too
```bash
docker compose down -v
```

## Production notes
Change POSTGRES_PASSWORD and JWT_SECRET. Put the app behind HTTPS and use a managed PostgreSQL service or encrypted backups for production. This MVP uses a single admin role; role-based resident/security/treasurer access can be added next.
