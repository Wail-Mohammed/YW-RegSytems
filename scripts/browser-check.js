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
  if(!fs.existsSync(path.join(root,'dist/frontend/browser/index.html')))throw new Error('Run npm run build before the browser checks.');
  const database=`college_registration_browser_${process.pid}_${Date.now()}`;
  let dao,server,browser;const results=[];
  const capture=path.join(root,'docs/screenshots');fs.mkdirSync(capture,{recursive:true});
  const record=name=>{results.push(name);console.log('PASS '+name);};
  try{
    await setupDatabase({...config.database,database},()=>{});dao=new AppDAO({...config.database,database});
    let failNextLookups=false;
    const normalRun=dao.run.bind(dao);
    dao.run=async(sql,parameters=[])=>{
      if(failNextLookups && sql==='SELECT * FROM departments ORDER BY name'){
        failNextLookups=false;const error=new Error('Simulated refresh failure');error.status=503;throw error;
      }
      return normalRun(sql,parameters);
    };
    server=createApp(dao).listen(0,'127.0.0.1');await once(server,'listening');
    browser=await new Chrome().start();
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await browser.navigate(`http://127.0.0.1:${server.address().port}/`);
    const loaded=view=>`document.querySelector('#workspace')?.getAttribute('data-view')===${JSON.stringify(view)} && document.querySelector('#workspace')?.getAttribute('aria-busy')==='false' && !!document.querySelector('#filters') && !document.querySelector('.loading-state')`;
    const click=async selector=>browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const fill=async values=>browser.evaluate(`(()=>{const values=${JSON.stringify(values)};for(const [key,value]of Object.entries(values)){const input=document.querySelector('#field-'+key);input.value=String(value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`);
    const view=async name=>{await browser.evaluate(`location.hash=${JSON.stringify(name)}`);await browser.wait(loaded(name));};
    const open=async selector=>{await click(selector);await browser.wait('!!document.querySelector("#app-dialog")?.open');};
    const submit=async()=>{await click('#dialog-submit');await browser.wait('!document.querySelector("#app-dialog")');};
    await browser.wait(loaded('sections'));
    const angularVersion=await browser.evaluate('document.querySelector("app-root").getAttribute("ng-version")');
    assert.ok(angularVersion?.startsWith('22.'),'The served frontend must actually bootstrap Angular 22.');
    assert.equal(await browser.evaluate('document.querySelectorAll("#page-content tbody tr").length'),26);
    assert.ok(await browser.evaluate('!!document.querySelector("#filter-instructor_id")'));
    await browser.screenshot(path.join(capture,'sections-desktop.png'));record('Angular 22 boots the desktop workspace with typed API data and instructor filtering');
    await browser.evaluate('const q=document.querySelector("#filter-q");q.value="Database";q.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#filters").requestSubmit()');
    await browser.wait('document.querySelectorAll("#page-content tbody tr").length===1 && document.querySelector("#page-content tbody").innerText.includes("CS 301")');
    await open('[data-action="roster"]');
    assert.ok(await browser.evaluate('document.querySelector("#dialog-body").innerText.includes("Maya Chen")'));
    await click('#dialog-cancel');record('Angular search form and JOIN-backed section roster work');
    await view('students');await click('.skip-link');
    await browser.wait("document.activeElement?.id==='main' && document.querySelector('#workspace')?.getAttribute('data-view')==='students'");
    assert.equal(await browser.evaluate('location.hash'),'#students');
    record('Skip-to-content preserves the active Angular view and moves keyboard focus');
    await open('[data-action="new-student"]');
    await fill({first_name:'Browser',last_name:'Persistence',email:'browser.persistence@example.edu',major:'Computer Science'});await submit();
    const student=(await dao.run('SELECT * FROM students WHERE email=?',['browser.persistence@example.edu']))[0];assert.ok(student);
    const editStudent=`[data-action="edit-student"][data-id="${student.student_id}"]`;
    await browser.wait(`!!document.querySelector(${JSON.stringify(editStudent)})`);await open(editStudent);
    await fill({major:'Mathematics'});await submit();
    await browser.wait('document.querySelector("#page-content tbody").innerText.includes("Mathematics")');
    await browser.send('Page.reload');await browser.wait(loaded('students'));
    await browser.wait(`document.querySelector(${JSON.stringify(editStudent)})?.closest('tr').innerText.includes('Mathematics')`);
    assert.equal((await dao.run('SELECT major FROM students WHERE student_id=?',[student.student_id]))[0].major,'Mathematics');
    record('Reactive student INSERT/UPDATE, including major, persists through reload and SQL SELECT');
    const before=(await dao.run('SELECT COUNT(*) AS n FROM students'))[0].n;
    await open('[data-action="new-student"]');assert.equal(await browser.evaluate('document.querySelector("#dialog-form").checkValidity()'),false);
    await click('#dialog-submit');await browser.wait('document.querySelector("#dialog-body").innerText.includes("Enter a valid")');
    await fill({first_name:'Cancel',last_name:'Example',email:'cancel@example.edu'});await click('#dialog-cancel');
    assert.equal((await dao.run('SELECT COUNT(*) AS n FROM students'))[0].n,before);record('Angular reactive validation and Cancel prevent unintended INSERT');
    await view('courses');await open('[data-action="new-course"]');
    await fill({department_id:1,course_code:'BROWSER 900',title:'Browser Verification',credits:3});await submit();
    const course=(await dao.run("SELECT * FROM courses WHERE course_code='BROWSER 900'"))[0];assert.ok(course);
    const editCourse=`[data-action="edit-course"][data-id="${course.course_id}"]`;
    await browser.wait(`!!document.querySelector(${JSON.stringify(editCourse)})`);await open(editCourse);
    await fill({title:'Browser Verified Update',credits:4});await submit();
    await browser.wait('document.querySelector("#page-content").innerText.includes("Browser Verified Update")');
    assert.equal((await dao.run('SELECT title FROM courses WHERE course_id=?',[course.course_id]))[0].title,'Browser Verified Update');record('A second table supports persisted Angular INSERT and targeted UPDATE');
    await open('[data-action="new-course"]');await fill({department_id:1,course_code:'CS 101',title:'Duplicate',credits:3});await click('#dialog-submit');
    await browser.wait('!!document.querySelector("#form-error") && !document.querySelector("#form-error").hidden');
    assert.ok(await browser.evaluate('document.querySelector("#form-error").innerText.includes("already exists")'));
    assert.equal(await browser.evaluate('document.querySelector("#field-course_code").value'),'CS 101');await click('#dialog-cancel');record('Duplicate-key feedback is visible and preserves entered reactive-form values');
    await open('[data-action="prerequisites"][data-id="1"]');await fill({prerequisite_id:2});await click('#dialog-submit');
    await browser.wait('document.querySelector("#form-error")?.innerText.includes("cycle")');await click('#dialog-cancel');record('Prerequisite form displays the backend cycle rejection');
    await view('sections');await open('[data-action="new-section"]');
    await fill({course_id:course.course_id,instructor_id:1,term_id:3,section_number:'ANG-01',capacity:2,meeting_time:'Mon 10:00',location:'Angular Test Room'});await submit();
    const section=(await dao.run("SELECT * FROM sections WHERE section_number='ANG-01'"))[0];assert.ok(section);
    const editSection=`[data-action="edit-section"][data-id="${section.section_id}"]`;
    await browser.wait(`!!document.querySelector(${JSON.stringify(editSection)})`);await open(editSection);await fill({capacity:3});await submit();
    assert.equal((await dao.run('SELECT capacity FROM sections WHERE section_id=?',[section.section_id]))[0].capacity,3);record('Section forms preserve course/instructor/term references and save capacity changes');
    await view('registrations');await open('[data-action="edit-registration"][data-id="68"]');
    assert.equal(await browser.evaluate('document.querySelector("#field-final_grade").disabled'),true);
    await fill({status:'COMPLETED'});await browser.wait('!document.querySelector("#field-final_grade").disabled');
    await fill({final_grade:'B+'});await submit();
    assert.equal((await dao.run('SELECT final_grade FROM registrations WHERE registration_id=68'))[0].final_grade,'B+');
    await browser.wait(loaded('registrations'));await open('[data-action="edit-registration"][data-id="68"]');await fill({status:'DROPPED'});await submit();
    assert.equal((await dao.run('SELECT final_grade FROM registrations WHERE registration_id=68'))[0].final_grade,null);record('Status-dependent grade controls and final-grade clearing match the SQL rules');
    await view('waitlists');await open('[data-action="promote"][data-id="5:103"]');await submit();
    assert.equal((await dao.run("SELECT COUNT(*) AS n FROM registrations WHERE student_id=5 AND section_id=103 AND status='ENROLLED'"))[0].n,1);
    await browser.wait(loaded('waitlists'));await open('[data-action="remove-waitlist"][data-id="6:103"]');await submit();
    assert.equal((await dao.run('SELECT COUNT(*) AS n FROM waitlist_entries WHERE section_id=103'))[0].n,0);record('Waitlist promotion and removal operate through Angular confirmation dialogs');
    await view('holds');await open('[data-action="clear-hold"][data-id="1"]');await submit();
    assert.ok((await dao.run('SELECT cleared_at FROM student_holds WHERE hold_id=1'))[0].cleared_at);record('Hold clearing persists with the original hold identity');
    await view('reports');await browser.screenshot(path.join(capture,'enrollment-report.png'));record('JOIN-backed views and the SQL GROUP BY report render in Angular');
    await view('courses');await open(editCourse);await fill({title:'Saved Before Refresh Failure'});failNextLookups=true;await submit();
    await browser.wait('document.querySelector("#toasts").innerText.includes("Your change was saved, but")');
    assert.equal((await dao.run('SELECT title FROM courses WHERE course_id=?',[course.course_id]))[0].title,'Saved Before Refresh Failure');record('A saved write followed by refresh failure produces a visible, truthful warning');
    await browser.send('Page.reload');await browser.wait(loaded('courses'));
    await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await view('students');await open('[data-action="new-student"]');
    assert.ok(await browser.evaluate('document.querySelector("#app-dialog").getBoundingClientRect().width<=window.innerWidth'));
    await click('#dialog-cancel');await view('reports');await browser.screenshot(path.join(capture,'narrow-viewport.png'));
    assert.ok(await browser.evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
    record('390px emulation supports forms, Cancel, navigation, and internally scrolling tables; no physical phone claimed');
    const exceptions=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0,JSON.stringify(exceptions));
    const summary={date:new Date().toISOString(),framework:'Angular '+angularVersion,browser:browser.version.product,userAgent:browser.version.userAgent,passed:results.length,results,physicalPhoneTested:false};
    fs.writeFileSync(path.join(root,'docs/browser-results.json'),JSON.stringify(summary,null,2));
    console.log(`Completed ${results.length} Angular browser checks.`);
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
