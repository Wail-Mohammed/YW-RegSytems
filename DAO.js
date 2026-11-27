const mysql = require('mysql2/promise');
const config = require('./config');
class AppDAO {
  constructor(options = config.database) { this.pool = mysql.createPool(options); }
  async connection() {
    const connection = await this.pool.getConnection();
    try {
      // The driver's timezone controls conversion; MySQL's session timezone also
      // controls CURRENT_TIMESTAMP defaults on every acquired connection.
      await connection.query("SET time_zone = '+00:00'");
      return connection;
    } catch (error) { connection.release(); throw error; }
  }
  async run(sql, params = []) {
    const connection = await this.connection();
    try { return (await connection.execute(sql, params))[0]; }
    finally { connection.release(); }
  }
  async transaction(work) {
    const connection = await this.connection();
    try {
      await connection.beginTransaction();
      const run = async (sql, params = []) => (await connection.execute(sql, params))[0];
      const result = await work(run);
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async close() { await this.pool.end(); }
}
module.exports = AppDAO;
