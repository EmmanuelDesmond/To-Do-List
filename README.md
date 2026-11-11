# Daybook

Daybook is a React task planner backed by a Node.js API and Microsoft SQL Server Express. The API is the source of truth for tasks; task changes are validated on the server and persisted in SQL Server.

## Requirements

- Node.js 20 or newer
- Microsoft SQL Server 2022 Express or a compatible SQL Server instance
- Microsoft ODBC Driver 17 for SQL Server
- Windows authentication is enabled for this machine's local `CLASS2` database

## Configure SQL Server

This project targets the local SQL Server Express instance `SQLEXPRESS` on the current machine. The database used by default is `CLASS2`.

Create or confirm the `CLASS2` database and make sure the `SQLEXPRESS` service is running. The app creates its `dbo.tasks` table automatically if it does not exist.

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

Set the same environment variables in the production process. Express serves the built frontend and API on `PORT` (default `3001`). Check `http://localhost:3001/api/health` to verify the API, database, `dbo.tasks` table, and stored task count. The app footer also displays the connected database name.

## View database data

After configuring `.env`, inspect the connection, list the database tables, and display up to 100 task rows with:

```powershell
npm run db:inspect
```

You can also query the data directly in SQL Server Management Studio or `sqlcmd`:

```sql
USE CLASS2;
SELECT id, title, category, priority, due_at, is_done, created_at
FROM dbo.tasks
ORDER BY created_at DESC;
```

## API

- `GET /api/health` checks server and database availability.
- `GET /api/tasks` lists tasks.
- `POST /api/tasks` creates a task. Required fields: `title`, `category`, and `priority`. Optional: `due`.
- `PATCH /api/tasks/:id` updates supplied task fields.
- `DELETE /api/tasks/:id` deletes a task.

Accepted categories are `Work`, `Personal`, `Errands`, and `Ideas`. Priorities are `high`, `medium`, and `low`. Due dates are ISO-8601 timestamps."# To-Do-List" 
