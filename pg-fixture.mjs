import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/setup.mjs';
import {PostgresDatabase} from '../server/postgres.mjs';
export async function fixture(){
 const pg=new PGlite();
 const client={async query(sql,params=[]){
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]}; // Single in-memory session has no competing migration.
  if(sql.startsWith('-- Akarás')){await pg.exec(sql);return {rows:[]};}
  try{const r=await pg.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};}catch(e){if(!['23505','23503','23514','23502'].includes(e.code))console.error('PostgreSQL test query:',e.message,sql);throw e;}
 },release(){}};
 const pool={async connect(){return client}};
 await migrate(pool);return {pg,pool,DB:new PostgresDatabase(pool)};
}
