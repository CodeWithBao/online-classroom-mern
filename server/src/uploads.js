import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { config } from './config.js';
import { fail } from './lib.js';
export const uploadRoot = path.resolve(process.env.UPLOAD_DIR || fileURLToPath(new URL('../.data/uploads/',import.meta.url)));
export const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:config.maxFileSize,files:1,fields:10,fieldSize:110000}}).single('file');
export async function storeFile(file, pdfOnly=false) {
 if(!file) return undefined;
 const ext=path.extname(file.originalname).toLowerCase();
 let mime;
 if(ext==='.pdf' && file.buffer.subarray(0,5).toString()==='%PDF-' && file.buffer.subarray(-2048).includes(Buffer.from('%%EOF'))) mime='application/pdf';
 else if(!pdfOnly && ext==='.txt' && !file.buffer.includes(0)) { try { new TextDecoder('utf-8',{fatal:true}).decode(file.buffer); mime='text/plain'; } catch {} }
 else if(!pdfOnly && ext==='.docx') { try { const zip=new AdmZip(file.buffer); const entries=zip.getEntries(); if(entries.length<5000 && entries.reduce((n,e)=>n+e.header.size,0)<50*1024*1024 && zip.getEntry('[Content_Types].xml') && zip.getEntry('word/document.xml')) mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'; } catch {} }
 if(!mime) fail(400,pdfOnly?'A valid PDF file is required':'Only valid PDF, UTF-8 TXT and DOCX files are allowed');
 await mkdir(uploadRoot,{recursive:true}); const filename=randomUUID()+ext; await writeFile(path.join(uploadRoot,filename),file.buffer,{flag:'wx'});
 return {filename,originalName:path.basename(file.originalname).replace(/[\r\n]/g,''),mimeType:mime,size:file.size};
}
export async function removeFile(file) { if(file?.filename) await unlink(path.join(uploadRoot,path.basename(file.filename))).catch(e=>{if(e.code!=='ENOENT') throw e;}); }
export function publicFile(doc,kind) { const data=doc.toJSON(); if(doc.file) { data.file={originalName:doc.file.originalName,mimeType:doc.file.mimeType,size:doc.file.size}; data.fileUrl=`/api/${kind}/${doc._id}/file`; } return data; }
export function download(res,file) { if(!file) fail(404,'No file attached'); res.set('X-Content-Type-Options','nosniff'); res.type(file.mimeType); return res.download(path.join(uploadRoot,path.basename(file.filename)),file.originalName); }
