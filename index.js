const path=require('node:path');
const express=require('express');
const AppDAO=require('./DAO');
const Repository=require('./Repository');
const config=require('./config');
const {id,AppError}=require('./validation');
const timestampFields=new Set(['registered_at','joined_at','placed_at','cleared_at']);
function responseValues(value){
  if(Array.isArray(value))return value.map(responseValues);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[
    key,timestampFields.has(key)&&typeof item==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(item)
      ? item.replace(' ','T')+'Z' : responseValues(item)
  ]));
  return value;
}
function createApp(dao){
  const app=express(),repo=new Repository(dao);
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','same-origin');next();});
  app.use(express.json({limit:'32kb'}));
  const route=(method,url,fn,status=200)=>app[method](url,async(req,res,next)=>{try{const result=await fn(req);res.status(status).json(responseValues(result));}catch(error){next(error);}});
  route('get','/api/health',async()=>{await dao.run('SELECT 1');return{status:'ok',database:true};});
  route('get','/api/lookups',()=>repo.lookups());
  route('get','/api/dashboard',r=>repo.dashboard(r.query));
  route('get','/api/sections',r=>repo.sections(r.query));
  route('post','/api/sections',r=>repo.saveSection(r.body),201);
  route('put','/api/sections/:id',r=>repo.saveSection(r.body,id(r.params.id)));
  route('get','/api/sections/:id/roster',r=>repo.roster(id(r.params.id)));
  route('get','/api/students',r=>repo.students(r.query));
  route('post','/api/students',r=>repo.saveStudent(r.body),201);
  route('put','/api/students/:id',r=>repo.saveStudent(r.body,id(r.params.id)));
  route('get','/api/students/:id/schedule',r=>repo.schedule(id(r.params.id)));
  route('get','/api/courses',r=>repo.courses(r.query));
  route('post','/api/courses',r=>repo.saveCourse(r.body),201);
  route('put','/api/courses/:id',r=>repo.saveCourse(r.body,id(r.params.id)));
  route('get','/api/registrations',r=>repo.registrations(r.query));
  route('post','/api/registrations',r=>repo.enroll(r.body),201);
  route('put','/api/registrations/:id',r=>repo.updateRegistration(id(r.params.id),r.body));
  route('get','/api/holds',r=>repo.holds(r.query));
  route('post','/api/holds',r=>repo.addHold(r.body),201);
  route('put','/api/holds/:id',r=>repo.setHold(id(r.params.id),r.body));
  route('get','/api/waitlists',r=>repo.waitlists(r.query));
  route('post','/api/waitlists',r=>repo.joinWaitlist(r.body),201);
  route('post','/api/waitlists/promote',r=>repo.promote(r.body));
  route('delete','/api/waitlists/:studentId/:sectionId',r=>repo.removeWaitlist(r.params.studentId,r.params.sectionId));
  route('get','/api/prerequisites',r=>repo.prerequisites(r.query));
  route('post','/api/prerequisites',r=>repo.prerequisite(r.body),201);
  route('delete','/api/prerequisites',r=>repo.prerequisite(r.query,true));
  route('get','/api/reports/enrollment',r=>repo.enrollmentReport(r.query));
  app.use('/api',(req,res)=>res.status(404).json({error:'That API route was not found.',code:'NOT_FOUND'}));
  app.use(express.static(path.join(__dirname,'dist/frontend/browser')));
  app.get('/',(req,res)=>res.status(503).send('The Angular frontend is not built yet. Run npm run build, then reload this page.'));
  app.use((req,res)=>res.status(404).send('Page not found.'));
  app.use((error,req,res,next)=>{
    let status=error.status||500,message=error.message,code=error.code||'SERVER_ERROR';
    if(error instanceof SyntaxError && 'body' in error){status=400;message='The request must contain valid JSON.';code='INVALID_JSON';}
    else if(error.errno===1062){status=409;message='This record already exists. Emails, course codes, section numbers, registrations, and waitlist pairs must be unique.';code='DUPLICATE';}
    else if(error.errno===1452){status=400;message='The selected related record does not exist. Refresh the form and choose a valid record.';code='INVALID_REFERENCE';}
    else if(error.errno===1451){status=409;message='This record is used by another record and cannot be removed or changed.';code='RECORD_IN_USE';}
    else if([3819,4025,1265,1406,1048].includes(error.errno)){status=400;message='A value violates a database rule. Check required fields, dates, grades, and allowed ranges.';code='CONSTRAINT';}
    else if(status===500){message='The request could not be completed. Check that MySQL is running and try again.';console.error('Request failed:',error.code||error.name);}
    res.status(status).json({error:message,code});
  });
  return app;
}
async function start(){
 const dao=new AppDAO();
 try{await dao.run('SELECT 1 FROM students LIMIT 1');}
 catch(error){console.error(`Database is not ready (${error.code||error.message}). Check .env and run npm run db:setup, or npm run local:setup.`);await dao.close();process.exitCode=1;return;}
 const server=createApp(dao).listen(config.port,config.host,()=>console.log(`Academic Registration Portal: http://${config.host}:${config.port}`));
 server.on('error',async e=>{console.error(`Cannot start server: ${e.message}`);await dao.close();process.exitCode=1;});
 const close=()=>server.close(async()=>{await dao.close();process.exit(0);});
 process.once('SIGINT',close);process.once('SIGTERM',close);
}
if(require.main===module)start();
module.exports={createApp,start};
