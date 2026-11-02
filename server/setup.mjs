import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {passwordHash} from '../lib/account-auth.ts';
export async function migrate(pool){
 const sql=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
 const checksum=createHash('sha256').update(sql).digest('hex');const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(74192631)');
  await client.query('CREATE SCHEMA IF NOT EXISTS akaras');await client.query('SET LOCAL search_path TO akaras, pg_catalog');
  await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL)');
  const previous=(await client.query('SELECT checksum FROM app_migrations WHERE name=$1',['001-initial'])).rows[0];
  if(previous&&previous.checksum!==checksum)throw Error('Schema checksum changed; an explicit migration is required.');
  if(!previous){await client.query(sql);await client.query('INSERT INTO app_migrations(name,checksum) VALUES ($1,$2)',['001-initial',checksum]);}
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}
export async function bootstrapAdmin(db,email,password){
 if(!email||!password)throw Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for initial setup.');
 email=email.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)throw Error('Use a valid admin email and a 12–128 character password.');
 const existing=await db.prepare('SELECT id,is_admin FROM auth_accounts WHERE email=?').bind(email).first();
 if(existing){if(existing.is_admin!==1)throw Error('An ordinary account already uses ADMIN_EMAIL. Grant admin explicitly in the database; automatic promotion is blocked.');return;}
 const userId=crypto.randomUUID(),salt=randomBytes(32).toString('hex'),hash=await passwordHash(password,salt);
 await db.batch([
  db.prepare('INSERT INTO prediction_users(id,display_name) VALUES (?,?)').bind(userId,'Admin'),
  db.prepare('INSERT INTO auth_accounts(id,user_id,email,password_hash,password_salt,password_iterations,is_admin) VALUES (?,?,?,?,?,100000,1)').bind(crypto.randomUUID(),userId,email,hash,salt)
 ]);
}
