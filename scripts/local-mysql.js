'use strict';
// A separate local instance: never uses the system MySQL data directory.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const mysql = require('mysql2/promise');
const root = path.resolve(__dirname,'..');
const work = path.join(root,'.local-mysql');
const runtimePath = path.join(work,'runtime.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
function runtime() {
  if (!fs.existsSync(runtimePath)) throw new Error('Run npm run local:setup first.');
  return JSON.parse(fs.readFileSync(runtimePath,'utf8'));
}
function findServer() {
  const candidates = [process.env.MYSQLD, '/usr/local/mysql/bin/mysqld','/opt/homebrew/opt/mysql/bin/mysqld','/usr/local/opt/mysql/bin/mysqld'].filter(Boolean);
  const located = spawnSync('which',['mysqld'],{encoding:'utf8'});
  if (located.status === 0) candidates.push(located.stdout.trim());
  const executable = candidates.find(file => fs.existsSync(file));
  if (!executable) throw new Error('MySQL server was not found. Install MySQL, or set MYSQLD to the mysqld executable.');
  return fs.realpathSync(executable);
}
async function connect(info, password = info.password) {
  return mysql.createConnection({host:'127.0.0.1',port:info.port,user:'root',password,connectTimeout:1000});
}
async function startDatabase(info) {
  try { const c=await connect(info); await c.end(); return; }
  catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') throw new Error(`Port ${info.port} belongs to a different MySQL instance or has different credentials. Choose another LOCAL_DB_PORT.`);
  }
  const portAvailable = await new Promise(resolve => {
    const probe=net.createServer();probe.once('error',()=>resolve(false));
    probe.listen(info.port,'127.0.0.1',()=>probe.close(()=>resolve(true)));
  });
  if (!portAvailable) throw new Error(`Port ${info.port} is already in use. Choose another LOCAL_DB_PORT; no existing process was stopped.`);
  const log=fs.openSync(path.join(work,'mysql.log'),'a',0o600);
  const child=spawn(info.executable,['--no-defaults',`--basedir=${info.basedir}`,`--datadir=${path.join(work,'data')}`,
    '--bind-address=127.0.0.1',`--port=${info.port}`,`--socket=${path.join(work,'mysql.sock')}`,
    `--pid-file=${path.join(work,'mysql.pid')}`,'--mysqlx=OFF'],{detached:true,stdio:['ignore',log,log]});
  fs.closeSync(log);child.unref();
  child.once('error',error=>console.error(`MySQL could not start: ${error.message}`));
  for (let attempt=0;attempt<100;attempt++) {
    try {const c=await connect(info,info.password);await c.end();return;}
    catch(error){if(error.code==='ER_ACCESS_DENIED_ERROR')return;await sleep(150);}
  }
  throw new Error('MySQL did not become ready. Read .local-mysql/mysql.log.');
}
async function setup() {
  fs.mkdirSync(work,{recursive:true,mode:0o700});
  let info;
  if (fs.existsSync(runtimePath)) info=runtime();
  else {
    const executable=findServer(),port=Number(process.env.LOCAL_DB_PORT || 3307);
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('LOCAL_DB_PORT must be between 1024 and 65535.');
    info={executable,basedir:path.dirname(path.dirname(executable)),port,password:crypto.randomBytes(24).toString('hex')};
    const initialized=spawnSync(executable,['--no-defaults','--initialize-insecure',`--basedir=${info.basedir}`,`--datadir=${path.join(work,'data')}`],{encoding:'utf8'});
    if(initialized.status!==0)throw new Error(`Could not initialize the separate MySQL data directory: ${initialized.stderr || initialized.error?.message}`);
    fs.writeFileSync(runtimePath,JSON.stringify(info,null,2),{mode:0o600});
  }
  await startDatabase(info);
  let connection;
  try {connection=await connect(info);}
  catch(error){if(error.code!=='ER_ACCESS_DENIED_ERROR')throw error;connection=await connect(info,'');
    await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[info.password]);}
  await connection.end();
  const env=path.join(root,'.env');
  if (!fs.existsSync(env)) fs.writeFileSync(env,`# Generated for the separate local demonstration instance.\nDB_HOST=127.0.0.1\nDB_PORT=${info.port}\nDB_USER=root\nDB_PASSWORD=${info.password}\nDB_NAME=college_registration\nPORT=8002\nHOST=127.0.0.1\n`,{mode:0o600});
  else {
    const configured=require('../config').database;
    if(configured.port!==info.port || configured.password!==info.password)throw new Error('Existing .env was preserved. Configure it for this local instance or use npm run db:setup with your existing server.');
  }
  await require('./setup-db').setupDatabase(require('../config').database);
  console.log(`Separate local MySQL ready on 127.0.0.1:${info.port}. Start the app with npm run local:start.`);
}
async function main() {
  const action=process.argv[2]||'start';
  if(action==='setup')return setup();
  const info=runtime();
  if(action==='stop'){
    const c=await connect(info);try{await c.query('SHUTDOWN');}finally{await c.end().catch(()=>{});}
    console.log('Stopped the separate local MySQL instance.');return;
  }
  if(action!=='start')throw new Error('Use setup, start, or stop.');
  await startDatabase(info);await require('../index').start();
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
