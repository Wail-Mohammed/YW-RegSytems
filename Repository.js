const v = require('./validation');
const { AppError } = v;
const occupied = "('ENROLLED','COMPLETED')";
const sectionSelect = `SELECT s.*, c.course_code,c.title,c.credits,c.department_id,d.name AS department_name,
 CONCAT(i.first_name,' ',i.last_name) AS instructor_name,t.name AS term_name,t.year,
 COALESCE(r.occupied_seats,0) AS occupied_seats,s.capacity-COALESCE(r.occupied_seats,0) AS available_seats,
 COALESCE(w.waitlist_count,0) AS waitlist_count
 FROM sections s JOIN courses c ON c.course_id=s.course_id JOIN departments d ON d.department_id=c.department_id
 JOIN instructors i ON i.instructor_id=s.instructor_id JOIN terms t ON t.term_id=s.term_id
 LEFT JOIN (SELECT section_id,COUNT(*) AS occupied_seats FROM registrations WHERE status IN ${occupied} GROUP BY section_id) r ON r.section_id=s.section_id
 LEFT JOIN (SELECT section_id,COUNT(*) AS waitlist_count FROM waitlist_entries GROUP BY section_id) w ON w.section_id=s.section_id`;
const registrationSelect = `SELECT r.*,CONCAT(st.first_name,' ',st.last_name) AS student_name,st.first_name,st.last_name,st.email,
 c.course_code,c.title,c.credits,s.section_number,s.meeting_time,s.location,t.name AS term_name,t.year,
 CONCAT(i.first_name,' ',i.last_name) AS instructor_name
 FROM registrations r JOIN students st ON st.student_id=r.student_id JOIN sections s ON s.section_id=r.section_id
 JOIN courses c ON c.course_id=s.course_id JOIN terms t ON t.term_id=s.term_id JOIN instructors i ON i.instructor_id=s.instructor_id`;
