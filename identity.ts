// Visitor identity headers are supplied by the Sites authentication boundary.
export const SESSION_COOKIE='akaras_session';
export const tokenDigest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export type Viewer={id:string;name:string;admin:boolean;preview:boolean;email:string|null;auth_kind:'platform'|'password';has_password:boolean;avatar_url?:string};
export function viewerFor(_req:Request,devPreview=false):Viewer|null {
 // Own Cloudflare deployment: no incoming identity header is trusted.
 if(devPreview)return {id:'local-preview-user',name:'Fejlesztői előnézet',admin:true,preview:true,email:null,auth_kind:'platform',has_password:false};
 return null;
}
export function sessionValue(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1)||null}
export async function resolveViewer(req:Request,db:D1Database,devPreview=false):Promise<Viewer|null>{
 const token=sessionValue(req);
 if(token){if(!/^[a-f0-9]{64}$/.test(token))return null;const row=await db.prepare('SELECT a.user_id,a.email,a.is_admin FROM auth_sessions s JOIN auth_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await tokenDigest(token),new Date().toISOString()).first<{user_id:string;email:string;is_admin:number}>();return row?{id:row.user_id,name:'Játékos',email:row.email,admin:row.is_admin===1,preview:false,auth_kind:'password',has_password:true}:null;}
 const viewer=viewerFor(req,devPreview);if(viewer){viewer.has_password=!!await db.prepare('SELECT id FROM auth_accounts WHERE user_id=?').bind(viewer.id).first();}return viewer;
}
