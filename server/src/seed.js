import bcrypt from 'bcryptjs';
import { User, Category, Course, Lesson, Assignment, Enrollment } from './models/index.js';
export async function seed() {
 const password=await bcrypt.hash('Classroom@123',12);
 const accounts=[['admin','Quản trị viên'],['teacher','Nguyễn Minh Anh'],['student','Phạm Đình Bảo']];
 const users={}; for(const [role,name] of accounts) users[role]=await User.findOneAndUpdate({email:`${role}@classroom.local`},{$setOnInsert:{name,password,role,isBlocked:false}},{upsert:true,new:true});
 const categories=[]; for(const [name,description] of [['Lập trình','Kiến thức lập trình và phát triển phần mềm'],['Thiết kế','Tư duy thiết kế và trải nghiệm người dùng'],['Dữ liệu','Phân tích và ứng dụng dữ liệu']]) categories.push(await Category.findOneAndUpdate({name},{$setOnInsert:{description}},{upsert:true,new:true}));
 const definitions=[['Lập trình Web từ cơ bản','Xây dựng nền tảng HTML, CSS và JavaScript thông qua các bài học thực hành.',0,'Cơ bản'],['Thiết kế giao diện người dùng','Khám phá bố cục, màu sắc và nguyên tắc thiết kế giao diện dễ sử dụng.',1,'Cơ bản'],['JavaScript nâng cao','Làm chủ bất đồng bộ, module và các kỹ thuật JavaScript hiện đại.',0,'Nâng cao'],['Nhập môn phân tích dữ liệu','Bắt đầu hành trình khám phá dữ liệu và tư duy phân tích.',2,'Cơ bản']];
 for(const [title,description,category,level] of definitions) {
 const course=await Course.findOneAndUpdate({title,teacher:users.teacher._id},{$setOnInsert:{description,category:categories[category]._id,level,status:'published'}},{upsert:true,new:true});
 const lesson=await Lesson.findOneAndUpdate({course:course._id,title:'Chào mừng đến với khóa học'},{$setOnInsert:{type:'text',content:'Chào mừng bạn đến với khóa học! Hãy đọc nội dung, ghi chép những ý chính và hoàn thành bài tập để củng cố kiến thức.\n\nMục tiêu: nắm vững khái niệm nền tảng, thực hành từng bước và vận dụng vào dự án của riêng bạn.'}},{upsert:true,new:true});
 await Lesson.findOneAndUpdate({course:course._id,title:'Thực hành kiến thức nền tảng'},{$setOnInsert:{type:'text',content:'Bước 1: xác định mục tiêu.\nBước 2: chia công việc thành các phần nhỏ.\nBước 3: thực hành, kiểm tra kết quả và ghi lại điều đã học.'}},{upsert:true,new:true});
 await Assignment.findOneAndUpdate({course:course._id,title:'Bài tập thực hành đầu tiên'},{$setOnInsert:{description:'Tóm tắt những kiến thức đã học và trình bày một ví dụ ứng dụng thực tế. Bạn có thể nộp nội dung trực tiếp hoặc đính kèm tài liệu.',dueDate:new Date(Date.now()+90*86400000),maxScore:10}},{upsert:true,new:true});
 if(category===0 && level==='Cơ bản') await Enrollment.findOneAndUpdate({course:course._id,student:users.student._id},{$setOnInsert:{completedLessons:[lesson._id]}},{upsert:true,new:true});
 }
 return users;
}
