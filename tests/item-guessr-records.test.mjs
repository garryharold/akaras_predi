import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase} from '../server/postgres.mjs';
import {migrate} from '../server/setup.mjs';
import {handleArcadeRecords} from '../server/arcade-records.mjs';
import {tokenDigest} from '../lib/identity.ts';
const pg=new PGlite();
const pool={connect:async()=>({query:(sql,v)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):sql.startsWith('-- Akarás')?pg.exec(sql).then(()=>({rows:[]})):pg.query(sql,v),release(){}})};
try{
 await migrate(pool);await migrate(pool);
 const db=new PostgresDatabase(pool);
 for(const [id,name] of [['a','Első'],['b','Második']]){
  await db.prepare('INSERT INTO prediction_users(id,display_name) VALUES (?,?)').bind(id,name).run();
  await db.prepare("INSERT INTO auth_accounts(id,user_id,email,password_hash,password_salt,password_iterations,is_admin) VALUES (?,?,?,?,?,100000,0)").bind(id,id,id+'@example.test','hash','salt').run();
  await db.prepare('INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES (?,?,?)').bind(await tokenDigest(id.repeat(64)),id,'2099-01-01T00:00:00.000Z').run();
 }
 async function call(body,who='a',origin='https://test.example'){
  const headers={origin};if(who)headers.cookie='akaras_session='+who.repeat(64);
  const response=await handleArcadeRecords(new Request('https://test.example/api/arcade/records',{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})}),{DB:db});
  return {status:response.status,data:await response.json()};
 }
 assert.equal((await call({difficulty:'bronze',score:100},null)).status,401);
 assert.equal((await call({difficulty:'bronze',score:100},'a','https://other.example')).status,403);
 for(const score of [-100,23,0,1.5])assert.equal((await call({difficulty:'bronze',score})).status,400);
 await call({difficulty:'bronze',score:500});
 await call({difficulty:'bronze',score:400},'b');await call({difficulty:'bronze',score:500},'b');
 assert.equal((await call(null,null)).data.records[0].player_name,'Első');
 await call({difficulty:'bronze',score:600},'b');await call({difficulty:'emerald',score:200});
 await db.prepare('UPDATE prediction_users SET display_name=? WHERE id=?').bind('Új név','b').run();
 const result=(await call(null,null)).data;
 assert.equal(result.records.find(r=>r.difficulty==='bronze').score,600);
 assert.equal(result.records.find(r=>r.difficulty==='bronze').player_name,'Új név');
 assert.equal(result.records.find(r=>r.difficulty==='emerald').score,200);
 console.log('PASS: migration/redeploy, authentication, origins, validation, ties, lower scores, new records, difficulty separation, profile rename.');
}finally{await pg.close()}
