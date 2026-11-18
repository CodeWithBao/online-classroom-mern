import React, {createContext,useContext,useState,useEffect,useCallback,useMemo} from 'react';
import {Link} from 'react-router-dom';
import {BookOpen,ArrowUpRight,AlertCircle,LoaderCircle,Inbox,Download} from 'lucide-react';

const KEY='classroom_token';
export async function api(path,options={}) {
 const token=localStorage.getItem(KEY); const headers={...(token?{Authorization:`Bearer ${token}`}:{ }),...options.headers};
 if(options.body && !(options.body instanceof FormData)){headers['Content-Type']='application/json';options={...options,body:JSON.stringify(options.body)};}
 let response; try{response=await fetch(`/api${path}`,{...options,headers});}catch{throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');}
 const result=await response.json().catch(()=>({}));
 if(!response.ok){if(response.status===401 && token){localStorage.removeItem(KEY);window.dispatchEvent(new Event('auth-expired'));}throw new Error(result.message||`Yêu cầu thất bại (${response.status}).`);}
 return result.data;
}
export async function download(path,name){const response=await fetch(`/api${path}`,{headers:{Authorization:`Bearer ${localStorage.getItem(KEY)}`}});if(!response.ok){const e=await response.json().catch(()=>({}));throw new Error(e.message||'Không thể tải tệp.');}const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name||'tai-lieu';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const AuthContext=createContext(null);
export function AuthProvider({children}){const[user,setUser]=useState(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 const restore=useCallback(async()=>{setLoading(true);setError('');if(!localStorage.getItem(KEY)){setLoading(false);return;}try{setUser(await api('/auth/me'));}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{restore();const expired=()=>setUser(null);window.addEventListener('auth-expired',expired);return()=>window.removeEventListener('auth-expired',expired);},[restore]);
 const authenticate=useCallback(async(mode,body)=>{const data=await api(`/auth/${mode}`,{method:'POST',body});localStorage.setItem(KEY,data.token);setUser(data.user);setError('');},[]);
 const logout=useCallback(()=>{localStorage.removeItem(KEY);setUser(null);setError('');},[]);
 const value=useMemo(()=>({user,loading,error,authenticate,logout,restore}),[user,loading,error,authenticate,logout,restore]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
export function useResource(path){const[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[version,setVersion]=useState(0);const reload=useCallback(()=>setVersion(v=>v+1),[]);useEffect(()=>{let alive=true;setLoading(true);setError('');api(path).then(d=>{if(alive)setData(d);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[path,version]);return{data,loading,error,reload};}
export const idOf=v=>typeof v==='object'?v?._id:v;
export const roleName={student:'Học viên',teacher:'Giảng viên',admin:'Quản trị viên'};
export const dateTime=v=>v?new Date(v).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Không có hạn nộp';
export function ErrorBox({message}){return message?<div role="alert" className="error"><AlertCircle size={19} aria-hidden="true"/>{message}</div>:null;}
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin" size={23} aria-hidden="true"/> Đang tải dữ liệu…</div>;}
export function Empty({title='Chưa có dữ liệu',text='Nội dung sẽ xuất hiện tại đây khi được cập nhật.',children}){return <div className="empty"><span className="empty-icon"><Inbox size={30} aria-hidden="true"/></span><h3>{title}</h3><p>{text}</p>{children}</div>;}
export function Resource({resource,children}){if(resource.loading)return <Loading/>;if(resource.error)return <><ErrorBox message={resource.error}/><button className="button secondary" onClick={resource.reload}>Thử lại</button></>;return children(resource.data);}
export function Heading({eyebrow,title,text,children}){return <header className="page-heading"><div><p className="eyebrow">{eyebrow||'KHÔNG GIAN HỌC TẬP'}</p><h1>{title}</h1>{text&&<p className="muted">{text}</p>}</div>{children}</header>;}
export function Field({label,children,hint}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Badge({status}){const labels={draft:'Bản nháp',published:'Đang mở',closed:'Đã đóng',text:'Bài đọc',video:'Video',pdf:'Tài liệu PDF'};return <span className={`badge ${status}`}>{labels[status]||status}</span>;}
export function Progress({value=0}){const percent=Math.max(0,Math.min(100,Number(value)||0));return <div className="progress-wrap"><div className="progress-label"><span>Tiến độ học tập</span><strong>{Math.round(percent)}%</strong></div><progress max="100" value={percent}>{percent}%</progress></div>;}
export function CourseCard({course,index=0,enrollment}){return <article className="course-card"><Link className={`course-art art-${index%4}`} to={`/courses/${course._id}`} tabIndex={-1} aria-hidden="true"><span className="art-grid"/><BookOpen size={54} strokeWidth={1.3}/><span className="art-caption">CLASSROOM / {String(index+1).padStart(2,'0')}</span><span className="art-circle"/></Link><div className="course-body"><div className="row between"><span className="category">{course.category?.name||'Kiến thức chung'}</span><Badge status={course.status}/></div><h3><Link to={`/courses/${course._id}`}>{course.title}</Link></h3><p className="clamp muted">{course.description}</p><div className="course-meta"><span>{course.teacher?.name||'Lớp học trực tuyến'}</span><span>{course.level}</span></div>{enrollment&&<Progress value={enrollment.progress ?? (course.lessonCount?((enrollment.completedLessons?.length||0)/course.lessonCount)*100:0)}/>}<Link className="card-link" to={`/courses/${course._id}`}>{enrollment?'Tiếp tục học':'Xem khóa học'}<ArrowUpRight size={18} aria-hidden="true"/></Link></div></article>;}
export function DownloadButton({path,name}){const[busy,setBusy]=useState(false),[error,setError]=useState('');return <><button className="button secondary small" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await download(path,name);}catch(e){setError(e.message);}finally{setBusy(false);}}}><Download size={16} aria-hidden="true"/>{busy?'Đang tải…':'Tải tệp đính kèm'}</button><ErrorBox message={error}/></>;}
export function ActionForm({onSubmit,children,submit='Lưu thay đổi',onCancel}){const[busy,setBusy]=useState(false),[error,setError]=useState('');return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;setBusy(true);setError('');try{await onSubmit(new FormData(form),form);}catch(err){setError(err.message);}finally{setBusy(false);}}}><fieldset disabled={busy}>{children}</fieldset><ErrorBox message={error}/><div className="row"><button className="button" disabled={busy}>{busy?'Đang xử lý…':submit}</button>{onCancel&&<button className="button secondary" type="button" onClick={onCancel}>Hủy</button>}</div></form>;}
export function SafeVideo({url}){let safe=false;try{const u=new URL(url);safe=['https:','http:'].includes(u.protocol);}catch{}return safe?<a className="button secondary" href={url} target="_blank" rel="noopener noreferrer">Mở video trong thẻ mới <ArrowUpRight size={17} aria-hidden="true"/></a>:<ErrorBox message="Liên kết video không hợp lệ."/>;}
