import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
const { default: sql } = process.platform === 'win32'
    ? await import('mssql/msnodesqlv8.js')
    : await import('mssql');
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseConfig } from '../database/connection.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const categories = new Set(['Work', 'Personal', 'Errands', 'Ideas']);
const priorities = new Set(['high', 'medium', 'low']);
const fields = {
    title: 'title',
    category: 'category',
    priority: 'priority',
    due: 'due_at',
    done: 'is_done',
    alerted: 'is_alerted'
};
const pool = new sql.ConnectionPool({
    ...databaseConfig,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
});

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:'],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(express.json({ limit: '16kb' }));

function asyncRoute(handler) {
    return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function toDatabaseDate(value) {
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Due date must be a valid date.');
    return date;
}

function fromDatabaseDate(value) {
    return value ? new Date(value).toISOString() : null;
}

function mapTask(row) {
    return {
        id: row.id,
        title: row.title,
        category: row.category,
        priority: row.priority,
        due: fromDatabaseDate(row.due_at),
        done: Boolean(row.is_done),
        alerted: Boolean(row.is_alerted),
        created: fromDatabaseDate(row.created_at)
    };
}

function validateFields(input, { allowEmpty = false } = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { error: 'Request body must be a JSON object.' };
    }

    const entries = Object.entries(input);
    if (!entries.length && !allowEmpty) return { error: 'Provide at least one task field.' };
    const values = {};

    for (const [key, value] of entries) {
        if (!Object.hasOwn(fields, key)) return { error: `Unknown task field: ${key}.` };
        if (key === 'title') {
            if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 90) {
                return { error: 'Title must contain between 1 and 90 characters.' };
            }
            values[fields[key]] = value.trim();
        } else if (key === 'category') {
            if (!categories.has(value)) return { error: 'Choose a supported task category.' };
            values[fields[key]] = value;
        } else if (key === 'priority') {
            if (!priorities.has(value)) return { error: 'Choose a supported priority.' };
            values[fields[key]] = value;
        } else if (key === 'due') {
            try {
                values[fields[key]] = toDatabaseDate(value);
            } catch {
                return { error: 'Due date must be a valid date or empty.' };
            }
        } else if (typeof value !== 'boolean') {
            return { error: `${key} must be true or false.` };
        } else {
            values[fields[key]] = value;
        }
    }
    return { values };
}

async function initializeDatabase() {
    await pool.connect();
    await pool.request().query(`
    IF OBJECT_ID(N'dbo.tasks', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.tasks (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_daybook_tasks PRIMARY KEY,
        title NVARCHAR(90) NOT NULL,
        category NVARCHAR(16) NOT NULL
          CONSTRAINT CK_daybook_tasks_category CHECK (category IN (N'Work', N'Personal', N'Errands', N'Ideas')),
        priority VARCHAR(6) NOT NULL CONSTRAINT DF_daybook_tasks_priority DEFAULT 'medium'
          CONSTRAINT CK_daybook_tasks_priority CHECK (priority IN ('high', 'medium', 'low')),
        due_at DATETIME2(0) NULL,
        is_done BIT NOT NULL CONSTRAINT DF_daybook_tasks_done DEFAULT 0,
        is_alerted BIT NOT NULL CONSTRAINT DF_daybook_tasks_alerted DEFAULT 0,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_daybook_tasks_created DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_daybook_tasks_updated DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_daybook_tasks_created_at ON dbo.tasks (created_at DESC);
      CREATE INDEX IX_daybook_tasks_due_at ON dbo.tasks (due_at);
    END
  `);
}

app.get('/api/health', asyncRoute(async (_request, response) => {
    const databaseResult = await pool.request().query(`
      SELECT DB_NAME() AS databaseName, OBJECT_ID(N'dbo.tasks', N'U') AS tasksTableId
    `);
    if (!databaseResult.recordset[0].tasksTableId) {
        return response.status(503).json({ status: 'error', database: databaseResult.recordset[0].databaseName, error: 'dbo.tasks table is missing.' });
    }
    const taskResult = await pool.request().query('SELECT COUNT_BIG(*) AS taskCount FROM dbo.tasks');
    response.json({
        status: 'ok',
        database: databaseResult.recordset[0].databaseName,
        table: 'dbo.tasks',
        taskCount: Number(taskResult.recordset[0].taskCount),
        engine: 'Microsoft SQL Server'
    });
}));

