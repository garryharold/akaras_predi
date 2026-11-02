import { resolveViewer } from './identity.ts';
import { z } from 'zod';
import countryRows from '../db/reference-data.json' with { type: 'json' };
type Env = { DB?: D1Database; BUCKET?: R2Bucket };
const text = z.string().trim().min(1).max(120);
const code = z.string().trim().min(1).max(20).regex(/^[a-zA-Z0-9._-]+$/).transform(v=>v.toUpperCase());
const optionalId = z.string().trim().max(100).nullish().transform(v=>v||null);
const image = z.string().trim().max(2000).nullish().transform(v=>v||null).refine(v=>!v||v.startsWith('/api/catalog/media/')||(/^https:\/\//.test(v)&&!!URL.canParse(v)), 'Use an HTTPS image URL or upload a file.');
const active = z.number().int().min(0).max(1).default(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Invalid date');
const schemas: Record<string,z.ZodTypeAny> = {
 regions:z.object({code,name:text}),
 countries:z.object({code:z.string().regex(/^[A-Z]{2}$/),name:text}),
 roles:z.object({code,name:text,sort_order:z.number().int().min(0).max(100).default(0)}),
 leagues:z.object({name:text,short_name:code,region_id:optionalId,logo_url:image,active}),
 teams:z.object({name:text,short_name:code,region_id:optionalId,league_id:optionalId,logo_url:image,active,aliases:z.array(code).max(30).default([])}),
 players:z.object({ign:text,first_name:z.string().trim().max(120).nullable().optional(),last_name:z.string().trim().max(120).nullable().optional(),birth_date:day.nullable().optional(),residency_region_id:z.string().max(100).nullable().optional(),source_label:z.string().max(120).nullable().optional(),photo_url:image,role_id:optionalId,active,country_ids:z.array(z.string().min(1).max(100)).max(8).default([])})
};
const tables=['countries','regions','roles','leagues','teams','players','team_aliases','player_nationalities','roster_memberships','media'];
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
class Problem extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const uid=()=>crypto.randomUUID();
function mutationAllowed(req:Request){
 const origin=req.headers.get('origin');
 if(origin&&origin!==new URL(req.url).origin)throw new Problem('Cross-origin writes are not permitted.',403);

}
async function getBody(req:Request){if(Number(req.headers.get('content-length')||0)>100000)throw new Problem('Request too large.',413);const raw=await req.text();if(raw.length>100000)throw new Problem('Request too large.',413);return JSON.parse(raw);}
export async function handleCatalog(req:Request,env:Env,options:{devPreview?:boolean}={}):Promise<Response>{
 try {
 if(!env.DB)return json({error:'The shared database is unavailable.'},503);
 const db=env.DB,url=new URL(req.url),segments=url.pathname.replace(/^\/api\/catalog\/?/,'').split('/'),kind=segments[0],id=segments[1];
 if(req.method!=='GET')mutationAllowed(req);
 if(!(kind==='media'&&req.method==='GET'&&id)&&!(await resolveViewer(req,db,options.devPreview))?.admin)throw new Problem('Az adatbázist csak adminisztrátorok érhetik el.',403);
 if(kind==='data'&&req.method==='GET'){
  const results=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM ${t} LIMIT 5001`)));
  if(results.some(r=>r.results.length>5000))throw new Problem('Catalog exceeds this editor’s 5,000 rows per table limit. Use a paginated editor before adding more.',409);
  return json(Object.fromEntries(tables.map((t,i)=>[t,results[i].results])));
 }
 if(kind==='reference'&&req.method==='POST'){
  const defaults=[['NA','North America'],['BR','Brazil'],['LATAM','Latin America'],['EMEA','Europe, Middle East & Africa'],['KR','Korea'],['CN','China'],['APAC','Asia-Pacific'],['OCE','Oceania'],['JP','Japan'],['VN','Vietnam'],['TW','Taiwan']];
  const roles=[['TOP','Top'],['JUNGLE','Jungle'],['MID','Mid'],['ADC','Bot / ADC'],['SUPPORT','Support']];
  const statements=[...defaults.map(([c,n])=>db.prepare('INSERT OR IGNORE INTO regions (id,code,name) VALUES (?,?,?)').bind(c,c,n)),...roles.map(([c,n],i)=>db.prepare('INSERT OR IGNORE INTO roles (id,code,name,sort_order) VALUES (?,?,?,?)').bind(c,c,n,i)),...countryRows.map(c=>db.prepare('INSERT OR IGNORE INTO countries (id,code,name) VALUES (?,?,?)').bind(c.id,c.code,c.name))];
  await db.batch(statements);return json({ok:true});
 }
 if(kind==='resolve'&&req.method==='GET'){
  const q=(url.searchParams.get('q')||'').trim().toUpperCase();
  if(!q||q.length>120)throw new Problem('Enter a team name or abbreviation.');
  const result=await db.prepare('SELECT DISTINCT t.* FROM teams t LEFT JOIN team_aliases a ON a.team_id=t.id WHERE t.active=1 AND (UPPER(t.short_name)=? OR UPPER(t.name)=? OR a.alias=?) LIMIT 2').bind(q,q,q).all();
  if(result.results.length>1)throw new Problem('Multiple teams match this name. Use a unique abbreviation.',409);
  return json({team:result.results[0]||null});
 }
 if(kind==='media'){
  if(req.method==='GET'&&id){
   const m=await db.prepare('SELECT * FROM media WHERE id=?').bind(id).first<{object_key:string;mime_type:string}>();
   if(!m||!env.BUCKET)return json({error:'Image not found'},404);
   const object=await env.BUCKET.get(m.object_key);if(!object)return json({error:'Image not found'},404);
   return new Response(object.body,{headers:{'Content-Type':m.mime_type,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }
  if(req.method==='POST'){
   if(!env.BUCKET)throw new Problem('Image storage is unavailable.',503);
   if(Number(req.headers.get('content-length')||0)>5500000)throw new Problem('Maximum image size is 5 MB.',413);
   const form=await req.formData(),file=form.get('file');
   if(!(file instanceof File)||!file.size||file.size>5*1024*1024)throw new Problem('Choose an image up to 5 MB.');
   const bytes=new Uint8Array(await file.arrayBuffer());let mime='';
   if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)mime='image/png';
   else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
   else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';
   else if(new TextDecoder().decode(bytes.slice(0,6)).startsWith('GIF8'))mime='image/gif';
   if(!mime)throw new Problem('Supported formats: PNG, JPEG, WebP and GIF.');
   const mediaId=uid(),key='catalog/'+mediaId;
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
   try{await db.prepare('INSERT INTO media (id,object_key,mime_type,original_name,byte_size) VALUES (?,?,?,?,?)').bind(mediaId,key,mime,file.name.slice(0,200),bytes.length).run();}catch(e){await env.BUCKET.delete(key);throw e;}
   return json({id:mediaId,url:'/api/catalog/media/'+mediaId},201);
  }
 }
 if(kind==='roster'){
  if(req.method==='POST'){
   const b=z.object({team_id:text,player_id:text,role_id:text,is_starter:z.number().int().min(0).max(1),started_at:day}).parse(await getBody(req));
   const team=await db.prepare('SELECT id FROM teams WHERE id=? AND active=1').bind(b.team_id).first();
   const player=await db.prepare('SELECT id FROM players WHERE id=? AND active=1').bind(b.player_id).first();
   if(!team||!player)throw new Problem('Choose an active team and player.');
   const newId=uid();await db.prepare('INSERT INTO roster_memberships (id,team_id,player_id,role_id,is_starter,started_at) VALUES (?,?,?,?,?,?)').bind(newId,b.team_id,b.player_id,b.role_id,b.is_starter,b.started_at).run();
   return json({id:newId},201);
  }
  if(req.method==='PATCH'&&id){
   const b=z.object({ended_at:day}).parse(await getBody(req));
   const r=await db.prepare('SELECT * FROM roster_memberships WHERE id=?').bind(id).first<{started_at:string;ended_at:string|null}>();
   if(!r)throw new Problem('Roster entry not found.',404);
   if(r.ended_at)throw new Problem('This roster membership has already ended.',409);
   if(b.ended_at<r.started_at)throw new Problem('End date cannot precede the start date.');
   await db.prepare('UPDATE roster_memberships SET ended_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.ended_at,id).run();return json({ok:true});
  }
 }
 if(schemas[kind]&&['POST','PATCH'].includes(req.method)){
  const body=schemas[kind].parse(await getBody(req));
  const recordId=req.method==='PATCH'?id:uid();if(!recordId)throw new Problem('Record ID is missing.');
  if(req.method==='PATCH'&&!await db.prepare(`SELECT id FROM ${kind} WHERE id=?`).bind(recordId).first())throw new Problem('Record not found.',404);
  const {aliases,country_ids,...data}=body;
  if(kind==='teams'&&data.active===0&&await db.prepare('SELECT id FROM roster_memberships WHERE team_id=? AND ended_at IS NULL LIMIT 1').bind(recordId).first())throw new Problem('End this team’s active roster memberships before archiving.',409);
  if(kind==='players'&&data.active===0&&await db.prepare('SELECT id FROM roster_memberships WHERE player_id=? AND ended_at IS NULL LIMIT 1').bind(recordId).first())throw new Problem('End the active roster membership before archiving this player.',409);
  if(kind==='teams'){
   const values=[data.short_name,...aliases];if(new Set(values).size!==values.length)throw new Problem('Team aliases and the main abbreviation must all be different.');
   for(const v of values){const conflict=await db.prepare('SELECT id FROM teams WHERE UPPER(short_name)=? AND id<>? UNION ALL SELECT id FROM team_aliases WHERE alias=? AND team_id<>? LIMIT 1').bind(v,recordId,v,recordId).first();if(conflict)throw new Problem('This abbreviation or alias is already used by another team.',409);}
  }
  const keys=Object.keys(data),values=Object.values(data) as (string|number|null)[];
  const statements:D1PreparedStatement[]=[];
  if(req.method==='PATCH')statements.push(db.prepare(`UPDATE ${kind} SET ${keys.map(k=>k+'=?').join(',')}${['teams','players','leagues','regions'].includes(kind)?',updated_at=CURRENT_TIMESTAMP':''} WHERE id=?`).bind(...values,recordId));
  else statements.push(db.prepare(`INSERT INTO ${kind} (id,${keys.join(',')}) VALUES (?,${keys.map(()=>'?').join(',')})`).bind(recordId,...values));
  if(kind==='teams'){
   statements.push(db.prepare('DELETE FROM team_aliases WHERE team_id=?').bind(recordId));
   for(const alias of [data.short_name,...aliases])statements.push(db.prepare('INSERT INTO team_aliases (id,team_id,alias) VALUES (?,?,?)').bind(uid(),recordId,alias));
  }
  if(kind==='players'){
   statements.push(db.prepare('DELETE FROM player_nationalities WHERE player_id=?').bind(recordId));
   for(const c of [...new Set(country_ids)])statements.push(db.prepare('INSERT INTO player_nationalities (id,player_id,country_id) VALUES (?,?,?)').bind(uid(),recordId,c));
  }
  await db.batch(statements);return json({id:recordId},req.method==='POST'?201:200);
 }
 return json({error:'Endpoint not found.'},404);
 }catch(e){
  if(e instanceof z.ZodError)return json({error:e.issues.map(i=>(i.path.join('.')||'Input')+': '+i.message).join('; ')},400);
  if(e instanceof Problem)return json({error:e.message},e.status);
  if(e instanceof SyntaxError)return json({error:'Invalid JSON.'},400);
  const message=e instanceof Error?e.message:String(e);
  if(/UNIQUE constraint failed.*roster_memberships.player_id/i.test(message))return json({error:'This player already has an active team. End the old membership before transferring.'},409);
  if(/UNIQUE constraint failed.*roster_memberships.team_id/i.test(message))return json({error:'A starter already occupies this role. Add as substitute or end the old membership.'},409);
  if(/UNIQUE constraint/i.test(message))return json({error:'This code, abbreviation or alias already exists.'},409);
  if(/FOREIGN KEY/i.test(message))return json({error:'A linked region, league, nationality or role does not exist. Refresh and try again.'},400);
  console.error('Catalog request failed:',message);return json({error:'The database could not complete this request. Please retry.'},500);
 }
}
