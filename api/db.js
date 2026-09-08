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
  connectionTimeout: 30000,
  requestTimeout: 60000,
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 300000
  },
  options: {
    trustServerCertificate: true,
    encrypt: true
  }
};

let pool;

async function getPool() {
  if (pool && pool.connected) {
    return pool;
  }

  if (pool) {
    try { await pool.close(); } catch (_) {}
    pool = null;
  }

  const newPool = new sql.ConnectionPool(config);
  newPool.on('error', err => {
    console.error('Database pool error:', err.message);
    pool = null;
  });
  await newPool.connect();
  pool = newPool;
  console.log('✓ Database connected');
  return pool;
}

async function query(sqlQuery, params = {}) {
  const p = await getPool();
  const request = p.request();

  Object.keys(params).forEach(key => {
    request.input(key, params[key]);
  });

  try {
    const result = await request.query(sqlQuery);
    return result.recordset;
  } catch (err) {
    if (err.code === 'ETIMEOUT' || err.code === 'ECONNCLOSED' || err.code === 'ESOCKET') {
      try { await p.close(); } catch (_) {}
      pool = null;
    }
    throw err;
  }
}

module.exports = { getPool, query, sql };
