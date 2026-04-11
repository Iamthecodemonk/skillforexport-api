// seeds/run_seed.js
// Simple runner for the Knex-format seed without requiring a knexfile.js
const knex = require('knex');
const seed = require('./01_initial.js').seed;

const cfg = {
  client: 'mysql2',
  connection: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 3306,
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'skillforexport'
  },
  pool: { min: 1, max: 5 }
};

const db = knex(cfg);

(async () => {
  try {
    await seed(db);
    console.log('Seed completed');
    await db.destroy();
  } catch (err) {
    console.error('Seed failed:', err);
    try { await db.destroy(); } catch(e){}
    process.exit(1);
  }
})();
