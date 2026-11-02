import {z} from 'zod';
import {resolveViewer,viewerFor,SESSION_COOKIE,sessionValue,tokenDigest} from './identity.ts';
import {ensureProfile,generatedPlayerName} from './profile-store.ts';
type Env={DB?:D1Database};type Account={id:string;user_id:string;email:string;password_hash:string;password_salt:string;password_iterations:number;is_admin:number};
const password=z.string().min(12,'Legalább 12 karakteres jelszót adj meg.').max(128,'A jelszó legfeljebb 128 karakter lehet.');
const credentials=z.object({email:z.string().trim().toLowerCase().email('Érvényes e-mail-címet adj meg.').max(254),password});
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const randomHex=(bytes=32)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const hexBytes=(value:string)=>new Uint8Array(value.match(/../g)!.map(x=>parseInt(x,16)));
export async function passwordHash(secret:string,salt:string,iterations=100000){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:hexBytes(salt),iterations},key,256)),b=>b.toString(16).padStart(2,'0')).join('');}
async function matchesPassword(secret:string,a:Account){const actual=await passwordHash(secret,a.password_salt,a.password_iterations);let diff=actual.length^a.password_hash.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^(a.password_hash.charCodeAt(i)||0);return diff===0}
function cookie(req:Request,value:string,dev:boolean,max=14*86400){return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}${dev&&new URL(req.url).protocol==='http:'?'':'; Secure'}`}
async function newSession(db:D1Database,accountId:string){const token=randomHex();await db.prepare('INSERT INTO auth_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').bind(await tokenDigest(token),accountId,new Date(Date.now()+14*86400000).toISOString()).run();return token}
async function limit(db:D1Database,key:string,max=10){const now=Date.now(),window=15*60000;await db.prepare('INSERT INTO auth_attempts (key,attempts,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_attempts.window_start<? THEN 1 ELSE auth_attempts.attempts+1 END,window_start=CASE WHEN auth_attempts.window_start<? THEN excluded.window_start ELSE auth_attempts.window_start END').bind(key,now,now-window,now-window).run();const row=await db.prepare('SELECT attempts FROM auth_attempts WHERE key=?').bind(key).first<{attempts:number}>();return row!.attempts<=max;}
export async function handleAuth(req:Request,env:Env,options:{devPreview?:boolean}={}){try{
 if(!env.DB)return json({error:'A fiókadatbázis nem elérhető.'},503);const db=env.DB,url=new URL(req.url),action=url.pathname.split('/').pop();
 if(action==='platform'&&req.method==='GET')return json({error:'Ezen a tárhelyen e-maillel és jelszóval lehet belépni.'},410);
 if(req.method!=='POST')return json({error:'Nincs ilyen művelet.'},405);
 const origin=req.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Másik oldalról indított belépés nem engedélyezett.'},403);
 const fetchSite=req.headers.get('sec-fetch-site');if(fetchSite==='cross-site')return json({error:'Másik oldalról indított belépés nem engedélyezett.'},403);
 if(action==='logout'){const token=sessionValue(req);if(token&&/^[a-f0-9]{64}$/.test(token))await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await tokenDigest(token)).run();return json({ok:true},200,{'Set-Cookie':cookie(req,'off',!!options.devPreview)});}
 if(Number(req.headers.get('content-length')||0)>10000)return json({error:'Túl nagy kérés.'},413);const raw=await req.text();if(raw.length>10000)return json({error:'Túl nagy kérés.'},413);const input=JSON.parse(raw);
 if(action==='register'||action==='login'){
 const b=(action==='register'?credentials:z.object({email:z.string().trim().toLowerCase().email('Érvényes e-mail-címet adj meg.').max(254),password:z.string().min(1).max(128)})).parse(input);
 const key=action+':'+await tokenDigest(b.email);if(!await limit(db,key))return json({error:'Túl sok próbálkozás. Próbáld újra 15 perc múlva.'},429);
 // Limit registration by network too; do not retain raw visitor IP addresses.
 if(action==='register'){const ip=req.headers.get('cf-connecting-ip');if(ip&&!await limit(db,'register-ip:'+await tokenDigest(ip),20))return json({error:'Túl sok regisztráció. Próbáld újra később.'},429);}
 const existing=await db.prepare('SELECT * FROM auth_accounts WHERE email=?').bind(b.email).first<Account>();
 if(action==='login'){
 const candidate=existing||{password_salt:'0'.repeat(32),password_hash:'0'.repeat(64),password_iterations:100000}as Account;
 const valid=await matchesPassword(b.password,candidate);if(!existing||!valid)return json({error:'Hibás e-mail-cím vagy jelszó.'},401);
 await db.prepare('DELETE FROM auth_attempts WHERE key=?').bind(key).run();return json({ok:true},200,{'Set-Cookie':cookie(req,await newSession(db,existing.id),!!options.devPreview)});
 }
 if(existing)return json({error:'Ezzel az e-mail-címmel már van fiók. Jelentkezz be.'},409);
 const platform=viewerFor(req,false),verifiedPlatform=platform?.email?.toLowerCase()===b.email?platform:null;
 // All new accounts are ordinary users. Admin is granted only from the database.
 const userId=verifiedPlatform?.id||crypto.randomUUID(),accountId=crypto.randomUUID(),salt=randomHex(16),hash=await passwordHash(b.password,salt);
 const prior=await db.prepare('SELECT id FROM auth_accounts WHERE user_id=?').bind(userId).first();if(prior)return json({error:'Ehhez a profilhoz már tartozik e-mailes belépés.'},409);
 await db.batch([db.prepare('INSERT INTO prediction_users (id,display_name) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(userId,generatedPlayerName()),db.prepare('INSERT INTO auth_accounts (id,user_id,email,password_hash,password_salt,password_iterations,is_admin) VALUES (?,?,?,?,?,100000,?)').bind(accountId,userId,b.email,hash,salt,verifiedPlatform?.admin?1:0)]);
 return json({ok:true},201,{'Set-Cookie':cookie(req,await newSession(db,accountId),!!options.devPreview)});
 }
 if(action==='password'){
 const viewer=await resolveViewer(req,db,options.devPreview);if(!viewer)return json({error:'Jelentkezz be.'},401);
 const b=z.object({current_password:z.string().max(128).optional(),new_password:password}).parse(input);
 const key='password:'+await tokenDigest(viewer.id);if(!await limit(db,key))return json({error:'Túl sok próbálkozás. Próbáld újra 15 perc múlva.'},429);
 const account=await db.prepare('SELECT * FROM auth_accounts WHERE user_id=?').bind(viewer.id).first<Account>();const salt=randomHex(16),hash=await passwordHash(b.new_password,salt);let accountId=account?.id;
 if(account){if(!b.current_password||!await matchesPassword(b.current_password,account))return json({error:'A jelenlegi jelszó nem helyes.'},400);
 await db.batch([db.prepare('UPDATE auth_accounts SET password_hash=?,password_salt=?,password_iterations=100000,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(hash,salt,account.id),db.prepare('DELETE FROM auth_sessions WHERE account_id=?').bind(account.id)]);
 }else{
 const platform=viewerFor(req,false);if(!platform?.email||platform.id!==viewer.id)return json({error:'Az e-mailes belépés bekapcsolásához igazolt e-mail-cím szükséges.'},400);
 await ensureProfile(db,viewer.id);accountId=crypto.randomUUID();await db.prepare('INSERT INTO auth_accounts (id,user_id,email,password_hash,password_salt,password_iterations,is_admin) VALUES (?,?,?,?,?,100000,?)').bind(accountId,viewer.id,platform.email.toLowerCase(),hash,salt,platform.admin?1:0).run();
 }
 await db.prepare('DELETE FROM auth_attempts WHERE key=?').bind(key).run();return json({ok:true},200,{'Set-Cookie':cookie(req,await newSession(db,accountId!),!!options.devPreview)});
 }
 return json({error:'Nincs ilyen művelet.'},404);
 }catch(e){if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.message).join(' ')},400);if(e instanceof SyntaxError)return json({error:'Érvénytelen kérés.'},400);if(/UNIQUE constraint/.test(String(e)))return json({error:'Ez a fiók már létezik. Jelentkezz be.'},409);console.error('Account operation failed');return json({error:'A fiókművelet nem sikerült. Próbáld újra.'},500);}}
