import pg from 'pg';
import {PostgresDatabase} from './postgres.mjs';
import {SupabaseStorage} from './storage.mjs';
import {migrate,bootstrapAdmin} from './setup.mjs';
import {createServer} from './http.mjs';
pg.types.setTypeParser(20,Number);
let pool;
try{
 for(const name of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL','ADMIN_PASSWORD'])if(!process.env[name])throw Error('Missing environment variable: '+name);
 // Supabase's database CA is supplied separately; TLS verification stays enabled.
 const connection=new URL(process.env.DATABASE_URL);connection.searchParams.delete('sslmode');
 pool=new pg.Pool({connectionString:connection.toString(),ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replaceAll('\\n','\n')}:{})},max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:30000});
 pool.on('error',e=>console.error('Database pool error:',e.code||e.name));
 await migrate(pool);
 const DB=new PostgresDatabase(pool),BUCKET=new SupabaseStorage(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_BUCKET||'akaras-images');
 await BUCKET.ensureBucket();await bootstrapAdmin(DB,process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD);
 const server=createServer({DB,BUCKET,
  DISCORD_WEBHOOK_URL:process.env.DISCORD_WEBHOOK_URL,
  DISCORD_REMINDER_KEY:process.env.DISCORD_REMINDER_KEY,
  DISCORD_REMINDER_MINUTES:process.env.DISCORD_REMINDER_MINUTES
 },{publicUrl:process.env.APP_URL||process.env.RENDER_EXTERNAL_URL});
 server.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Akarás Predictions ready.'));
 async function stop(){server.close(async()=>{await pool.end();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref();}
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}catch(e){console.error('Startup failed:',e.message?.includes('postgres://')?'Database configuration error':e.message);if(pool)await pool.end();process.exitCode=1;}
