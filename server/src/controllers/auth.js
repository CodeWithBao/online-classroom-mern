import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { config } from '../config.js';
import { fail, text, send, get, pick } from '../lib.js';
const email = value => { const result = text(value, 'email', 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'Invalid email'); return result; };
const session = user => ({ token: jwt.sign({ id: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' }), user });
export async function register(req, res) {
 const name = text(req.body.name, 'name', 100), address = email(req.body.email), password = req.body.password;
 if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || !password.trim()) fail(400, 'Password must be 8–72 bytes');
 const user = await User.create({ name, email: address, password: await bcrypt.hash(password, 12), role: 'student' }); send(res, session(user), 201);
}
export async function login(req, res) {
 const address = email(req.body.email); if (typeof req.body.password !== 'string') fail(400, 'Password required');
 const user = await User.findOne({ email: address }).select('+password');
 if (!user || !await bcrypt.compare(req.body.password, user.password)) fail(401, 'Invalid credentials');
 if (user.isBlocked) fail(403, 'User is blocked'); send(res, session(user));
}
export const me = (req,res) => send(res, req.user);
export const users = async (req,res) => send(res, await User.find().sort({createdAt:-1}));
export async function updateUser(req,res) {
 const user = await get(User, req.params.id), update = pick(req.body, ['role','isBlocked']);
 if ('role' in update && !['student','teacher','admin'].includes(update.role)) fail(400,'Invalid role');
 if ('isBlocked' in update && typeof update.isBlocked !== 'boolean') fail(400,'Invalid blocked flag');
 if (String(user._id) === String(req.user._id) && (update.isBlocked === true || (update.role && update.role !== 'admin'))) fail(400,'Cannot block or demote yourself');
 Object.assign(user,update); await user.save(); send(res,user);
}
