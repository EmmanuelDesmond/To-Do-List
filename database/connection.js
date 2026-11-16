import 'dotenv/config';
import mysql from 'mysql2/promise';

const ca = process.env.DB_CA_CERT?.replaceAll('\\n', '\n');

export const databaseName = process.env.DB_NAME || 'defaultdb';
export const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: databaseName,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z'
});