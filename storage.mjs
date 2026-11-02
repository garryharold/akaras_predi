export class SupabaseStorage{
 constructor(url,key,bucket='akaras-images',fetcher=fetch){
  const u=new URL(url);if(u.protocol!=='https:')throw Error('SUPABASE_URL must use HTTPS');
  this.url=u.origin;this.key=key;this.bucket=bucket;this.fetch=fetcher;
 }
 async request(path,options={}){
  const r=await this.fetch(this.url+'/storage/v1'+path,{signal:AbortSignal.timeout(20000),...options,headers:{apikey:this.key,Authorization:'Bearer '+this.key,...options.headers}});
  return r;
 }
 async ensureBucket(){
  const path='/bucket/'+encodeURIComponent(this.bucket);const r=await this.request(path);
  if(r.ok){const b=await r.json();if(b.public)throw Error('Use a private Supabase bucket for this application.');return;}
  if(r.status!==404&&!(r.status===400&&(await r.clone().text()).includes('not found')))throw Error('Supabase bucket lookup failed ('+r.status+')');
  const created=await this.request('/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:this.bucket,name:this.bucket,public:false,file_size_limit:5242880,allowed_mime_types:['image/png','image/jpeg','image/webp','image/gif']})});
  if(!created.ok)throw Error('Supabase bucket creation failed ('+created.status+'). Create a private akaras-images bucket in the dashboard.');
 }
 objectPath(key){return '/'+encodeURIComponent(this.bucket)+'/'+key.split('/').map(encodeURIComponent).join('/');}
 async put(key,bytes,options={}){
  const r=await this.request('/object'+this.objectPath(key),{method:'POST',headers:{'Content-Type':options.httpMetadata?.contentType||'application/octet-stream'},body:bytes});
  if(!r.ok)throw Error('Image upload failed ('+r.status+')');return {};
 }
 async get(key){const r=await this.request('/object/authenticated'+this.objectPath(key));if(r.status===404)return null;if(!r.ok)throw Error('Image download failed ('+r.status+')');return {body:r.body};}
 async delete(key){const r=await this.request('/object/'+encodeURIComponent(this.bucket),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});if(!r.ok)throw Error('Image removal failed ('+r.status+')');}
}
