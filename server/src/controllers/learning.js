import { Lesson, Assignment, Submission, Enrollment } from '../models/index.js';
import { fail, text, pick, get, owns, ownedCourse, accessCourse, send, httpUrl } from '../lib.js';
import { storeFile, removeFile, publicFile, download } from '../uploads.js';
export async function saveLesson(req,res) {
 const lesson=req.params.id?await Lesson.findById((await get(Lesson,req.params.id))._id).select('+file'):new Lesson({course:req.params.courseId});
 await ownedCourse(req,lesson.course.toString()); const data=pick(req.body,['title','type','content','videoUrl']);
 if(!lesson.isNew && data.type && data.type!==lesson.type) fail(400,'Lesson type cannot be changed');
 if(lesson.isNew || 'title' in data) data.title=text(data.title,'title');
 if('content' in data) data.content=text(data.content,'content',100000,false);
 if('videoUrl' in data) data.videoUrl=httpUrl(text(data.videoUrl,'video URL',2048,false));
 Object.assign(lesson,data);
 if(lesson.type==='text' && !lesson.content.trim()) fail(400,'Text content required');
 if(lesson.type==='video' && !lesson.videoUrl) fail(400,'Video URL required');
 if(req.file && lesson.type!=='pdf') fail(400,'Only PDF lessons accept files');
 if(lesson.type==='pdf' && !req.file && !lesson.file) fail(400,'PDF file required');
 await lesson.validate(); const previous=lesson.file, file=await storeFile(req.file,true); if(file) lesson.file=file;
 const isNew=lesson.isNew; try { await lesson.save(); } catch(e) { await removeFile(file); throw e; } if(file) await removeFile(previous);
 send(res,publicFile(lesson,'lessons'),isNew?201:200);
}
export async function deleteLesson(req,res) { const lesson=await get(Lesson,req.params.id); await ownedCourse(req,lesson.course.toString()); const withFile=await Lesson.findById(lesson._id).select('+file'); await removeFile(withFile.file); await lesson.deleteOne(); await Enrollment.updateMany({course:lesson.course},{$pull:{completedLessons:lesson._id}}); send(res,{deleted:true}); }
export async function lessonFile(req,res) { const lesson=await get(Lesson,req.params.id); await accessCourse(req,lesson.course.toString()); const doc=await Lesson.findById(lesson._id).select('+file'); download(res,doc.file); }
export async function saveAssignment(req,res) {
 const assignment=req.params.id?await get(Assignment,req.params.id):new Assignment({course:req.params.courseId}); await ownedCourse(req,assignment.course.toString());
 const data=pick(req.body,['title','description','dueDate','maxScore']); if(assignment.isNew || 'title' in data) data.title=text(data.title,'title'); if(assignment.isNew || 'description' in data) data.description=text(data.description,'description',20000);
 if('dueDate' in data && (typeof data.dueDate!=='string' || !Number.isFinite(Date.parse(data.dueDate)))) fail(400,'Invalid due date');
 if('maxScore' in data && (typeof data.maxScore!=='number' || !Number.isFinite(data.maxScore))) fail(400,'Invalid max score');
 if(!assignment.isNew && 'maxScore' in data && await Submission.exists({assignment:assignment._id,grade:{$gt:data.maxScore}})) fail(400,'Max score cannot be below existing grades');
 const isNew=assignment.isNew; Object.assign(assignment,data); await assignment.save(); send(res,assignment,isNew?201:200);
}
export async function assignmentDetail(req,res) { const assignment=await get(Assignment,req.params.id); const {course}=await accessCourse(req,assignment.course.toString()); const owner=owns(req.user,course); const submission=await Submission.findOne({assignment:assignment._id,student:req.user._id}).select('+file'); const submissions=owner?await Submission.find({assignment:assignment._id}).select('+file').populate('student','name email'):[]; send(res,{assignment,submission:submission?publicFile(submission,'submissions'):null,submissions:submissions.map(s=>publicFile(s,'submissions'))}); }
export async function deleteAssignment(req,res) { const assignment=await get(Assignment,req.params.id); await ownedCourse(req,assignment.course.toString()); const subs=await Submission.find({assignment:assignment._id}).select('+file'); await Promise.all(subs.map(s=>removeFile(s.file))); await Submission.deleteMany({assignment:assignment._id}); await assignment.deleteOne(); send(res,{deleted:true}); }
export async function submit(req,res) {
 const assignment=await get(Assignment,req.params.id); await accessCourse(req,assignment.course.toString()); if(assignment.dueDate.getTime()<=Date.now()) fail(400,'Submission deadline has passed');
 const previous=await Submission.findOne({assignment:assignment._id,student:req.user._id}).select('+file'); if(previous?.grade!=null) fail(409,'Graded submission cannot be changed');
 const content='text' in req.body?text(req.body.text,'text',100000,false):(previous?.text||''); if(!content && !req.file && !previous?.file) fail(400,'Text or file required');
 const file=await storeFile(req.file); const update={text:content,submittedAt:new Date()}; if(file) update.file=file;
 let result; try { result=await Submission.findOneAndUpdate({assignment:assignment._id,student:req.user._id,grade:null},{$set:update},{new:true,upsert:!previous,runValidators:true}).select('+file'); if(!result) fail(409,'Graded submission cannot be changed'); } catch(e) { await removeFile(file); throw e; }
 if(file) await removeFile(previous?.file); send(res,publicFile(result,'submissions'),previous?200:201);
}
export async function grade(req,res) { const submission=await get(Submission,req.params.id), assignment=await get(Assignment,submission.assignment.toString()); await ownedCourse(req,assignment.course.toString()); const grade=req.body.grade; if(typeof grade!=='number' || !Number.isFinite(grade) || grade<0 || grade>assignment.maxScore) fail(400,'Grade must be between 0 and maxScore'); submission.grade=grade; submission.feedback=text(req.body.feedback??'','feedback',10000,false); submission.gradedAt=new Date(); await submission.save(); send(res,submission); }
export async function submissionFile(req,res) { const submission=await get(Submission,req.params.id); if(String(submission.student)!==String(req.user._id)) { const assignment=await get(Assignment,submission.assignment.toString()); await ownedCourse(req,assignment.course.toString()); } const doc=await Submission.findById(submission._id).select('+file'); download(res,doc.file); }
