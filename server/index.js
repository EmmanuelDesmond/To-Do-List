import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../database/connection.js';

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
    await pool.execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id CHAR(36) NOT NULL PRIMARY KEY,
                title VARCHAR(90) NOT NULL,
                category VARCHAR(16) NOT NULL,
                priority VARCHAR(6) NOT NULL DEFAULT 'medium',
                due_at DATETIME NULL,
                is_done BOOLEAN NOT NULL DEFAULT FALSE,
                is_alerted BOOLEAN NOT NULL DEFAULT FALSE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX IX_daybook_tasks_created_at (created_at DESC),
                INDEX IX_daybook_tasks_due_at (due_at)
            )
        `);
}

app.get('/api/health', asyncRoute(async (_request, response) => {
    const [[databaseResult]] = await pool.query('SELECT DATABASE() AS databaseName');
    const [[taskResult]] = await pool.query('SELECT COUNT(*) AS taskCount FROM tasks');
    response.json({
        status: 'ok',
        database: databaseResult.databaseName,
        table: 'tasks',
        taskCount: Number(taskResult.taskCount),
        engine: 'MySQL'
    });
}));

app.get('/api/tasks', asyncRoute(async (_request, response) => {
    const [rows] = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC, id');
    response.json(rows.map(mapTask));
}));

app.post('/api/tasks', asyncRoute(async (request, response) => {
    const { values, error } = validateFields(request.body);
    if (error) return response.status(400).json({ error });
    for (const required of ['title', 'category', 'priority']) {
        if (!(required in request.body)) return response.status(400).json({ error: `${required} is required.` });
    }

    const id = crypto.randomUUID();
    await pool.execute(
        'INSERT INTO tasks (id, title, category, priority, due_at) VALUES (?, ?, ?, ?, ?)',
        [id, values.title, values.category, values.priority, values.due_at]
    );
    const [[row]] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    response.status(201).json(mapTask(row));
}));

app.patch('/api/tasks/:id', asyncRoute(async (request, response) => {
    const { values, error } = validateFields(request.body);
    if (error) return response.status(400).json({ error });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
        return response.status(400).json({ error: 'Task ID must be a valid UUID.' });
    }
    const entries = Object.entries(values);
    const assignments = entries.map(([column]) => `\`${column}\` = ?`).join(', ');
    await pool.execute(
        `UPDATE tasks SET ${assignments}, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [...entries.map(([, value]) => value), request.params.id]
    );
    const [[row]] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [request.params.id]);
    if (!row) return response.status(404).json({ error: 'Task not found.' });
    response.json(mapTask(row));
}));

app.delete('/api/tasks/:id', asyncRoute(async (request, response) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
        return response.status(400).json({ error: 'Task ID must be a valid UUID.' });
    }
    const [result] = await pool.execute('DELETE FROM tasks WHERE id = ?', [request.params.id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Task not found.' });
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
    console.error('Unable to start Daybook. Check MySQL and DB_* settings.', error.message);
    await pool.end().catch(() => { });
    process.exit(1);
}