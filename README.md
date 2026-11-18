# Daybook

Daybook is a React task planner backed by a Node.js API and MySQL. The API is the source of truth for tasks; task changes are validated on the server and persisted in MySQL.

## Requirements

- Node.js 20 or newer
- MySQL 8 or a compatible MySQL service

## Configure MySQL

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for your MySQL service. For services that require TLS, set `DB_CA_CERT` to the provider's PEM CA certificate. The app creates its `tasks` table automatically if it does not exist.

## Configure and run

Copy `.env.example` to `.env` and update the connection when needed. Install dependencies and start both development servers:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The Node API listens on port `3001` by default, and Vite proxies `/api` requests to it.

## Production

```powershell
npm run build
npm start
```

Set the same environment variables in the production process. Express serves the built frontend and API on `PORT` (default `3001`). Check `http://localhost:3001/api/health` to verify the API, database, `tasks` table, and stored task count. The app footer also displays the connected database name.

### Deploy on Render

The root `render.yaml` defines a Render web service and pre-fills the Aiven host, port, database, and username. In Render, set the requested `DB_PASSWORD` and `DB_CA_CERT` values. Paste the complete CA certificate, including the `BEGIN CERTIFICATE` and `END CERTIFICATE` lines, into `DB_CA_CERT`. The service health check uses `/api/health`, so the database must be reachable and the app must be able to create or access `tasks` before deployment becomes healthy.

### Deploy the frontend on Vercel

The Render Blueprint allows the Vercel origin through `CORS_ORIGIN`. After deploying the backend, add `VITE_API_URL` to the Vercel project's environment variables with the full Render service URL (for example, `https://daybook-todo.onrender.com`, without a trailing slash), then redeploy the Vercel project. Keep `CORS_ORIGIN` set to the exact Vercel origin `https://fullstacktaskmanager-drab.vercel.app` in Render. For local development, leave `VITE_API_URL` empty; Vite will proxy `/api` to the local API.

## View database data

After configuring `.env`, inspect the connection, list the database tables, and display up to 100 task rows with:

```powershell
npm run db:inspect
```

You can also query the data directly in a MySQL client:

```sql
USE defaultdb;
SELECT id, title, category, priority, due_at, is_done, created_at
FROM tasks
ORDER BY created_at DESC;
```

## API

- `POST /api/auth/register` creates an account from an email and a password (10–128 characters) and signs it in.
- `POST /api/auth/login` starts a session. Sessions are stored server-side and use an HTTP-only cookie; the optional `remember` field keeps the session for up to 30 days.
- `GET /api/auth/session` returns the signed-in account; `POST /api/auth/logout` ends its session.
- `GET /api/health` checks server and database availability.
- Task endpoints require a signed-in account and only return or modify that account's tasks. Existing tasks without an owner are assigned to the first newly registered account.
- `GET /api/tasks` lists the signed-in account's tasks.
- `POST /api/tasks` creates a task. Required fields: `title`, `category`, and `priority`. Optional: `due`.
- `PATCH /api/tasks/:id` updates supplied task fields.
- `DELETE /api/tasks/:id` deletes a task.

Accepted categories are `Work`, `Personal`, `Errands`, and `Ideas`. Priorities are `high`, `medium`, and `low`. Due dates are ISO-8601 timestamps."# To-Do-List" 
