import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import router from './routes/index.js';
export const app=express();
app.disable('x-powered-by'); app.use(helmet());
app.use(cors({origin:process.env.CLIENT_ORIGIN || 'http://localhost:5173'}));
app.use('/api',rateLimit({windowMs:15*60*1000,limit:1000,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many requests'}}));
app.use(express.json({limit:'1mb'})); app.use('/api',router);
app.use('/api',(req,res)=>res.status(404).json({message:'API route not found'}));
const dist=fileURLToPath(new URL('../../client/dist/',import.meta.url));
if(existsSync(path.join(dist,'index.html'))) { app.use(express.static(dist)); app.get('/{*path}',(req,res)=>res.sendFile(path.join(dist,'index.html'))); }
app.use((req,res)=>res.status(404).json({message:'Not found'}));
app.use((err,req,res,next)=>{
 if(res.headersSent) return next(err);
 let status=err.status || 500, message=err.message;
 if(err.code===11000) {status=409;message='Already exists';}
 if(['ValidationError','CastError','StrictModeError'].includes(err.name)) {status=400;message='Invalid request data';}
 if(err.name==='MulterError') {status=err.code==='LIMIT_FILE_SIZE'?413:400;message=err.code==='LIMIT_FILE_SIZE'?'File exceeds 10 MB limit':'Invalid multipart upload';}
 if(status>=500) { console.error(err); message='Internal server error'; }
 res.status(status).json({message});
});
export default app;
