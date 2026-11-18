import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
process.env.JWT_SECRET='integration-test-secret-with-more-than-32-characters';
const uploads=await mkdtemp(path.join(tmpdir(),'classroom-tests-')); process.env.UPLOAD_DIR=uploads;
const {app}=await import('../src/app.js'); const models=await import('../src/models/index.js');
let mongo, tokens={}, users={}, category, course, lesson, pdfLesson, assignment, submission;
const api=(method,url,role='admin')=>request(app)[method]('/api'+url).set('Authorization',`Bearer ${tokens[role]}`);
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
before(async()=>{ mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri()); await Promise.all(Object.values(models).map(m=>m.init())); for(const role of ['admin','teacher','student','other']) { users[role]=await models.User.create({name:role,email:role+'@test.local',password:await bcrypt.hash('Classroom@123',4),role:role==='other'?'teacher':role}); const r=await request(app).post('/api/auth/login').send({email:role+'@test.local',password:'Classroom@123'});assert.equal(r.status,200);tokens[role]=r.body.data.token; } });
after(async()=>{await mongoose.disconnect();await mongo?.stop();await rm(uploads,{recursive:true,force:true});});
test('complete classroom workflows and authorization',async t=>{
 await t.test('health, auth, registration whitelist and validation',async()=>{
 assert.equal((await request(app).get('/api/health')).status,200); assert.equal((await request(app).get('/api/courses')).status,401);
 const r=await request(app).post('/api/auth/register').send({name:'New student',email:'new@test.local',password:'Classroom@123',role:'admin',isBlocked:true});assert.equal(r.status,201);assert.equal(r.body.data.user.role,'student');assert.equal(r.body.data.user.isBlocked,false);assert.equal(r.body.data.user.password,undefined);
 assert.equal((await request(app).post('/api/auth/login').send({email:{$ne:null},password:'x'})).status,400);assert.equal((await api('get','/courses/not-an-id')).status,400); assert.equal((await api('get','/auth/me','student')).body.data.name,'student');
 });
 await t.test('category and course ownership, publication and whitelisting',async()=>{
 assert.equal((await api('post','/categories','teacher').send({name:'Denied'})).status,403);
 let r=await api('post','/categories').send({name:'Programming',description:'Learn'});assert.equal(r.status,201);category=r.body.data;
 assert.equal((await api('patch',`/categories/${category._id}`).send({description:'Updated'})).status,200);
 r=await api('post','/courses','teacher').send({title:'Web',description:'Web foundations',category:category._id,teacher:users.other._id,status:'draft'});assert.equal(r.status,201);course=r.body.data;assert.equal(course.teacher._id,String(users.teacher._id));
 assert.equal((await api('get','/courses','student')).body.data.length,0);assert.equal((await api('get','/courses?mine=true','teacher')).body.data.length,1);
 let preview=await api('get',`/courses/${course._id}`,'student');assert.equal(preview.status,404);assert.equal((await api('patch',`/courses/${course._id}`,'other').send({title:'Stolen'})).status,403);
 assert.equal((await api('patch',`/courses/${course._id}`,'teacher').send({status:'published'})).status,200);let publicAssignment=await models.Assignment.create({course:course._id,title:'Public preview',description:'Do not leak this',dueDate:new Date(Date.now()+86400000),maxScore:10});let publicDetail=await api('get',`/courses/${course._id}`,'student');assert.equal(publicDetail.status,200);assert.equal(publicDetail.body.data.assignments[0].description,undefined);await publicAssignment.deleteOne();assert.equal((await api('delete',`/categories/${category._id}`)).status,409);
 });
 await t.test('lessons, protected PDFs and safe video protocols',async()=>{
 let r=await api('post',`/courses/${course._id}/lessons`,'teacher').send({title:'Intro',type:'text',content:'Secret lesson'});assert.equal(r.status,201);lesson=r.body.data;
 assert.equal((await api('post',`/courses/${course._id}/lessons`,'teacher').send({title:'Video',type:'video',videoUrl:'javascript:alert(1)'})).status,400);
 assert.equal((await api('post',`/courses/${course._id}/lessons`,'teacher').field('title','Bad').field('type','pdf').attach('file',Buffer.from('fake'),{filename:'fake.pdf',contentType:'application/pdf'})).status,400);
 r=await api('post',`/courses/${course._id}/lessons`,'teacher').field('title','Notes').field('type','pdf').attach('file',pdf,{filename:'notes.pdf',contentType:'application/pdf'});assert.equal(r.status,201);pdfLesson=r.body.data;assert.equal(pdfLesson.file.filename,undefined);
 r=await api('get',`/courses/${course._id}`,'student');assert.equal(r.body.data.lessons[0].content,undefined);assert.equal(r.body.data.lessons[0].locked,true);
 assert.equal((await api('get',`/lessons/${pdfLesson._id}/file`,'student')).status,403);assert.equal((await api('get',`/lessons/${pdfLesson._id}/file`,'teacher')).status,200);
 });
 await t.test('enrollment, progress, student listing and duplicate protection',async()=>{
 for(let i=0;i<2;i++) assert.equal((await api('post',`/courses/${course._id}/enroll`,'student')).status,201);
 assert.equal(await models.Enrollment.countDocuments(),1);
 assert.equal((await api('get',`/lessons/${pdfLesson._id}/file`,'student')).status,200);
 assert.equal((await api('patch',`/courses/${course._id}/progress`,'student').send({lessonId:lesson._id,completed:'true'})).status,400);
 for(let i=0;i<2;i++) assert.equal((await api('patch',`/courses/${course._id}/progress`,'student').send({lessonId:lesson._id,completed:true})).status,200);
 const r=await api('get','/enrollments/me','student');assert.equal(r.body.data[0].progress,50);assert.equal(r.body.data[0].course.teacher.name,'teacher');assert.equal(r.body.data[0].completedLessons.length,1);
 assert.equal((await api('get',`/courses/${course._id}/students`,'teacher')).body.data[0].student.name,'student');assert.equal((await api('get',`/courses/${course._id}/students`,'other')).status,403);
 });
 await t.test('assignments, submission upsert, file protection and grading',async()=>{
 let r=await api('post',`/courses/${course._id}/assignments`,'teacher').send({title:'Practice',description:'Complete task',dueDate:new Date(Date.now()+86400000).toISOString(),maxScore:10});assert.equal(r.status,201);assignment=r.body.data;
 assert.equal((await api('get',`/assignments/${assignment._id}`,'other')).status,403);
 r=await api('post',`/assignments/${assignment._id}/submissions`,'student').field('text','Answer').attach('file',Buffer.from('My homework'),{filename:'homework.txt',contentType:'text/plain'});assert.equal(r.status,201);submission=r.body.data;assert.equal(submission.file.filename,undefined);
 r=await api('post',`/assignments/${assignment._id}/submissions`,'student').send({text:'Improved answer'});assert.equal(r.status,200);assert.equal(await models.Submission.countDocuments(),1);
 assert.equal((await api('get',`/submissions/${submission._id}/file`,'other')).status,403);assert.equal((await api('get',`/submissions/${submission._id}/file`,'teacher')).status,200);
 r=await api('get',`/assignments/${assignment._id}`,'teacher');assert.equal(r.body.data.submissions[0].student.name,'student');assert.equal((await api('get',`/assignments/${assignment._id}`,'student')).body.data.submissions.length,0);
 assert.equal((await api('patch',`/submissions/${submission._id}/grade`,'teacher').send({grade:11})).status,400);assert.equal((await api('patch',`/submissions/${submission._id}/grade`,'other').send({grade:8})).status,403);
 assert.equal((await api('patch',`/submissions/${submission._id}/grade`,'teacher').send({grade:8,feedback:'Good work'})).status,200);
 assert.equal((await api('post',`/assignments/${assignment._id}/submissions`,'student').send({text:'Overwrite'})).status,409);assert.equal((await api('patch',`/assignments/${assignment._id}`,'teacher').send({maxScore:5})).status,400);
 const late=await models.Assignment.create({course:course._id,title:'Late',description:'Late task',dueDate:new Date(0),maxScore:10});assert.equal((await api('post',`/assignments/${late._id}/submissions`,'student').send({text:'Late'})).status,400);
 });
 await t.test('admin role management, blocked sessions and self-protection',async()=>{
 assert.equal((await api('get','/users','student')).status,403);assert.equal((await api('get','/users')).status,200);
 assert.equal((await api('patch',`/users/${users.admin._id}`).send({isBlocked:true})).status,400);assert.equal((await api('patch',`/users/${users.admin._id}`).send({role:'student'})).status,400);
 assert.equal((await api('patch',`/users/${users.student._id}`).send({isBlocked:true})).status,200);assert.equal((await api('get','/auth/me','student')).status,403);assert.equal((await request(app).post('/api/auth/login').send({email:'student@test.local',password:'Classroom@123'})).status,403);
 await api('patch',`/users/${users.student._id}`).send({isBlocked:false});assert.equal((await api('patch',`/users/${users.other._id}`).send({role:'student'})).status,200);assert.equal((await api('post','/courses','other').send({})).status,403);
 });
 await t.test('upload limits and deletion cleanup',async()=>{
 assert.equal((await api('post',`/courses/${course._id}/lessons`,'teacher').field('title','Large').field('type','pdf').attach('file',Buffer.alloc(10*1024*1024+1),{filename:'large.pdf'})).status,413);
 assert.equal((await api('delete',`/lessons/${lesson._id}`,'teacher')).status,200);assert.equal((await models.Enrollment.findOne()).completedLessons.length,0);
 assert.equal((await api('delete',`/assignments/${assignment._id}`,'teacher')).status,200);assert.equal(await models.Submission.countDocuments(),0);
 assert.equal((await api('delete',`/courses/${course._id}`,'teacher')).status,200);assert.equal(await models.Lesson.countDocuments(),0);assert.equal(await models.Enrollment.countDocuments(),0);assert.equal((await api('delete',`/categories/${category._id}`)).status,200);
 });
 await t.test('seed additive and idempotent without resetting users',async()=>{const {seed}=await import('../src/seed.js');await seed();const count=await models.Course.countDocuments();await models.User.updateOne({email:'student@classroom.local'},{$set:{name:'Preserved'}});await seed();assert.equal(await models.Course.countDocuments(),count);assert.equal((await models.User.findOne({email:'student@classroom.local'})).name,'Preserved');assert.ok(await models.User.exists({_id:users.admin._id}));});
});
