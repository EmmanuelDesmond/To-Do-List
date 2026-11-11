import sql from 'mssql/msnodesqlv8.js';
import { databaseConfig, databaseName } from '../database/connection.js';

let pool;

try {
    pool = await new sql.ConnectionPool(databaseConfig).connect();
    const databaseResult = await pool.request().query('SELECT DB_NAME() AS databaseName');
    console.log(`Connected to SQL Server database: ${databaseResult.recordset[0].databaseName}`);

    const tableResult = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
    const tableNames = tableResult.recordset.map(row => `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`);
    console.log(`Tables: ${tableNames.length ? tableNames.join(', ') : '(none)'}`);

    if (!tableNames.includes('dbo.tasks')) {
        console.log('The tasks table does not exist yet. Start the API to initialize it.');
    } else {
        const result = await pool.request().query(`
      SELECT id, title, category, priority, due_at, is_done, is_alerted, created_at
      FROM dbo.tasks
      ORDER BY created_at DESC
      OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY
    `);
        console.log(`Tasks: ${result.recordset.length} row(s) shown (maximum 100).`);
        console.table(result.recordset);
    }
} catch (error) {
    console.error(`Unable to inspect SQL Server database "${databaseName}": ${error.message}`);
    process.exitCode = 1;
} finally {
    await pool?.close();
}