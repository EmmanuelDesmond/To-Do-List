import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { pool } from '../database/connection.js';
import { sendEmail } from './email.js';

const app = express();
const scrypt = promisify(scryptCallback);
const port = Number(process.env.PORT || 3001);
const sessionCookie = 'daybook_session';
const sessionLifetimeDays = 30;
const allowedOrigins = new Set((process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean));
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
app.use(cors({
    origin(origin, callback) {
        const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
            && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
        callback(null, !origin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin);
    },
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(express.json({ limit: '16kb' }));

// Send notification email to the signed-in user
app.post('/api/notify/email', validateRequestOrigin, requireAuth, asyncRoute(async (request, response) => {
    const { subject, text, html } = request.body || {};
    if (!subject || !text) return response.status(400).json({ error: 'Subject and text are required.' });
    try {
        await sendEmail({
            to: request.user.email,
            subject,
            text,
            html: html || undefined
        });
        response.json({ ok: true });
    } catch (error) {
        response.status(500).json({ error: 'Failed to send email.' });
    }
}));

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
        CREATE TABLE IF NOT EXISTS users (
            id CHAR(36) NOT NULL PRIMARY KEY,
            email VARCHAR(254) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY UQ_daybook_users_email (email)
        )
    `);
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX IX_daybook_sessions_user_id (user_id),
            INDEX IX_daybook_sessions_expires_at (expires_at),
            CONSTRAINT FK_daybook_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await pool.execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id CHAR(36) NOT NULL PRIMARY KEY,
                owner_id CHAR(36) NULL,
                title VARCHAR(90) NOT NULL,
                category VARCHAR(16) NOT NULL,
                priority VARCHAR(6) NOT NULL DEFAULT 'medium',
                due_at DATETIME NULL,
                is_done BOOLEAN NOT NULL DEFAULT FALSE,
                is_alerted BOOLEAN NOT NULL DEFAULT FALSE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX IX_daybook_tasks_owner_id (owner_id),
                INDEX IX_daybook_tasks_created_at (created_at DESC),
                INDEX IX_daybook_tasks_due_at (due_at),
                CONSTRAINT FK_daybook_tasks_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

    const [columns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'owner_id'");
    if (!columns.length) {
        await pool.execute(`
            ALTER TABLE tasks
            ADD COLUMN owner_id CHAR(36) NULL,
            ADD INDEX IX_daybook_tasks_owner_id (owner_id),
            ADD CONSTRAINT FK_daybook_tasks_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        `);
    }
}

function normalizedEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(value) {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateRequestOrigin(request, response, next) {
    const origin = request.get('origin');
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
        && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    if (origin && !allowedOrigins.has(origin) && !isLocalDevelopmentOrigin) {
        return response.status(403).json({ error: 'Request origin is not allowed.' });
    }
    next();
}

async function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return `scrypt$16384$8$1$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
    const [algorithm, cost, blockSize, parallelization, saltHex, keyHex] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, {
        N: Number(cost), r: Number(blockSize), p: Number(parallelization), maxmem: 64 * 1024 * 1024
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function digestSession(token) {
    return createHash('sha256').update(token).digest('hex');
}

function readSessionToken(request) {
    const entry = (request.headers.cookie || '').split(';').map(part => part.trim())
        .find(part => part.startsWith(`${sessionCookie}=`));
    return entry ? decodeURIComponent(entry.slice(sessionCookie.length + 1)) : '';
}

function setSessionCookie(response, token, remember = false) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const maxAge = remember ? `; Max-Age=${sessionLifetimeDays * 24 * 60 * 60}` : '';
    response.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secure}`);
}

function clearSessionCookie(response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader('Set-Cookie', `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function createSession(connection, userId, remember = false) {
    const token = randomBytes(32).toString('base64url');
    const lifetimeDays = remember ? sessionLifetimeDays : 1;
    await connection.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
    await connection.execute(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))',
        [digestSession(token), userId, lifetimeDays]
    );
    return token;
}

async function requireAuth(request, response, next) {
    try {
        const token = readSessionToken(request);
        if (!token) return response.status(401).json({ error: 'Sign in to continue.' });
        const [[user]] = await pool.execute(
            `SELECT users.id, users.email
             FROM sessions JOIN users ON users.id = sessions.user_id
             WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP()`,
            [digestSession(token)]
        );
        if (!user) {
            clearSessionCookie(response);
            return response.status(401).json({ error: 'Your session has expired. Sign in again.' });
        }
        request.user = user;
        next();
    } catch (error) {
        next(error);
    }
}

app.post('/api/auth/register', validateRequestOrigin, asyncRoute(async (request, response) => {
    const email = normalizedEmail(request.body?.email);
    const password = request.body?.password;
    if (!validEmail(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
        return response.status(400).json({ error: 'Password must be between 10 and 128 characters.' });
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [id, email, passwordHash]);
        await connection.execute('UPDATE tasks SET owner_id = ? WHERE owner_id IS NULL', [id]);
        const token = await createSession(connection, id, true);
        await connection.commit();
        setSessionCookie(response, token, true);
        response.status(201).json({ user: { id, email } });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ error: 'An account with that email already exists.' });
        throw error;
    } finally {
        connection.release();
    }
}));

