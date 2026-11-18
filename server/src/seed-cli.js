import mongoose from 'mongoose';
import { config } from './config.js';
import { seed } from './seed.js';
try { await mongoose.connect(config.mongoUri); await seed(); console.log('Demo seed added without deleting or resetting existing data.'); } finally { await mongoose.disconnect(); }
