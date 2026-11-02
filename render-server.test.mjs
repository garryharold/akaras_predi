import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fixture} from './pg-fixture.mjs';
import {bootstrapAdmin} from '../server/setup.mjs';
import {createServer} from '../server/http.mjs';
import {SupabaseStorage} from '../server/storage.mjs';
const {pg,DB}=await fixture();const objects=new Map();let bucket=false;
const BUCKET=new SupabaseStorage('https://project.supabase.co','test-only-service-key','akaras-images',async(url,opts)=>{
 assert.equal(opts.headers.Authorization,'Bearer test-only-service-key');
 const p=new URL(url).pathname.replace('/storage/v1','');
 if(p==='/bucket/akaras-images')return bucket?Response.json({public:false}):new Response('not found',{status:404});
 if(p==='/bucket'&&opts.method==='POST'){assert.equal(JSON.parse(opts.body).public,false);bucket=true;return Response.json({});}
 if(p.startsWith('/object/authenticated/akaras-images/')){const k=p.split('/').slice(4).join('/');return objects.has(k)?new Response(objects.get(k)):new Response(null,{status:404});}
 if(opts.method==='POST'&&p.startsWith('/object/akaras-images/')){objects.set(p.split('/').slice(3).join('/'),opts.body);return Response.json({});}
 if(opts.method==='DELETE'){for(const k of JSON.parse(opts.body).prefixes)objects.delete(k);return Response.json({});}
 throw Error('Unexpected Storage API call '+p);
});
await BUCKET.ensureBucket();await BUCKET.ensureBucket();
await bootstrapAdmin(DB,'owner@example.test','A fresh admin password!');
const server=createServer({DB,BUCKET},{publicUrl:'https://app.example.test'});server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
async function api(path,data,cookie='',headers={}){const r=await fetch(base+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{...(data instanceof FormData?{}:{'Content-Type':'application/json'}),...(cookie?{cookie}:{}),...headers},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)});return r;}
try{
 assert.equal((await fetch(base+'/healthz')).status,200);
 const page=await (await fetch(base+'/')).text();assert(page.includes('AKAR'));assert(!page.includes('test-only-service-key'));
 assert.equal((await fetch(base+'/hub.css')).headers.get('content-type'),'text/css; charset=utf-8');
 assert.equal((await fetch(base+'/%2eenv')).status,404);
 assert.equal((await fetch(base+'/server/start.mjs')).status,404);
 assert.equal((await api('game/bootstrap',undefined,'',{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'})).status,200);
 assert.equal((await (await api('game/bootstrap')).json()).viewer,null);
 assert.equal((await api('game/initialize',{})).status,403);
 const login=await api('auth/login',{email:'owner@example.test',password:'A fresh admin password!'});assert.equal(login.status,200);
 const set=login.headers.get('set-cookie');assert(set.includes('HttpOnly'));assert(set.includes('Secure'));const admin=set.split(';')[0];
 assert.equal((await api('game/initialize',{},admin)).status,200);
 assert.equal((await api('catalog/reference',{},admin)).status,200);
 assert.equal((await api('catalog/reference',{},admin)).status,200);
 const data=await (await api('catalog/data',undefined,admin)).json();assert.equal(data.countries.length,249);assert.equal(data.roles.length,5);
 const catalogForm=new FormData();const catalogPng=Buffer.alloc(3*1024*1024);catalogPng.set([137,80,78,71]);catalogForm.append('file',new File([catalogPng],'team.png',{type:'image/png'}));
 const catalogUpload=await api('catalog/media',catalogForm,admin);assert.equal(catalogUpload.status,201);const catalogUrl=(await catalogUpload.json()).url;assert.equal((await fetch(base+catalogUrl)).status,200);
 assert.equal((await api('catalog/regions',{code:'KR',name:'Duplicate'},admin)).status,409);
 assert.equal((await api('auth/register',{email:'player@example.test',password:'A normal user password!'},'',{origin:'https://evil.example.test'})).status,403);
 const register=await api('auth/register',{email:'player@example.test',password:'A normal user password!'});assert.equal(register.status,201);const user=register.headers.get('set-cookie').split(';')[0];
 assert.equal((await api('catalog/data',undefined,user)).status,403);
 const form=new FormData();form.append('display_name','Render játékos');const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT5kAAAAASUVORK5CYII=','base64');form.append('avatar',new File([png],'a.png',{type:'image/png'}));
 const saved=await api('game/profile',form,user);assert.equal(saved.status,200);const avatar=(await saved.json()).profile.avatar_url;
 const image=await fetch(base+avatar);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 const board=await (await api('game/bootstrap')).json();assert(board.leaderboard.some(p=>p.name==='Render játékos'));assert(board.leagues.length===7);
 assert.equal((await api('game/profile',{display_name:'x'.repeat(2400000)},user)).status,413);
 const bad=new SupabaseStorage('https://project.supabase.co','test','akaras-images',async()=>Response.json({public:true}));await assert.rejects(bad.ensureBucket(),/private/);
 console.log('PASS: Node HTTP routes, assets, admin login, CSRF, ordinary users, PostgreSQL catalog, profile upload/download via mocked private Supabase Storage, leaderboard and body limit.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await pg.close();}