app.post('/api/auth/login', validateRequestOrigin, asyncRoute(async (request, response) => {
    const email = normalizedEmail(request.body?.email);
    const password = request.body?.password;
    if (!validEmail(email) || typeof password !== 'string' || password.length > 128) {
        return response.status(400).json({ error: 'Enter a valid email and password.' });
    }
    const [[user]] = await pool.execute('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
    const passwordMatches = user ? await verifyPassword(password, user.password_hash) : false;
    if (!passwordMatches) return response.status(401).json({ error: 'Email or password is incorrect.' });

    const remember = request.body.remember === true;
    const token = await createSession(pool, user.id, remember);
    setSessionCookie(response, token, remember);
    response.json({ user: { id: user.id, email: user.email } });
}));

app.get('/api/auth/session', requireAuth, (request, response) => {
    response.json({ user: request.user });
});

app.post('/api/auth/logout', validateRequestOrigin, asyncRoute(async (request, response) => {
    const token = readSessionToken(request);
    if (token) await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [digestSession(token)]);
    clearSessionCookie(response);
    response.json({ ok: true });
}));

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

app.get('/api/tasks', requireAuth, asyncRoute(async (request, response) => {
    const [rows] = await pool.execute('SELECT * FROM tasks WHERE owner_id = ? ORDER BY created_at DESC, id', [request.user.id]);
    response.json(rows.map(mapTask));
}));

app.post('/api/tasks', validateRequestOrigin, requireAuth, asyncRoute(async (request, response) => {
    const { values, error } = validateFields(request.body);
    if (error) return response.status(400).json({ error });
    for (const required of ['title', 'category', 'priority']) {
        if (!(required in request.body)) return response.status(400).json({ error: `${required} is required.` });
    }

    const id = crypto.randomUUID();
    await pool.execute(
        'INSERT INTO tasks (id, owner_id, title, category, priority, due_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, request.user.id, values.title, values.category, values.priority, values.due_at]
    );
    const [[row]] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    response.status(201).json(mapTask(row));
}));

app.patch('/api/tasks/:id', validateRequestOrigin, requireAuth, asyncRoute(async (request, response) => {
    const { values, error } = validateFields(request.body);
    if (error) return response.status(400).json({ error });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
        return response.status(400).json({ error: 'Task ID must be a valid UUID.' });
    }
    const entries = Object.entries(values);
    const assignments = entries.map(([column]) => `\`${column}\` = ?`).join(', ');
    await pool.execute(
        `UPDATE tasks SET ${assignments}, updated_at = UTC_TIMESTAMP() WHERE id = ? AND owner_id = ?`,
        [...entries.map(([, value]) => value), request.params.id, request.user.id]
    );
    const [[row]] = await pool.execute('SELECT * FROM tasks WHERE id = ? AND owner_id = ?', [request.params.id, request.user.id]);
    if (!row) return response.status(404).json({ error: 'Task not found.' });
    response.json(mapTask(row));
}));

app.delete('/api/tasks/:id', validateRequestOrigin, requireAuth, asyncRoute(async (request, response) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
        return response.status(400).json({ error: 'Task ID must be a valid UUID.' });
    }
    const [result] = await pool.execute('DELETE FROM tasks WHERE id = ? AND owner_id = ?', [request.params.id, request.user.id]);
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