class Repository {
  constructor(dao) { this.dao = dao; }
  run(sql, args=[]) { return this.dao.run(sql,args); }
  async requireRow(table,key,value,run=this.run.bind(this),lock=false) {
    // table/key are fixed application literals; values are always placeholders.
    const rows=await run(`SELECT * FROM ${table} WHERE ${key}=?${lock?' FOR UPDATE':''}`,[value]);
    if (!rows.length) throw new AppError(`${table.replaceAll('_',' ')} record was not found.`,404,'NOT_FOUND');
    return rows[0];
  }
  async lookups() {
    const [departments,terms,instructors,courses,students,sections] = await Promise.all([
      this.run('SELECT * FROM departments ORDER BY name'),
      this.run('SELECT * FROM terms ORDER BY year DESC,start_date DESC'),
      this.run('SELECT * FROM instructors ORDER BY last_name,first_name'),
      this.run('SELECT * FROM courses ORDER BY course_code'),
      this.run('SELECT * FROM students ORDER BY last_name,first_name LIMIT 1000'),
      this.run('SELECT s.section_id,s.term_id,s.section_number,c.course_code,c.title,t.name AS term_name,t.year FROM sections s JOIN courses c ON c.course_id=s.course_id JOIN terms t ON t.term_id=s.term_id ORDER BY t.year DESC,c.course_code,s.section_number')
    ]); return {departments,terms,instructors,courses,students,sections};
  }
  async dashboard(q) {
    const term=v.optionalId(q.term_id,'Term');
    const rows=await this.run(`SELECT (SELECT COUNT(*) FROM students) AS students,(SELECT COUNT(*) FROM courses) AS courses,
      (SELECT COUNT(*) FROM sections WHERE (? IS NULL OR term_id=?)) AS sections,
      (SELECT COUNT(*) FROM registrations r JOIN sections s ON s.section_id=r.section_id WHERE r.status IN ${occupied} AND (? IS NULL OR s.term_id=?)) AS occupied_seats,
      (SELECT COUNT(*) FROM waitlist_entries w JOIN sections s ON s.section_id=w.section_id WHERE (? IS NULL OR s.term_id=?)) AS waitlisted,
      (SELECT COUNT(*) FROM student_holds WHERE cleared_at IS NULL) AS active_holds`,[term,term,term,term,term,term]);
    return {stats:rows[0]};
  }
  sections(q={}) {
    const text=v.search(q.q),term=v.optionalId(q.term_id,'Term'),dept=v.optionalId(q.department_id,'Department'),instructor=v.optionalId(q.instructor_id,'Instructor');
    if(q.availability && !['all','open','full'].includes(q.availability))throw new AppError('Choose a valid availability filter.');
    const conditions=['(? IS NULL OR s.term_id=?)','(? IS NULL OR c.department_id=?)','(? IS NULL OR s.instructor_id=?)',"(?='' OR c.course_code LIKE ? OR c.title LIKE ? OR CONCAT(i.first_name,' ',i.last_name) LIKE ? OR s.location LIKE ?)"];
    if(q.availability==='open')conditions.push('s.capacity>COALESCE(r.occupied_seats,0)');
    if(q.availability==='full')conditions.push('s.capacity<=COALESCE(r.occupied_seats,0)');
    return this.run(`${sectionSelect} WHERE ${conditions.join(' AND ')} ORDER BY t.year DESC,t.start_date DESC,c.course_code,s.section_number LIMIT 500`,[term,term,dept,dept,instructor,instructor,text,`%${text}%`,`%${text}%`,`%${text}%`,`%${text}%`]);
  }
  students(q={}) {
    const text=v.search(q.q);
    return this.run(`SELECT st.*,(SELECT COUNT(*) FROM student_holds h WHERE h.student_id=st.student_id AND h.cleared_at IS NULL) AS active_holds,
      (SELECT COUNT(*) FROM registrations r WHERE r.student_id=st.student_id AND r.status='ENROLLED') AS enrollment_count
      FROM students st WHERE (?='' OR CONCAT(st.first_name,' ',st.last_name) LIKE ? OR st.email LIKE ? OR st.major LIKE ? OR CAST(st.student_id AS CHAR)=?) ORDER BY st.last_name,st.first_name LIMIT 500`,[text,`%${text}%`,`%${text}%`,`%${text}%`,text]);
  }
  async saveStudent(body,id=null) {
    const p=v.person(body);
    if(id){await this.requireRow('students','student_id',id);await this.run('UPDATE students SET first_name=?,last_name=?,email=?,major=? WHERE student_id=?',[p.first_name,p.last_name,p.email,p.major,id]);}
    else{id=(await this.run('INSERT INTO students(first_name,last_name,email,major) VALUES (?,?,?,?)',[p.first_name,p.last_name,p.email,p.major])).insertId;}
    return this.requireRow('students','student_id',id);
  }
  courses(q={}) {
    const text=v.search(q.q),dept=v.optionalId(q.department_id,'Department');
    return this.run(`SELECT c.*,d.name AS department_name,(SELECT GROUP_CONCAT(pc.course_code ORDER BY pc.course_code SEPARATOR ', ') FROM course_prerequisites pr JOIN courses pc ON pc.course_id=pr.prerequisite_id WHERE pr.course_id=c.course_id) AS prerequisite_codes FROM courses c JOIN departments d ON d.department_id=c.department_id WHERE (? IS NULL OR c.department_id=?) AND (?='' OR c.course_code LIKE ? OR c.title LIKE ?) ORDER BY c.course_code LIMIT 500`,[dept,dept,text,`%${text}%`,`%${text}%`]);
  }
  async saveCourse(body,id=null) {
    const c=v.course(body);
    if(id){await this.requireRow('courses','course_id',id);await this.run('UPDATE courses SET department_id=?,course_code=?,title=?,credits=? WHERE course_id=?',[c.department_id,c.course_code,c.title,c.credits,id]);}
    else{id=(await this.run('INSERT INTO courses(department_id,course_code,title,credits) VALUES (?,?,?,?)',[c.department_id,c.course_code,c.title,c.credits])).insertId;}
    return this.requireRow('courses','course_id',id);
  }
  async saveSection(body,id=null) {
    const ids=[v.id(body.course_id,'Course'),v.id(body.instructor_id,'Instructor'),v.id(body.term_id,'Term')];
    const vals=[...ids,v.text(body.section_number,'Section number',12),v.text(body.meeting_time,'Meeting time',120),v.text(body.location,'Location',120),v.id(body.capacity,'Capacity')];
    return this.dao.transaction(async run=>{
      if(id){await this.requireRow('sections','section_id',id,run,true);
        const count=(await run(`SELECT COUNT(*) AS n FROM registrations WHERE section_id=? AND status IN ${occupied}`,[id]))[0].n;
        if(vals[6]<count)throw new AppError('Capacity cannot be lower than the number of occupied seats.',409,'CAPACITY');
        const old=(await run('SELECT * FROM sections WHERE section_id=?',[id]))[0];
        const associations=(await run('SELECT (SELECT COUNT(*) FROM registrations WHERE section_id=?)+(SELECT COUNT(*) FROM waitlist_entries WHERE section_id=?) AS n',[id,id]))[0].n;
        if(associations && (old.course_id!==ids[0] || old.term_id!==ids[2]))throw new AppError('A section with registrations or waitlist entries must keep its course and term.',409,'SECTION_IN_USE');
        await run('UPDATE sections SET course_id=?,instructor_id=?,term_id=?,section_number=?,meeting_time=?,location=?,capacity=? WHERE section_id=?',[...vals,id]);
      } else{id=(await run('INSERT INTO sections(course_id,instructor_id,term_id,section_number,meeting_time,location,capacity) VALUES (?,?,?,?,?,?,?)',vals)).insertId;}
      return (await run('SELECT * FROM sections WHERE section_id=?',[id]))[0];
    });
  }
  async schedule(studentId) {
    await this.requireRow('students','student_id',studentId);
    return this.run(`${registrationSelect} WHERE r.student_id=? ORDER BY t.year DESC,t.start_date DESC,c.course_code`,[studentId]);
  }
  async roster(sectionId) {
    await this.requireRow('sections','section_id',sectionId);
    return this.run(`${registrationSelect} WHERE r.section_id=? ORDER BY st.last_name,st.first_name`,[sectionId]);
  }
  registrations(q={}) {
    const text=v.search(q.q),term=v.optionalId(q.term_id,'Term');
    if(q.status && !['ENROLLED','COMPLETED','DROPPED','WITHDRAWN'].includes(q.status))throw new AppError('Choose a valid status filter.');
    return this.run(`${registrationSelect} WHERE (? IS NULL OR s.term_id=?) AND (?='' OR r.status=?) AND (?='' OR CONCAT(st.first_name,' ',st.last_name) LIKE ? OR c.course_code LIKE ?) ORDER BY r.registered_at DESC,r.registration_id DESC LIMIT 500`,[term,term,q.status||'',q.status||'',text,`%${text}%`,`%${text}%`]);
  }
  async eligibility(run,studentId,section) {
    const holds=await run('SELECT hold_id FROM student_holds WHERE student_id=? AND cleared_at IS NULL LIMIT 1',[studentId]);
    if(holds.length)throw new AppError('This student has an active hold. Clear the hold before enrolling.',409,'ACTIVE_HOLD');
    const missing=await run(`SELECT c.course_code FROM course_prerequisites pr JOIN courses c ON c.course_id=pr.prerequisite_id
      WHERE pr.course_id=? AND NOT EXISTS (SELECT 1 FROM registrations r JOIN sections s ON s.section_id=r.section_id
      WHERE r.student_id=? AND s.course_id=pr.prerequisite_id AND r.status='COMPLETED' AND r.final_grade<>'F') ORDER BY c.course_code`,[section.course_id,studentId]);
    if(missing.length)throw new AppError(`Missing passing prerequisite: ${missing.map(r=>r.course_code).join(', ')}.`,409,'PREREQUISITE');
  }
  async lockEnrollment(run,studentId,sectionId) {
    const section=await this.requireRow('sections','section_id',sectionId,run,true);
    await this.requireRow('students','student_id',studentId,run,true);
    return section;
  }
  async checkSeat(run,section,exceptId=null) {
    const n=(await run(`SELECT COUNT(*) AS n FROM registrations WHERE section_id=? AND status IN ${occupied} AND (? IS NULL OR registration_id<>?)`,[section.section_id,exceptId,exceptId]))[0].n;
    if(n>=section.capacity)throw new AppError('This section is full. Join the waitlist instead.',409,'SECTION_FULL');
  }
  async checkQueue(run,studentId,sectionId) {
    const queue=await run('SELECT student_id FROM waitlist_entries WHERE section_id=? ORDER BY joined_at,student_id LIMIT 1',[sectionId]);
    if(queue.length && queue[0].student_id!==studentId)throw new AppError('Another student is first on the waitlist. Promote that student before adding a new enrollment.',409,'WAITLIST_ORDER');
  }
  async enroll(body) {
    const studentId=v.id(body.student_id,'Student'),sectionId=v.id(body.section_id,'Section');
    return this.dao.transaction(async run=>{
      const section=await this.lockEnrollment(run,studentId,sectionId);
      const existing=await run('SELECT registration_id FROM registrations WHERE student_id=? AND section_id=?',[studentId,sectionId]);
      if(existing.length)throw new AppError('This student already has a registration for this section. Update its status instead.',409,'DUPLICATE');
      await this.eligibility(run,studentId,section);await this.checkSeat(run,section);await this.checkQueue(run,studentId,sectionId);
      const id=(await run("INSERT INTO registrations(student_id,section_id,status,final_grade) VALUES (?,?,'ENROLLED',NULL)",[studentId,sectionId])).insertId;
      await run('DELETE FROM waitlist_entries WHERE student_id=? AND section_id=?',[studentId,sectionId]);
      return (await run('SELECT * FROM registrations WHERE registration_id=?',[id]))[0];
    });
  }
  async updateRegistration(id,body) {
    const data=v.registration(body);
    const current=await this.requireRow('registrations','registration_id',id);
    return this.dao.transaction(async run=>{
      const section=await this.lockEnrollment(run,current.student_id,current.section_id);
      const old=await this.requireRow('registrations','registration_id',id,run,true);
      if(data.status==='ENROLLED' && old.status!=='ENROLLED'){
        await this.eligibility(run,old.student_id,section);await this.checkQueue(run,old.student_id,old.section_id);
      }
      // P06 permits historical COMPLETED records. Grade corrections/imports do
      // not reapply present-day holds or prerequisites; seat capacity still applies.
      if(['ENROLLED','COMPLETED'].includes(data.status)){
        await this.checkSeat(run,section,id);
        await run('DELETE FROM waitlist_entries WHERE student_id=? AND section_id=?',[old.student_id,old.section_id]);
      }
      await run('UPDATE registrations SET status=?,final_grade=? WHERE registration_id=?',[data.status,data.final_grade,id]);
      return (await run('SELECT * FROM registrations WHERE registration_id=?',[id]))[0];
    });
  }
  holds(q={}) {
    const text=v.search(q.q);if(q.active && !['all','true','false'].includes(q.active))throw new AppError('Choose a valid hold filter.');
    return this.run(`SELECT h.*,CONCAT(st.first_name,' ',st.last_name) AS student_name FROM student_holds h JOIN students st ON st.student_id=h.student_id WHERE (?='' OR CONCAT(st.first_name,' ',st.last_name) LIKE ? OR h.reason LIKE ?) ${q.active==='true'?'AND h.cleared_at IS NULL':q.active==='false'?'AND h.cleared_at IS NOT NULL':''} ORDER BY h.placed_at DESC,h.hold_id DESC LIMIT 500`,[text,`%${text}%`,`%${text}%`]);
  }
  async addHold(body) {
    const studentId=v.id(body.student_id,'Student'),reason=v.text(body.reason,'Hold reason',255);
    return this.dao.transaction(async run=>{await this.requireRow('students','student_id',studentId,run,true);const id=(await run('INSERT INTO student_holds(student_id,reason) VALUES (?,?)',[studentId,reason])).insertId;return (await run('SELECT * FROM student_holds WHERE hold_id=?',[id]))[0];});
  }
  async setHold(id,body) {
    if(typeof body.cleared!=='boolean')throw new AppError('Cleared must be true or false.');
    const old=await this.requireRow('student_holds','hold_id',id);
    return this.dao.transaction(async run=>{await this.requireRow('students','student_id',old.student_id,run,true);await run(`UPDATE student_holds SET cleared_at=${body.cleared?'CURRENT_TIMESTAMP':'NULL'} WHERE hold_id=?`,[id]);return (await run('SELECT * FROM student_holds WHERE hold_id=?',[id]))[0];});
  }
  waitlists(q={}) {
    const sectionId=v.optionalId(q.section_id,'Section');
    return this.run(`SELECT w.*,CONCAT(st.first_name,' ',st.last_name) AS student_name,c.course_code,c.title,s.section_number,t.name AS term_name,t.year,
      ROW_NUMBER() OVER(PARTITION BY w.section_id ORDER BY w.joined_at,w.student_id) AS position
      FROM waitlist_entries w JOIN students st ON st.student_id=w.student_id JOIN sections s ON s.section_id=w.section_id
      JOIN courses c ON c.course_id=s.course_id JOIN terms t ON t.term_id=s.term_id WHERE (? IS NULL OR w.section_id=?) ORDER BY t.year DESC,c.course_code,s.section_number,w.joined_at,w.student_id LIMIT 500`,[sectionId,sectionId]);
  }
  async joinWaitlist(body) {
    const studentId=v.id(body.student_id,'Student'),sectionId=v.id(body.section_id,'Section');
    return this.dao.transaction(async run=>{
      const section=await this.lockEnrollment(run,studentId,sectionId);
      const reg=await run(`SELECT registration_id FROM registrations WHERE student_id=? AND section_id=? AND status IN ${occupied}`,[studentId,sectionId]);
      if(reg.length)throw new AppError('This student already occupies a seat in this section.',409,'HAS_SEAT');
      const count=(await run(`SELECT COUNT(*) AS n FROM registrations WHERE section_id=? AND status IN ${occupied}`,[sectionId]))[0].n;
      if(count<section.capacity)throw new AppError('This section has an available seat. Enroll instead of joining the waitlist.',409,'SEAT_AVAILABLE');
      await run('INSERT INTO waitlist_entries(student_id,section_id) VALUES (?,?)',[studentId,sectionId]);
      return {student_id:studentId,section_id:sectionId,message:'Student added to the waitlist.'};
    });
  }
  async removeWaitlist(studentId,sectionId) {
    studentId=v.id(studentId,'Student');sectionId=v.id(sectionId,'Section');
    return this.dao.transaction(async run=>{
      await this.lockEnrollment(run,studentId,sectionId);
      const result=await run('DELETE FROM waitlist_entries WHERE student_id=? AND section_id=?',[studentId,sectionId]);
      if(!result.affectedRows)throw new AppError('Waitlist entry was not found.',404,'NOT_FOUND');
      return {message:'Student removed from the waitlist.',student_id:studentId,section_id:sectionId};
    });
  }
  async promote(body) {
    const studentId=v.id(body.student_id,'Student'),sectionId=v.id(body.section_id,'Section');
    return this.dao.transaction(async run=>{
      const section=await this.lockEnrollment(run,studentId,sectionId);
      const entry=await run('SELECT * FROM waitlist_entries WHERE student_id=? AND section_id=? FOR UPDATE',[studentId,sectionId]);
      if(!entry.length)throw new AppError('Waitlist entry was not found.',404,'NOT_FOUND');
      await this.checkQueue(run,studentId,sectionId);await this.eligibility(run,studentId,section);await this.checkSeat(run,section);
      const existing=await run('SELECT * FROM registrations WHERE student_id=? AND section_id=?',[studentId,sectionId]);
      if(existing.length && ['ENROLLED','COMPLETED'].includes(existing[0].status))throw new AppError('This student already occupies a seat.',409,'HAS_SEAT');
      let id;
      if(existing.length){id=existing[0].registration_id;await run("UPDATE registrations SET status='ENROLLED',final_grade=NULL WHERE registration_id=?",[id]);}
      else{id=(await run("INSERT INTO registrations(student_id,section_id,status) VALUES (?,?,'ENROLLED')",[studentId,sectionId])).insertId;}
      await run('DELETE FROM waitlist_entries WHERE student_id=? AND section_id=?',[studentId,sectionId]);
      return (await run('SELECT * FROM registrations WHERE registration_id=?',[id]))[0];
    });
  }
  prerequisites(q={}) {
    const course=v.optionalId(q.course_id,'Course');
    return this.run('SELECT pr.*,c.course_code,p.course_code AS prerequisite_code FROM course_prerequisites pr JOIN courses c ON c.course_id=pr.course_id JOIN courses p ON p.course_id=pr.prerequisite_id WHERE (? IS NULL OR pr.course_id=?) ORDER BY c.course_code,p.course_code',[course,course]);
  }
  async prerequisite(body,remove=false) {
    const course=v.id(body.course_id,'Course'),prereq=v.id(body.prerequisite_id,'Prerequisite');
    if(course===prereq)throw new AppError('A course cannot be its own prerequisite.');
    return this.dao.transaction(async run=>{
      await run('SELECT course_id FROM courses ORDER BY course_id FOR UPDATE');
      await this.requireRow('courses','course_id',course,run);await this.requireRow('courses','course_id',prereq,run);
      if(remove){const result=await run('DELETE FROM course_prerequisites WHERE course_id=? AND prerequisite_id=?',[course,prereq]);if(!result.affectedRows)throw new AppError('Prerequisite link was not found.',404,'NOT_FOUND');}
      else{
        const cycle=await run('WITH RECURSIVE ancestors AS (SELECT prerequisite_id FROM course_prerequisites WHERE course_id=? UNION DISTINCT SELECT p.prerequisite_id FROM course_prerequisites p JOIN ancestors a ON p.course_id=a.prerequisite_id) SELECT prerequisite_id FROM ancestors WHERE prerequisite_id=? LIMIT 1',[prereq,course]);
        if(cycle.length)throw new AppError('This prerequisite would create a cycle.',409,'PREREQUISITE_CYCLE');
        await run('INSERT INTO course_prerequisites(course_id,prerequisite_id) VALUES (?,?)',[course,prereq]);
      }
      return {message:remove?'Prerequisite removed.':'Prerequisite added.',course_id:course,prerequisite_id:prereq};
    });
  }
  enrollmentReport(q={}) {
    const term=v.optionalId(q.term_id,'Term'),dept=v.optionalId(q.department_id,'Department');
    return this.run(`SELECT s.section_id,c.course_code,c.title,s.section_number,d.name AS department_name,t.name AS term_name,t.year,s.capacity,
      COUNT(CASE WHEN r.status='ENROLLED' THEN 1 END) AS enrolled_count,COUNT(CASE WHEN r.status='COMPLETED' THEN 1 END) AS completed_count,
      COUNT(CASE WHEN r.status IN ${occupied} THEN 1 END) AS occupied_seats,
      s.capacity-COUNT(CASE WHEN r.status IN ${occupied} THEN 1 END) AS available_seats,
      COALESCE(MAX(w.n),0) AS waitlist_count,ROUND(100.0*COUNT(CASE WHEN r.status IN ${occupied} THEN 1 END)/s.capacity,1) AS fill_percentage
      FROM sections s JOIN courses c ON c.course_id=s.course_id JOIN departments d ON d.department_id=c.department_id JOIN terms t ON t.term_id=s.term_id
      LEFT JOIN registrations r ON r.section_id=s.section_id LEFT JOIN(SELECT section_id,COUNT(*) AS n FROM waitlist_entries GROUP BY section_id)w ON w.section_id=s.section_id
      WHERE (? IS NULL OR s.term_id=?) AND (? IS NULL OR c.department_id=?)
      GROUP BY s.section_id,c.course_code,c.title,s.section_number,d.name,t.name,t.year,s.capacity,t.start_date
      ORDER BY t.year DESC,t.start_date DESC,c.course_code,s.section_number LIMIT 500`,[term,term,dept,dept]);
  }
}
module.exports=Repository;
