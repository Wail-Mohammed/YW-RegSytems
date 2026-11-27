'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const mysql=require('mysql2/promise');
const Chrome=require('./chrome');
const config=require('../config');
const AppDAO=require('../DAO');
const {createApp}=require('../index');
const {setupDatabase}=require('./setup-db');
const root=path.resolve(__dirname,'..');
async function main(){
  const database=`college_registration_browser_${process.pid}_${Date.now()}`;
  let dao,server,browser;const results=[];
  const capture=path.join(root,'docs/screenshots');fs.mkdirSync(capture,{recursive:true});
  const record=name=>{results.push(name);console.log('PASS '+name);};
  try{
    await setupDatabase({...config.database,database},()=>{});dao=new AppDAO({...config.database,database});
    server=createApp(dao).listen(0,'127.0.0.1');await once(server,'listening');
    browser=await new Chrome().start();
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await browser.navigate(`http://127.0.0.1:${server.address().port}/`);
    await browser.wait('state.rows.length === 26 && document.querySelector("#connection-state").classList.contains("connected")');
    assert.ok(await browser.evaluate('!!document.querySelector("#filter-instructor_id")'));
    await browser.screenshot(path.join(capture,'sections-desktop.png'));record('Desktop Chrome loads MySQL-backed offerings and instructor filter');
    const click=async selector=>browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const fill=async values=>browser.evaluate(`(()=>{const values=${JSON.stringify(values)};for(const [key,value]of Object.entries(values))document.querySelector('#field-'+key).value=String(value);})()`);
    const view=async name=>{await browser.evaluate(`location.hash=${JSON.stringify(name)}`);await browser.wait(`state.view===${JSON.stringify(name)} && !document.querySelector('.loading-state') && !!document.querySelector('#filters')`);};
    const submit=async()=>{await click('#dialog-submit');await browser.wait('!document.querySelector("#app-dialog").open && !state.busy');};
    await browser.evaluate('document.querySelector("#filter-q").value="Database";document.querySelector("#filters").requestSubmit()');
    await browser.wait('state.rows.length>0 && state.rows.every(row=>row.course_code==="CS 301")');
    await click('[data-action="roster"]');await browser.wait('document.querySelector("#app-dialog").open');
    assert.ok(await browser.evaluate('document.querySelector("#dialog-body").innerText.includes("Maya Chen")'));
    await click('#dialog-cancel');record('Form search and JOIN-backed section roster work');
    await view('students');await click('[data-action="new-student"]');
    await fill({first_name:'Browser',last_name:'Persistence',email:'browser.persistence@example.edu',major:'Computer Science'});await submit();
    let rows=await dao.run('SELECT * FROM students WHERE email=?',['browser.persistence@example.edu']);assert.equal(rows.length,1);
    const studentId=rows[0].student_id;
    await browser.wait(`state.rows.some(row=>row.student_id===${studentId})`);await click(`[data-action="edit-student"][data-id="${studentId}"]`);
    await fill({major:'Mathematics'});await submit();
    await browser.send('Page.reload');await browser.wait(`state.view==='students' && state.rows.some(row=>row.student_id===${studentId} && row.major==='Mathematics')`);
    assert.equal((await dao.run('SELECT major FROM students WHERE student_id=?',[studentId]))[0].major,'Mathematics');
    record('Student INSERT and UPDATE including major persist through page reload and SQL SELECT');
    const before=(await dao.run('SELECT COUNT(*) AS n FROM students'))[0].n;
    await click('[data-action="new-student"]');assert.equal(await browser.evaluate('document.querySelector("#dialog-form").checkValidity()'),false);
    await fill({first_name:'Cancel',last_name:'Example',email:'cancel@example.edu'});await click('#dialog-cancel');
    assert.equal((await dao.run('SELECT COUNT(*) AS n FROM students'))[0].n,before);record('Required browser validation and Cancel prevent unintended INSERT');
    await view('courses');await click('[data-action="new-course"]');
    await fill({department_id:1,course_code:'BROWSER 900',title:'Browser Verification',credits:3});await submit();
    const course=(await dao.run("SELECT * FROM courses WHERE course_code='BROWSER 900'"))[0];assert.ok(course);
    await browser.wait(`state.rows.some(row=>row.course_id===${course.course_id})`);await click(`[data-action="edit-course"][data-id="${course.course_id}"]`);
    await fill({title:'Browser Verified Update',credits:4});await submit();
    assert.equal((await dao.run('SELECT title FROM courses WHERE course_id=?',[course.course_id]))[0].title,'Browser Verified Update');record('A second table supports persisted browser INSERT and targeted UPDATE');
    await click('[data-action="new-course"]');await fill({department_id:1,course_code:'CS 101',title:'Duplicate',credits:3});await click('#dialog-submit');
    await browser.wait('!state.busy && !document.querySelector("#form-error").hidden');
    assert.ok(await browser.evaluate('document.querySelector("#form-error").innerText.includes("already exists")'));await click('#dialog-cancel');record('A duplicate-key violation produces visible form feedback');
    for(const name of ['registrations','holds','waitlists','reports']){await view(name);assert.ok(await browser.evaluate('!document.querySelector(".error-state")'));}
    await browser.screenshot(path.join(capture,'enrollment-report.png'));record('Registrations, holds, waitlists, and GROUP BY report render without errors');
    await browser.evaluate('refreshLookups=async()=>{throw new Error("Simulated refresh failure")};afterSave("Saved verification")');
    await browser.wait('document.querySelector("#toasts").innerText.includes("Your change was saved, but")');record('A refresh failure after saving produces a visible and truthful warning');
    await browser.send('Page.reload');await browser.wait('state.rows.length>0 && !document.querySelector(".loading-state")');
    await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await browser.screenshot(path.join(capture,'narrow-viewport.png'));
    assert.ok(await browser.evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
    record('390px viewport remains usable; this is emulation, not a physical phone test');
    const exceptions=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0,JSON.stringify(exceptions));
    const summary={date:new Date().toISOString(),browser:browser.version.product,userAgent:browser.version.userAgent,passed:results.length,results,physicalPhoneTested:false};
    fs.writeFileSync(path.join(root,'docs/browser-results.json'),JSON.stringify(summary,null,2));
    console.log(`Completed ${results.length} browser checks.`);
  }finally{
    if(browser)await browser.close();
    if(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
    if(dao)await dao.close();
    if(/^college_registration_browser_\d+_\d+$/.test(database)){
      const connection=await mysql.createConnection({host:config.database.host,port:config.database.port,user:config.database.user,password:config.database.password});
      try{await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);}finally{await connection.end();}
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
