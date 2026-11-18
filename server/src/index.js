import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';
if(!config.jwtSecret || config.jwtSecret.length<32) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in server/.env');
await mongoose.connect(config.mongoUri);
const server=app.listen(config.port,()=>console.log(`Classroom API listening on http://localhost:${config.port}`));
async function close() { server.close(async()=>{await mongoose.disconnect();process.exit(0);}); }
process.on('SIGINT',close);process.on('SIGTERM',close);