app.get('/api/tasks', asyncRoute(async (_request, response) => {
    const result = await pool.request().query('SELECT * FROM dbo.tasks ORDER BY created_at DESC, id');
    response.json(result.recordset.map(mapTask));
}));

app.post('/api/tasks', asyncRoute(async (request, response) => {
    const { values, error } = validateFields(request.body);
    if (error) return response.status(400).json({ error });
    for (const required of ['title', 'category', 'priority']) {
        if (!(required in request.body)) return response.status(400).json({ error: `${required} is required.` });
    }

    const result = await pool.request()
        .input('id', sql.UniqueIdentifier, crypto.randomUUID())
        .input('title', sql.NVarChar(90), values.title)
        .input('category', sql.NVarChar(16), values.category)
        .input('priority', sql.VarChar(6), values.priority)
        .input('due_at', sql.DateTime2, values.due_at)
        .query(`
      INSERT INTO dbo.tasks (id, title, category, priority, due_at)
      OUTPUT INSERTED.*
      VALUES (@id, @title, @category, @priority, @due_at)
    `);
    response.status(201).json(mapTask(result.recordset[0]));
}));

app.patch('/api/tasks/:id', asyncRoute(async (request, response) => {
    const { values, error } = validateFields(request.body);
    if (error) return response.status(400).json({ error });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
        return response.status(400).json({ error: 'Task ID must be a valid UUID.' });
    }
    const query = pool.request().input('id', sql.UniqueIdentifier, request.params.id);
    const assignments = Object.entries(values).map(([column, value], index) => {
        const parameter = `value${index}`;
        const type = column === 'title' ? sql.NVarChar(90)
            : column === 'category' ? sql.NVarChar(16)
                : column === 'priority' ? sql.VarChar(6)
                    : column === 'due_at' ? sql.DateTime2
                        : sql.Bit;
        query.input(parameter, type, value);
        return `[${column}] = @${parameter}`;
    }).join(', ');
    const result = await query.query(`UPDATE dbo.tasks SET ${assignments}, updated_at = SYSUTCDATETIME() OUTPUT INSERTED.* WHERE id = @id`);
    if (!result.recordset.length) return response.status(404).json({ error: 'Task not found.' });
    response.json(mapTask(result.recordset[0]));
}));

app.delete('/api/tasks/:id', asyncRoute(async (request, response) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
        return response.status(400).json({ error: 'Task ID must be a valid UUID.' });
    }
    const result = await pool.request()
        .input('id', sql.UniqueIdentifier, request.params.id)
        .query('DELETE FROM dbo.tasks WHERE id = @id');
    if (!result.rowsAffected[0]) return response.status(404).json({ error: 'Task not found.' });
    response.status(204).end();
}));

app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found.' }));
app.use((error, _request, response, _next) => {
    console.error(error);
    if (response.headersSent) return;
    const status = error instanceof SyntaxError && 'body' in error ? 400 : 500;
    response.status(status).json({ error: status === 400 ? 'Request body contains invalid JSON.' : 'The server could not complete the request.' });
});

const root = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(root, '../dist');
app.use(express.static(distPath));
app.get('*', (_request, response) => response.sendFile(path.join(distPath, 'index.html')));

try {
    await initializeDatabase();
    const server = app.listen(port, () => console.log(`Daybook server listening on http://localhost:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => server.close(async () => {
            await pool.end();
            process.exit(0);
        }));
    }
} catch (error) {
    console.error('Unable to start Daybook. Check SQL Server and DB_* settings.', error.message);
    await pool.close().catch(() => { });
    process.exit(1);
}