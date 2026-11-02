import {z} from 'zod';
import {ensureProfile,DEFAULT_AVATAR} from './profile-store.ts';
type Env={DB?:D1Database;BUCKET?:R2Bucket};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function saveProfile(req:Request,env:Env,userId:string){
 const db=env.DB!;if(Number(req.headers.get('content-length')||0)>2300000)return json({error:'A profilkép legfeljebb 2 MB lehet.'},413);
 let file:File|null=null,raw:unknown;
 if(req.headers.get('content-type')?.includes('multipart/form-data')){const form=await req.formData();const entry=form.get('avatar');file=entry instanceof File&&entry.size?entry:null;raw={display_name:form.get('display_name'),reset_avatar:form.get('reset_avatar')==='true'};}
 else {const value=await req.text();if(value.length>10000)return json({error:'Túl nagy kérés.'},413);raw=JSON.parse(value)}
 const b=z.object({display_name:z.string().trim().min(2,'A név legalább 2 karakter.').max(40,'A név legfeljebb 40 karakter.'),reset_avatar:z.boolean().default(false)}).strict().parse(raw);
 const profile=await ensureProfile(db,userId);let avatar=b.reset_avatar?null:profile.avatar_url,newKey:string|null=null;const statements:D1PreparedStatement[]=[];
 if(file){
 if(file.size>2*1024*1024)return json({error:'A profilkép legfeljebb 2 MB lehet.'},413);if(!env.BUCKET)return json({error:'A képtároló nem érhető el.'},503);
 const bytes=new Uint8Array(await file.arrayBuffer());let mime='';const read=new TextDecoder();
 if(bytes.length>=24&&bytes[0]===137&&read.decode(bytes.slice(1,4))==='PNG'&&read.decode(bytes.slice(12,16))==='IHDR'){mime='image/png';const view=new DataView(bytes.buffer);if(view.getUint32(16)>4096||view.getUint32(20)>4096)return json({error:'A kép legfeljebb 4096 × 4096 pixeles lehet.'},400);}
 else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217)mime='image/jpeg';
 else if(bytes.length>=20&&read.decode(bytes.slice(0,4))==='RIFF'&&read.decode(bytes.slice(8,12))==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(read.decode(bytes.slice(12,16))))mime='image/webp';
 if(!mime)return json({error:'PNG, JPEG vagy WebP képet tölts fel.'},400);
 const imageId=crypto.randomUUID();newKey='profiles/'+userId+'/'+imageId;await env.BUCKET.put(newKey,bytes,{httpMetadata:{contentType:mime}});avatar='/api/game/profile-image/'+imageId;
 statements.push(db.prepare('INSERT INTO profile_images (id,user_id,object_key,mime_type) VALUES (?,?,?,?)').bind(imageId,userId,newKey,mime));
 }
 statements.push(db.prepare('UPDATE prediction_users SET display_name=?,avatar_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.display_name,avatar,userId));
 try{await db.batch(statements)}catch(e){if(newKey)await env.BUCKET!.delete(newKey);throw e;}
 return json({ok:true,profile:{display_name:b.display_name,avatar_url:avatar||DEFAULT_AVATAR}});
}
export async function readProfileImage(id:string,env:Env){
 if(!env.DB||!env.BUCKET)return json({error:'A kép nem érhető el.'},404);
 const row=await env.DB.prepare('SELECT object_key,mime_type FROM profile_images WHERE id=?').bind(id).first<{object_key:string;mime_type:string}>();if(!row)return json({error:'Nincs ilyen kép.'},404);
 const object=await env.BUCKET.get(row.object_key);if(!object)return json({error:'Nincs ilyen kép.'},404);
 return new Response(object.body,{headers:{'Content-Type':row.mime_type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
