const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  options: {
    trustServerCertificate: true,
    encrypt: true,
    connectionTimeout: 30000,
    requestTimeout: 60000
  }
};

let pool;

async function getPool() {
  if (!pool) {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✓ Database connected');
  }
  return pool;
}

async function query(sqlQuery, params = {}) {
  const p = await getPool();
  const request = p.request();

  Object.keys(params).forEach(key => {
    request.input(key, params[key]);
  });

  const result = await request.query(sqlQuery);
  return result.recordset;
}

module.exports = { getPool, query, sql };
