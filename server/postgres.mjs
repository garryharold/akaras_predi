// Compatibility for the application's existing prepared-query interface.
// Parameters remain bound values; they are never interpolated into SQL.
export const utcNowSql=`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
export function postgresSql(input){
 let n=0;
 let sql=input.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\?|\bCURRENT_TIMESTAMP\b/g,token=>{
  if(token==='?')return '$'+(++n);
  if(token==='CURRENT_TIMESTAMP')return utcNowSql;
  if(token.startsWith('`'))return '"'+token.slice(1,-1)+'"';
  return token;
 });
 if(/^\s*INSERT OR IGNORE\b/i.test(sql))sql=sql.replace(/INSERT OR IGNORE/i,'INSERT').replace(/;?\s*$/,' ON CONFLICT DO NOTHING');
 return sql;
}
export class PostgresDatabase{
 constructor(pool){this.pool=pool;}
 prepare(sql){return new Statement(this,sql);}
 async query(sql,values=[]){const client=await this.pool.connect();try{await client.query('SET search_path TO akaras, pg_catalog');return await client.query(postgresSql(sql),values)}catch(e){throw databaseError(e)}finally{client.release();}}
 async batch(statements){
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');await client.query('SET LOCAL search_path TO akaras, pg_catalog');
   const results=[];for(const s of statements){if(s.db!==this)throw Error('Different database in batch');results.push(result(await client.query(postgresSql(s.sql),s.values)));}
   await client.query('COMMIT');return results;
  }catch(e){await client.query('ROLLBACK');throw databaseError(e)}finally{client.release();}
 }
}
function databaseError(e){const label={'23505':'UNIQUE constraint failed','23503':'FOREIGN KEY constraint failed','23514':'CHECK constraint failed','23502':'NOT NULL constraint failed'}[e.code];if(!label)return e;return Object.assign(new Error(label,{cause:e}),{code:e.code});}
function result(r){return {success:true,results:r.rows||[],meta:{changes:r.rowCount??r.affectedRows??0}};}
class Statement{
 constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}
 bind(...values){return new Statement(this.db,this.sql,values);}
 async all(){return result(await this.db.query(this.sql,this.values));}
 async run(){return this.all();}
 async first(column){const r=(await this.all()).results[0];return r?(column?r[column]:r):null;}
}
