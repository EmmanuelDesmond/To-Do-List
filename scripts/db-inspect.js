import { databaseName, pool } from '../database/connection.js';

try {
    const [[databaseResult]] = await pool.query('SELECT DATABASE() AS databaseName');
    console.log(`Connected to MySQL database: ${databaseResult.databaseName}`);

    const [tables] = await pool.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    const tableNames = tables.map(row => row.TABLE_NAME);
    console.log(`Tables: ${tableNames.length ? tableNames.join(', ') : '(none)'}`);

    if (!tableNames.includes('tasks')) {
        console.log('The tasks table does not exist yet. Start the API to initialize it.');
    } else {
        const [rows] = await pool.query(`
          SELECT id, title, category, priority, due_at, is_done, is_alerted, created_at
          FROM tasks
          ORDER BY created_at DESC
          LIMIT 100
        `);
        console.log(`Tasks: ${rows.length} row(s) shown (maximum 100).`);
        console.table(rows);
    }
} catch (error) {
    console.error(`Unable to inspect MySQL database "${databaseName}": ${error.message}`);
    process.exitCode = 1;
} finally {
    await pool.end();
}