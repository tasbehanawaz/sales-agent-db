const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

// Initialize SQLite connection to Apex Group database
function initApexDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Apex SQLite connection failed:', err.message);
        reject(err);
      } else {
        console.log('✓ Apex Group SQLite database connected');
        resolve(db);
      }
    });
  });
}

// Get the database instance
function getApexDb() {
  if (!db) {
    throw new Error('Apex database not initialized. Call initApexDatabase() first.');
  }
  return db;
}

// Query helper for Apex database
function queryApex(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Apex database not initialized'));
      return;
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Apex query error:', err.message);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

// Get single row from Apex database
function getApex(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Apex database not initialized'));
      return;
    }

    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Apex get error:', err.message);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

// Close the connection
function closeApexDb() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing Apex database:', err.message);
          reject(err);
        } else {
          console.log('✓ Apex database closed');
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initApexDatabase,
  getApexDb,
  queryApex,
  getApex,
  closeApexDb
};
