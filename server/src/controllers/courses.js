import { Category, Course, Lesson, Assignment, Enrollment, Submission } from '../models/index.js';
import { fail, text, pick, get, id, owns, ownedCourse, send } from '../lib.js';
import { removeFile, publicFile } from '../uploads.js';
const populate = [{path:'teacher',select:'name email'}, {path:'category'}];
export const categories = async (req,res) => send(res,await Category.find().sort({name:1}));
export async function saveCategory(req,res) { const data = pick(req.body,['name','description']); if (!req.params.id || 'name' in data) data.name = text(data.name,'name',100); if ('description' in data) data.description = text(data.description,'description',2000,false); const category = req.params.id ? await get(Category,req.params.id) : new Category(); Object.assign(category,data); await category.save(); send(res,category,req.params.id?200:201); }
export async function deleteCategory(req,res) { const category = await get(Category,req.params.id); if(await Course.exists({category:category._id})) fail(409,'Category is used by courses'); await category.deleteOne(); send(res,{deleted:true}); }
export async function courses(req,res) { const filter = {}; if(req.user.role !== 'admin') filter.status='published'; if(req.query.mine === 'true' && req.user.role === 'teacher') { delete filter.status; filter.teacher=req.user._id; } if(req.query.category) filter.category=id(req.query.category); const rows=await Course.find(filter).populate(populate).sort({createdAt:-1}); send(res,await Promise.all(rows.map(async course=>({...course.toJSON(),lessonCount:await Lesson.countDocuments({course:course._id}),enrollmentCount:await Enrollment.countDocuments({course:course._id})})))); }
export async function saveCourse(req,res) {
 const course = req.params.id ? await ownedCourse(req,req.params.id) : new Course({teacher:req.user._id});
 const data=pick(req.body,['title','description','category','level','status']);
 if(!req.params.id || 'title' in data) data.title=text(data.title,'title');
 if(!req.params.id || 'description' in data) data.description=text(data.description,'description',10000);
 if(!req.params.id || 'category' in data) await get(Category,data.category);
 Object.assign(course,data); await course.save(); await course.populate(populate); send(res,course,req.params.id?200:201);
}
export async function courseDetail(req,res) {
 const course=await get(Course,req.params.id); await course.populate(populate);
 const enrollment=await Enrollment.findOne({course:course._id,student:req.user._id}); const owner=owns(req.user,course);
 if(!owner && !enrollment && course.status!=='published') fail(404,'Course not found');
 let lessons=await Lesson.find({course:course._id}).select('+file').sort({createdAt:1});
 lessons=lessons.map(l=> { if(!owner && !enrollment) return {_id:l._id,course:l.course,title:l.title,type:l.type,locked:true}; return publicFile(l,'lessons'); });
 const assignments=await Assignment.find({course:course._id}).select(owner || enrollment ? '' : '_id course title dueDate maxScore').sort({createdAt:1});
 send(res,{course,lessons,assignments,enrollment});
}
export async function deleteCourse(req,res) {
 const course=await ownedCourse(req,req.params.id), assignments=await Assignment.find({course:course._id});
 const submissions=await Submission.find({assignment:{$in:assignments.map(a=>a._id)}}).select('+file');
 const lessons=await Lesson.find({course:course._id}).select('+file');
 await Promise.all([...submissions,...lessons].map(d=>removeFile(d.file)));
 await Submission.deleteMany({assignment:{$in:assignments.map(a=>a._id)}}); await Assignment.deleteMany({course:course._id}); await Lesson.deleteMany({course:course._id}); await Enrollment.deleteMany({course:course._id}); await course.deleteOne(); send(res,{deleted:true});
}
export async function enroll(req,res) { const course=await get(Course,req.params.id); if(course.status!=='published') fail(400,'Course is not open for enrollment'); const enrollment=await Enrollment.findOneAndUpdate({course:course._id,student:req.user._id},{$setOnInsert:{completedLessons:[]}},{upsert:true,new:true}); send(res,enrollment,201); }
export async function enrollments(req,res) { const enrollments=await Enrollment.find({student:req.user._id}).populate({path:'course',populate}); const result=await Promise.all(enrollments.map(async e=> { const totalLessons=e.course ? await Lesson.countDocuments({course:e.course._id}) : 0; return {...e.toJSON(),totalLessons,lessonCount:totalLessons,progress:totalLessons?Math.round(e.completedLessons.length/totalLessons*100):0}; })); send(res,result); }
export async function progress(req,res) { const course=await get(Course,req.params.id); const lesson=await get(Lesson,req.body.lessonId); if(String(lesson.course)!==String(course._id)) fail(400,'Lesson does not belong to course'); if(typeof req.body.completed!=='boolean') fail(400,'completed must be boolean'); const enrollment=await Enrollment.findOneAndUpdate({course:course._id,student:req.user._id},req.body.completed?{$addToSet:{completedLessons:lesson._id}}:{$pull:{completedLessons:lesson._id}},{new:true}); if(!enrollment) fail(403,'Enrollment required'); send(res,enrollment); }
export async function students(req,res) { const course=await ownedCourse(req,req.params.id); send(res,await Enrollment.find({course:course._id}).populate('student','name email')); }
