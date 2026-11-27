const fs = require('node:fs');
const path = require('node:path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}
function port(value, fallback) {
  const n = Number(value || fallback);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('Ports must be integers from 1 to 65535.');
  return n;
}
const config = {
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: port(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'college_registration',
    timezone: 'Z', dateStrings: true, decimalNumbers: true,
    connectionLimit: 6, waitForConnections: true, enableKeepAlive: true
  },
  host: process.env.HOST || '127.0.0.1', port: port(process.env.PORT, 3000)
};
if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(config.database.database)) throw new Error('DB_NAME must start with a letter and contain only letters, numbers, and underscores.');
module.exports = config;
