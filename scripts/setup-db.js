'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const root = path.resolve(__dirname, '..');
const tables = ['departments','students','instructors','terms','courses','sections','registrations','course_prerequisites','waitlist_entries','student_holds'];

async function setupDatabase(options, log = console.log) {
  const database = options.database;
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database)) throw new Error('Invalid database name.');
  const connection = await mysql.createConnection({...options, database:undefined, connectionLimit:undefined,
    waitForConnections:undefined, enableKeepAlive:undefined, multipleStatements:true});
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await connection.changeUser({database});
    const [existing] = await connection.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [database]);
    if (existing.length) {
      const names = new Set(existing.map(row => row.TABLE_NAME || row.table_name));
      if (tables.some(name => !names.has(name))) throw new Error('The database is not an empty or complete project schema. Choose a new DB_NAME; no existing tables were changed.');
      const [columns] = await connection.query("SHOW COLUMNS FROM students LIKE 'major'");
      if (!columns.length) throw new Error('This database predates the major field. Use a new DB_NAME or apply sql/migrations/001_student_major.sql after backing up your database.');
      log('Existing project tables retained; sample data was not inserted again.');
      return;
    }
    await connection.query(await fs.readFile(path.join(root,'sql/schema.sql'),'utf8'));
    await connection.query(await fs.readFile(path.join(root,'sql/seed.sql'),'utf8'));
    log('Created all ten tables and loaded the sample data.');
  } finally { await connection.end(); }
}
if (require.main === module) {
  setupDatabase(require('../config').database).catch(error => {
    console.error(`Database setup failed (${error.code || error.message}). Check your MySQL configuration and permissions.`);
    process.exitCode = 1;
  });
}
module.exports = {setupDatabase, tables};
