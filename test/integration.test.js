'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
const {once}=require('node:events');
const config=require('../config');
const AppDAO=require('../DAO');
const {createApp}=require('../index');
const {setupDatabase,tables}=require('../scripts/setup-db');

test('real MySQL schema, persisted browser API operations, and registration transactions', {timeout:90000}, async t=>{
  const database=`college_registration_test_${process.pid}_${Date.now()}`;
  let dao,server,admin;
  const connection={...config.database,database};
  try {
    await setupDatabase(connection,()=>{});
    dao=new AppDAO(connection);
    server=createApp(dao).listen(0,'127.0.0.1');await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}/api`;
    async function request(method,url,body,status=200){
      const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
    }
    let person,course,section,blocked;
    const student=(suffix)=>({first_name:'Test',last_name:suffix,email:`test.${suffix.toLowerCase()}@example.edu`,major:'Computer Science'});
    await t.test('all ten tables, required major, sample counts and UTC session exist',async()=>{
      for(const name of tables)assert.ok((await dao.run(`SELECT COUNT(*) AS n FROM ${name}`))[0].n>0,name);
      assert.equal((await dao.run('SELECT COUNT(*) AS n FROM registrations'))[0].n,118);
      assert.equal((await dao.run('SELECT major FROM students WHERE student_id=1'))[0].major,'Computer Science');
      assert.equal((await dao.run('SELECT @@session.time_zone AS tz'))[0].tz,'+00:00');
    });
    await t.test('SQL filters and joined section/roster/schedule results are meaningful',async()=>{
      const rows=await request('GET','/sections?term_id=3&department_id=1&q=Database');
      assert.ok(rows.length>0);assert.equal(rows[0].course_code,'CS 301');assert.ok(rows[0].instructor_name);
      const instructor=rows[0].instructor_id;
      assert.ok((await request('GET',`/sections?instructor_id=${instructor}`)).every(row=>row.instructor_id===instructor));
      assert.ok((await request('GET','/sections/103/roster')).length>=3);
      assert.ok((await request('GET','/students/1/schedule')).length>0);
      assert.match((await request('GET','/holds'))[0].placed_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      assert.deepEqual(await request('GET',`/sections?q=${encodeURIComponent("' OR 1=1 --")}`),[]);
    });
    await t.test('INSERT and targeted UPDATE persist students and courses in MySQL',async()=>{
      person=await request('POST','/students',student('Persistence'),201);
      await request('PUT',`/students/${person.student_id}`,{...student('Persistence'),major:'Mathematics'});
      course=await request('POST','/courses',{department_id:1,course_code:'TEST 999',title:'Database Verification',credits:3},201);
      await request('PUT',`/courses/${course.course_id}`,{...course,title:'Persisted Course Update',credits:4});
      const fresh=new AppDAO(connection);
      try {
        assert.equal((await fresh.run('SELECT major FROM students WHERE student_id=?',[person.student_id]))[0].major,'Mathematics');
        assert.equal((await fresh.run('SELECT title FROM courses WHERE course_id=?',[course.course_id]))[0].title,'Persisted Course Update');
        assert.equal((await fresh.run('SELECT title FROM courses WHERE course_id=1'))[0].title,'Introduction to Programming');
      }finally{await fresh.close();}
      assert.equal((await request('GET','/students?q=Persistence'))[0].major,'Mathematics');
    });
    await t.test('missing input, invalid ranges, duplicate keys, and invalid foreign keys return clear errors',async()=>{
      await request('POST','/students',{...student('Missing'),first_name:' '},400);
      await request('POST','/students',student('Persistence'),409);
      await request('POST','/courses',{department_id:1,course_code:'BAD 001',title:'Invalid',credits:7},400);
      await request('POST','/courses',{department_id:4294967295,course_code:'BAD 002',title:'Invalid reference',credits:3},400);
      await request('PUT','/students/not-an-id',student('BadID'),400);
      await request('GET','/api-does-not-exist',undefined,404);
    });
    await t.test('MySQL enforces duplicate pairs, grade/status checks, and foreign-key restrictions',async()=>{
      await assert.rejects(dao.run('INSERT INTO course_prerequisites(course_id,prerequisite_id) VALUES (2,1)'),e=>e.errno===1062);
      await assert.rejects(dao.run("INSERT INTO registrations(student_id,section_id,status,final_grade) VALUES (?,101,'ENROLLED','A')",[person.student_id]),e=>[3819,4025].includes(e.errno));
      await assert.rejects(dao.run('DELETE FROM courses WHERE course_id=1'),e=>e.errno===1451);
    });
    await t.test('active holds and failing prerequisites reject enrollment without writes',async()=>{
      blocked=await request('POST','/students',student('Blocked'),201);
      const hold=await request('POST','/holds',{student_id:blocked.student_id,reason:'Verification hold'},201);
      const error=await request('POST','/registrations',{student_id:blocked.student_id,section_id:101},409);assert.equal(error.code,'ACTIVE_HOLD');
      assert.equal((await dao.run('SELECT COUNT(*) AS n FROM registrations WHERE student_id=?',[blocked.student_id]))[0].n,0);
      await request('PUT',`/holds/${hold.hold_id}`,{cleared:true});
      const missing=await request('POST','/registrations',{student_id:3,section_id:102},409);assert.equal(missing.code,'PREREQUISITE');
    });
    await t.test('two simultaneous attempts for the last seat cannot exceed capacity',async()=>{
      section=await request('POST','/sections',{course_id:course.course_id,instructor_id:1,term_id:3,section_number:'TEST-01',meeting_time:'Mon 10:00',location:'Test Room',capacity:1},201);
      const responses=await Promise.all([person,blocked].map(st=>fetch(base+'/registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({student_id:st.student_id,section_id:section.section_id})})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);await Promise.all(responses.map(r=>r.json()));
      assert.equal((await dao.run("SELECT COUNT(*) AS n FROM registrations WHERE section_id=? AND status IN ('ENROLLED','COMPLETED')",[section.section_id]))[0].n,1);
      await request('PUT',`/sections/${section.section_id}`,{...section,capacity:0},400);
    });
    await t.test('self prerequisites and cycles are rejected',async()=>{
      await request('POST','/prerequisites',{course_id:1,prerequisite_id:1},400);
      const error=await request('POST','/prerequisites',{course_id:1,prerequisite_id:2},409);assert.equal(error.code,'PREREQUISITE_CYCLE');
    });
    await t.test('waitlist promotion is FIFO and atomic, with failed promotion retained',async()=>{
      await request('PUT','/registrations/68',{status:'DROPPED',final_grade:null});
      const wrong=await request('POST','/waitlists/promote',{student_id:6,section_id:103},409);assert.equal(wrong.code,'WAITLIST_ORDER');
      await request('POST','/waitlists/promote',{student_id:5,section_id:103});
      assert.equal((await dao.run('SELECT COUNT(*) AS n FROM waitlist_entries WHERE student_id=5 AND section_id=103'))[0].n,0);
      assert.equal((await dao.run("SELECT COUNT(*) AS n FROM registrations WHERE student_id=5 AND section_id=103 AND status='ENROLLED'"))[0].n,1);
      await request('PUT','/registrations/69',{status:'DROPPED',final_grade:null});
      await request('POST','/holds',{student_id:6,reason:'Promotion verification'},201);
      const held=await request('POST','/waitlists/promote',{student_id:6,section_id:103},409);assert.equal(held.code,'ACTIVE_HOLD');
      assert.equal((await dao.run('SELECT COUNT(*) AS n FROM waitlist_entries WHERE student_id=6 AND section_id=103'))[0].n,1);
      await request('DELETE','/waitlists/6/103');
      assert.equal((await dao.run('SELECT COUNT(*) AS n FROM waitlist_entries WHERE section_id=103'))[0].n,0);
    });
    await t.test('capacity cannot be reduced below occupied seats and reactivation is supported',async()=>{
      const old=(await dao.run('SELECT * FROM sections WHERE section_id=103'))[0];
      const error=await request('PUT','/sections/103',{...old,capacity:1},409);assert.equal(error.code,'CAPACITY');
      await request('PUT','/registrations/117',{status:'ENROLLED',final_grade:null});
      assert.equal((await dao.run('SELECT status FROM registrations WHERE registration_id=117'))[0].status,'ENROLLED');
    });
    await t.test('GROUP BY report and dashboard use the same seat-occupancy rule',async()=>{
      const report=await request('GET','/reports/enrollment');
      const total=report.reduce((sum,row)=>sum+Number(row.occupied_seats),0);
      const dashboard=await request('GET','/dashboard');assert.equal(Number(dashboard.stats.occupied_seats),total);
      for(const row of report)assert.equal(row.available_seats,row.capacity-row.occupied_seats);
    });
    await t.test('re-running setup preserves existing records instead of reseeding',async()=>{
      await setupDatabase(connection,()=>{});
      assert.equal((await dao.run('SELECT major FROM students WHERE student_id=?',[person.student_id]))[0].major,'Mathematics');
    });
  } finally {
    if(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
    if(dao)await dao.close();
    // Only the unique database created above is removed; never the user's DB_NAME.
    if(/^college_registration_test_\d+_\d+$/.test(database)){
      admin=await mysql.createConnection({host:config.database.host,port:config.database.port,user:config.database.user,password:config.database.password});
      try{await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);}finally{await admin.end();}
    }
  }
});
