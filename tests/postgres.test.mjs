import assert from 'node:assert/strict';
import {fixture} from './pg-fixture.mjs';
import {postgresSql} from '../server/postgres.mjs';
import {migrate,bootstrapAdmin} from '../server/setup.mjs';
assert.equal(postgresSql("SELECT '?' AS literal, ? AS value"),"SELECT '?' AS literal, $1 AS value");
const {pg,pool,DB}=await fixture();
try{
 await migrate(pool); // Restart does not reapply the schema or destroy data.
 await bootstrapAdmin(DB,'owner@example.test','A new test password!');
 await bootstrapAdmin(DB,'owner@example.test','Ignored different password!');
 const a=await DB.prepare('SELECT * FROM auth_accounts WHERE email=?').bind('owner@example.test').first();
 assert.equal(a.is_admin,1);assert.notEqual(a.password_hash,'A new test password!');
 await DB.prepare('INSERT OR IGNORE INTO regions(id,code,name) VALUES (?,?,?)').bind('KR','KR','Korea').run();
 const ignored=await DB.prepare('INSERT OR IGNORE INTO regions(id,code,name) VALUES (?,?,?)').bind('KR','KR','Korea').run();assert.equal(ignored.meta.changes,0);
 await assert.rejects(DB.batch([DB.prepare('INSERT INTO regions(id,code,name) VALUES (?,?,?)').bind('CN','CN','China'),DB.prepare('INSERT INTO regions(id,code,name) VALUES (?,?,?)').bind('KR','KR','Duplicate')]));
 assert.equal(await DB.prepare('SELECT * FROM regions WHERE id=?').bind('CN').first(),null);
 await DB.prepare('INSERT INTO auth_attempts(key,attempts,window_start) VALUES (?,?,?)').bind('time',1,Date.now()).run();
 await DB.prepare('UPDATE prediction_users SET updated_at=CURRENT_TIMESTAMP').run();
 assert.match((await DB.prepare('SELECT updated_at FROM prediction_users').first()).updated_at,/T.*Z$/);
 await DB.prepare('UPDATE auth_accounts SET is_admin=0 WHERE id=?').bind(a.id).run();
 await assert.rejects(bootstrapAdmin(DB,'owner@example.test','A new test password!'),/automatic promotion is blocked/);
 console.log('PASS: real PostgreSQL schema, safe parameters, rollback, ignore conflicts, bigint timestamps, idempotent migration and admin bootstrap.');
}finally{await pg.close();}
