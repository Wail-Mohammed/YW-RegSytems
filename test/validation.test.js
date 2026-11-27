'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const v=require('../validation');
const student={first_name:' Maya ',last_name:'Chen',email:'MAYA@EXAMPLE.EDU',major:' Computer Science '};
test('student values are trimmed; email normalized and original major retained',()=>{
  assert.deepEqual(v.person(student),{first_name:'Maya',last_name:'Chen',email:'maya@example.edu',major:'Computer Science'});
});
test('an undeclared major is NULL, while invalid data is rejected',()=>{
  for(const major of [undefined,null,'','   '])assert.equal(v.person({...student,major}).major,null);
  for(const major of [23,{},'x'.repeat(121)])assert.throws(()=>v.person({...student,major}),v.AppError);
});
test('missing names and invalid email are rejected',()=>{
  for(const patch of [{first_name:''},{last_name:' '},{email:'not an email'},{first_name:'x'.repeat(81)}])assert.throws(()=>v.person({...student,...patch}),v.AppError);
});
test('IDs are positive unsigned integer values, not coerced arrays or objects',()=>{
  assert.equal(v.id('42'),42);
  for(const value of [0,-1,1.5,'1 OR 1=1','01',null,undefined,[],[1],{},4294967296])assert.throws(()=>v.id(value),v.AppError);
});
test('course credits, code and schema-sized title are checked',()=>{
  const course={department_id:1,course_code:'cs 101',title:'x'.repeat(160),credits:3};
  assert.equal(v.course(course).course_code,'CS 101');
  for(const patch of [{credits:0},{credits:7},{credits:1.2},{title:'x'.repeat(161)},{course_code:'<script>'}])assert.throws(()=>v.course({...course,...patch}),v.AppError);
});
test('grades are present exactly for completed registrations, including a passing D',()=>{
  assert.deepEqual(v.registration({status:'COMPLETED',final_grade:'D'}),{status:'COMPLETED',final_grade:'D'});
  assert.equal(v.registration({status:'ENROLLED'}).final_grade,null);
  for(const value of [{status:'COMPLETED'},{status:'ENROLLED',final_grade:'A'},{status:'COMPLETED',final_grade:'Z'},{status:'OTHER'},{status:'DROPPED',final_grade:false}])assert.throws(()=>v.registration(value),v.AppError);
});
test('search input length and type are validated',()=>{
  assert.equal(v.search(undefined),'');assert.equal(v.search('  CS 101  '),'CS 101');
  for(const value of ['x'.repeat(101),{},['CS']])assert.throws(()=>v.search(value),v.AppError);
});
