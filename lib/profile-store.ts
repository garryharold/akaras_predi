export const DEFAULT_AVATAR='/assets/default-avatar.svg';
export const generatedPlayerName=()=>'Játékos-'+crypto.randomUUID().slice(0,8).toUpperCase();
export async function ensureProfile(db:D1Database,userId:string){
 const existing=await db.prepare('SELECT id,display_name,avatar_url FROM prediction_users WHERE id=?').bind(userId).first<{id:string;display_name:string;avatar_url:string|null}>();if(existing)return existing;
 const generated=generatedPlayerName();
 await db.prepare('INSERT INTO prediction_users (id,display_name) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(userId,generated).run();
 return (await db.prepare('SELECT id,display_name,avatar_url FROM prediction_users WHERE id=?').bind(userId).first<{id:string;display_name:string;avatar_url:string|null}>())!;
}
