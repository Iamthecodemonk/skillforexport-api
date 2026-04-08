import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_RETRIES = 30;
const RETRY_DELAY = 1000; // 1 second

async function waitForDatabase() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      logger.info(`Attempting database connection (${i + 1}/${MAX_RETRIES})...`);
      const connection = await mysql.createConnection({
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT, 10),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      });
      
      // Check if tables exist
      const [tables] = await connection.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('users', 'user_otps')",
        [process.env.DATABASE_NAME || 'skillforexport']
      );

      // If tables don't exist (count < 2), initialize schema
      if (tables[0].count < 2) {
        logger.info('Initializing database schema...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        // Split and execute each statement
        const statements = schemaSql.split(';').filter(stmt => stmt.trim());
        let executed = 0;
        for (const stmt of statements) {
          if (stmt.trim()) {
            try {
              await connection.execute(stmt);
              executed++;
            } catch (sqlErr) {
              logger.error('SQL Error executing statement', { index: executed + 1, statementPreview: stmt.substring(0, 100) + '...', message: sqlErr.message });
              throw sqlErr; // Rethrow to exit the loop
            }
          }
        }
        logger.info(`Database schema initialized! (${executed} statements executed)`);
      } else {
        logger.info('Tables already exist, skipping schema initialization');
      }
      
      await connection.end();
      logger.info('Database is ready!');
      return true;
    } catch (err) {
      if (i === MAX_RETRIES - 1) {
        logger.error('Database failed to become ready after ' + MAX_RETRIES + ' attempts', { message: err.message });
        logger.error('Stack', { stack: err.stack });
        process.exit(1);
      }
      if (i < 5) {
        logger.warn(`Attempt ${i + 1} failed: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

await waitForDatabase();
