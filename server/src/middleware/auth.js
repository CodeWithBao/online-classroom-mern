import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/index.js';
export async function auth(req,res,next) {
 const header=req.get('authorization')||'';
 if(!header.startsWith('Bearer ')) return res.status(401).json({message:'Authentication required'});
 let payload;
 try { payload=jwt.verify(header.slice(7),config.jwtSecret,{algorithms:['HS256']}); if(!mongoose.isObjectIdOrHexString(payload.id)) throw new Error('Invalid subject'); }
 catch { return res.status(401).json({message:'Invalid or expired token'}); }
 try { const user=await User.findById(payload.id); if(!user) return res.status(401).json({message:'User not found'}); if(user.isBlocked) return res.status(403).json({message:'User is blocked'}); req.user=user; next(); }
 catch(error) { next(error); }
}
export const requireRole = (...roles)=>(req,res,next)=> roles.includes(req.user?.role)?next():res.status(403).json({message:'Forbidden'});
