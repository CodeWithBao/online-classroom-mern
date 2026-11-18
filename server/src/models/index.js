import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const options = { timestamps: true, toJSON: { versionKey: false } };

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' },
  isBlocked: { type: Boolean, default: false },
}, options);
userSchema.methods.toJSON = function () { const value = this.toObject(); delete value.password; delete value.__v; return value; };
export const User = mongoose.model('User', userSchema);
export const Category = mongoose.model('Category', new Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 2000 },
}, options));
export const Course = mongoose.model('Course', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 10000 },
  category: ref('Category'), teacher: ref('User'),
  level: { type: String, enum: ['Cơ bản', 'Trung cấp', 'Nâng cao'], default: 'Cơ bản' },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
}, options));
const fileSchema = new Schema({ filename: String, originalName: String, mimeType: String, size: Number }, { _id: false });
export const Lesson = mongoose.model('Lesson', new Schema({
  course: ref('Course'), title: { type: String, required: true, maxlength: 200 },
  type: { type: String, enum: ['text', 'video', 'pdf'], required: true },
  content: { type: String, default: '', maxlength: 100000 }, videoUrl: { type: String, default: '' },
  file: { type: fileSchema, select: false },
}, options));
const enrollmentSchema = new Schema({ course: ref('Course'), student: ref('User'), completedLessons: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }] }, options);
enrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export const Assignment = mongoose.model('Assignment', new Schema({
  course: ref('Course'), title: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 20000 },
  dueDate: { type: Date, required: true }, maxScore: { type: Number, required: true, min: 1, max: 1000, default: 10 },
}, options));
const submissionSchema = new Schema({
  assignment: ref('Assignment'), student: ref('User'), text: { type: String, default: '', maxlength: 100000 },
  file: { type: fileSchema, select: false },
  grade: { type: Number, default: null, min: 0 }, feedback: { type: String, default: '', maxlength: 10000 },
  gradedAt: { type: Date, default: null }, submittedAt: { type: Date, default: Date.now },
}, options);
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
export const Submission = mongoose.model('Submission', submissionSchema);
