import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
const dbPath=fileURLToPath(new URL('../.data/mongodb/',import.meta.url)); await mkdir(dbPath,{recursive:true});
const mongo=await MongoMemoryServer.create({instance:{dbPath,storageEngine:'wiredTiger',dbName:'classroom'}});
const {config}=await import('./config.js'); const {default:app}=await import('./app.js'); const {seed}=await import('./seed.js');
await mongoose.connect(mongo.getUri(),{dbName:'classroom'}); await seed();
const server=app.listen(config.port,()=>console.log(`Demo ready: http://localhost:${config.port}\nadmin@classroom.local / teacher@classroom.local / student@classroom.local\nPassword: Classroom@123`));
let stopping=false; async function close() { if(stopping)return; stopping=true; server.close(async()=>{await mongoose.disconnect();await mongo.stop({doCleanup:false,force:false});process.exit(0);}); }
process.on('SIGINT',close);process.on('SIGTERM',close);
