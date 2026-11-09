import http from 'node:http';
import {handleDiscordReminders} from './discord-reminders.mjs';
import {handleArcadeRecords} from './arcade-records.mjs';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {GET as page} from './page.ts';
import {handleGame} from '../lib/game-api.ts';
import {handleAuth} from '../lib/account-auth.ts';
import {handleCatalog} from '../lib/catalog-api.ts';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json','.md':'text/markdown; charset=utf-8','.ico':'image/x-icon'};
export function createServer(env,{publicUrl,secure=true}={}){
 if(!publicUrl)throw Error('APP_URL or RENDER_EXTERNAL_URL is required.');
 const base=new URL(publicUrl);if(secure&&base.protocol!=='https:')throw Error('Production APP_URL must use HTTPS.');
 return http.createServer({maxHeaderSize:16384},async(req,res)=>{
  try{
   const url=new URL(req.url,base.origin);
   if(url.origin!==base.origin){res.writeHead(400);res.end();return;}
   if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}
   let response;
   if(url.pathname.startsWith('/api/')){
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value&&!key.startsWith('oai-')&&!['host','connection','transfer-encoding','content-length'].includes(key))headers.set(key,Array.isArray(value)?value.join(', '):value);
    let body;let size=0;const chunks=[];
    const maxBody=url.pathname==='/api/catalog/media'?5500000:2300000;
    for await(const chunk of req){size+=chunk.length;if(size>maxBody){res.writeHead(413,{'Content-Type':'application/json'});res.end('{"error":"Túl nagy kérés."}');return;}chunks.push(chunk);}
    if(chunks.length)body=Buffer.concat(chunks);
    const request=new Request(url,{method:req.method,headers,...(body?{body}:{})});
    const handler=url.pathname==='/api/reminders/discord'?handleDiscordReminders:url.pathname.startsWith('/api/arcade/')?handleArcadeRecords:url.pathname.startsWith('/api/game/')?handleGame:url.pathname.startsWith('/api/auth/')?handleAuth:url.pathname.startsWith('/api/catalog/')?handleCatalog:null;
    response=handler?await handler(request,env):Response.json({error:'Nincs ilyen végpont.'},{status:404});
   }else if(req.method!=='GET'&&req.method!=='HEAD')response=new Response(null,{status:405});
   else if(url.pathname==='/')response=page();
   else{
    let relative;try{relative=decodeURIComponent(url.pathname)}catch{relative='';}
    const file=path.resolve(root,'.'+relative);
    if(!relative||relative.includes('\0')||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!file.startsWith(root))response=new Response('Not found',{status:404});
    else try{response=new Response(await readFile(file),{headers:{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'public, max-age=3600'}})}catch{response=new Response('Not found',{status:404});}
   }
   res.statusCode=response.status;
   for(const [k,v]of response.headers)if(k!=='set-cookie')res.setHeader(k,v);
   const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
   if(req.method==='HEAD'||!response.body)res.end();else await pipeline(Readable.fromWeb(response.body),res);
  }catch(e){console.error('Request failed:',e.code||e.name);if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Szerverhiba. Próbáld újra később."}');}else res.destroy();}
 });
}
