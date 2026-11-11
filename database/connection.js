import 'dotenv/config';

const usesWindowsDriver = process.platform === 'win32';
const server = process.env.DB_SERVER || (usesWindowsDriver ? 'localhost\\SQLEXPRESS' : 'localhost');
const database = process.env.DB_DATABASE || 'CLASS2';
const trustedConnection = process.env.DB_TRUSTED_CONNECTION
    ? process.env.DB_TRUSTED_CONNECTION === 'true'
    : usesWindowsDriver;
const trustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false';
const odbcValue = value => `{${String(value).replaceAll('}', '}}')}}`;
const authentication = trustedConnection
    ? 'Trusted_Connection=Yes'
    : `UID=${odbcValue(process.env.DB_USER || '')};PWD=${odbcValue(process.env.DB_PASSWORD || '')}`;

export const databaseName = database;
export const databaseConfig = {
    server,
    database,
    ...(usesWindowsDriver
        ? {
            connectionString: [
                'Driver={ODBC Driver 17 for SQL Server}',
                `Server=${odbcValue(server)}`,
                `Database=${odbcValue(database)}`,
                authentication,
                'Encrypt=No',
                `TrustServerCertificate=${trustServerCertificate ? 'Yes' : 'No'}`
            ].join(';'),
            options: { trustedConnection, trustServerCertificate }
        }
        : {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            options: { encrypt: true, trustServerCertificate }
        }),
    connectionTimeout: 15000,
    requestTimeout: 15000
};