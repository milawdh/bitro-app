import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomInt} from 'node:crypto';

//#region Configuration and HTTP Helpers
const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(backend);
const env = Object.fromEntries((await fs.readFile(path.join(backend,'.env'),'utf8')).split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)];}));
const docker = (...args) => execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024});
const jar = new Map();
const checks = [];
const driver='bitro-backend-smoke-driver';
const fetchScript=`let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',async()=>{try{const o=JSON.parse(input);const r=await fetch(o.url,{method:o.method,headers:o.headers,body:o.body,redirect:'manual',signal:AbortSignal.timeout(15000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=null}console.log(JSON.stringify({status:r.status,data,cookies:r.headers.getSetCookie()}))}catch{process.exitCode=1}});`;
function check(condition, message) {if(!condition)throw Error(message);checks.push(message);}
async function request(base, route, body, token) {
 const headers = {cookie:[...jar].map(([key,value])=>`${key}=${value}`).join('; ')};
 if(body!==undefined)headers['content-type']='application/json';
 if(token)headers['X-CSRF-TOKEN']=token;
 const response=JSON.parse(execFileSync('docker',['exec','-i',driver,'node','-e',fetchScript],{cwd:root,encoding:'utf8',input:JSON.stringify({url:base+route,method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),stdio:['pipe','pipe','pipe']}));
 for(const line of response.cookies) {const pair=line.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}
 return response;
}
async function csrf(base, area) {const result=await request(base,`/public/auth/csrf?area=${area}`);if(result.status!==200||!result.data?.requestToken)throw Error('CSRF request failed');return result.data.requestToken;}
async function ready(base) {
 for(let attempt=0;attempt<40;attempt++) {try{if((await request(base,'/public/health/ready')).status===200)return;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 throw Error('API readiness timeout');
}
//#endregion

//#region Independent Docker Instances
const nodes=[['bitro-backend-smoke-a'],['bitro-backend-smoke-b']];
let createdUser;
try{
 for(const[name]of nodes)docker('run','-d','--name',name,'--network','bitro-frontend_backend','--env-file','backend/.env','bitro-backend:local');
 docker('run','-d','--name',driver,'--network','bitro-frontend_backend','--entrypoint','node','bitro-frontend:local','-e','setInterval(()=>{},2147483647)');
 const a='http://bitro-backend-smoke-a:8080',b='http://bitro-backend-smoke-b:8080';
 await Promise.all([ready(a),ready(b)]);
 check((await request(a,'/public/health/ready')).data.status==='Healthy','All production dependencies are healthy');
 check((await request(a,'/admin/auth/me')).status===401,'Admin rejects anonymous requests');
 check((await request(b,'/app/auth/me')).status===401,'App rejects anonymous requests');
 check((await request(a,'/admin/auth/login',{username:env.BITRO_SUPERUSER_EMAIL,password:env.BITRO_SUPERUSER_PASSWORD})).status===400,'Login requires CSRF protection');
 const adminToken=await csrf(a,'admin');
 const admin=await request(a,'/admin/auth/login',{username:env.BITRO_SUPERUSER_EMAIL,password:env.BITRO_SUPERUSER_PASSWORD},adminToken);
 check(admin.status===200&&admin.data.roles.includes('superadmin'),'Seeded superuser can authenticate');
 check((await request(b,'/admin/auth/me')).status===200,'Admin cookie is valid on the other instance');
 check((await request(b,'/app/auth/me')).status===401,'Admin identity does not create an app session');
 const phone='09'+randomInt(0,1_000_000_000).toString().padStart(9,'0');
 const normalized='+98'+phone.slice(1),appToken=await csrf(a,'app');
 const issued=await request(a,'/app/auth/otp/request',{phoneNumber:phone},appToken);
 check(issued.status===202&&issued.data.challengeId&&!('code'in issued.data),'OTP response contains no code');
 check((await request(b,'/app/auth/otp/request',{phoneNumber:phone},appToken)).status===429,'Resend cooldown is shared across instances');
 const logs=docker('logs',nodes[0][0]);
 const line=logs.split(/\r?\n/).filter(value=>value.includes(normalized)).at(-1);
 const code=line?.match(/\b\d{6}\b/)?.[0];
 if(!code)throw Error('Console SMS code was not found for the isolated test phone');
 const body={challengeId:issued.data.challengeId,code};
 const verified=await Promise.all([request(a,'/app/auth/otp/verify',body,appToken),request(b,'/app/auth/otp/verify',body,appToken)]);
 check(verified.filter(value=>value.status===200).length===1&&verified.filter(value=>value.status===400).length===1,'Concurrent OTP consumption succeeds exactly once');
 const learner=verified.find(value=>value.status===200).data;createdUser={id:learner.id,phone:normalized};
 check(!('roles'in learner)&&!('password'in learner),'Learner response has no roles or password');
 check((await request(a,'/app/auth/me')).data.id===learner.id&&(await request(b,'/app/auth/me')).data.id===learner.id,'App cookie is valid on both instances');
 check((await request(a,'/admin/auth/me')).status===200,'App login preserves the admin session');
 const oldAppCookie=jar.get('bitro.app.auth');
 const appLogout=await request(b,'/app/auth/logout',{},await csrf(b,'app'));
 check(appLogout.status===200||appLogout.status===204,'App logout succeeds');
 jar.set('bitro.app.auth',oldAppCookie);
 check((await request(a,'/app/auth/me')).status===401,'App logout invalidates a replayed old cookie on the other instance');
 check((await request(a,'/admin/auth/me')).status===200,'App logout preserves the admin session');
 const oldAdminCookie=jar.get('bitro.admin.auth');
 const adminLogout=await request(b,'/admin/auth/logout',{},await csrf(b,'admin'));
 check(adminLogout.status===200||adminLogout.status===204,'Admin logout succeeds');
 jar.set('bitro.admin.auth',oldAdminCookie);
 check((await request(a,'/admin/auth/me')).status===401,'Admin logout invalidates a replayed old cookie on the other instance');
 const schema=await request(a,'/openapi/v1.json');
 check(schema.status===200&&schema.data.paths['/app/auth/otp/request']&&schema.data.paths['/admin/auth/login'],'OpenAPI exposes the expected area routes');
 await fs.mkdir(path.join(backend,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(backend,'artifacts','smoke-results.json'),JSON.stringify({checks,instances:2,passed:true},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,instances:2}));
}finally{
 if(createdUser&&/^[a-f0-9]{32}$/.test(createdUser.id)&&/^\+[0-9]{10,15}$/.test(createdUser.phone)){
  const databaseId=docker('compose','--env-file','backend/.env','ps','-q','backend-postgres').trim();
  if(databaseId)docker('exec',databaseId,'psql','-U','bitro','-d','bitrolearn','-c',`DELETE FROM "AppUsers" WHERE "Id"='${createdUser.id}' AND "PhoneNumber"='${createdUser.phone}';`);
 }
 for(const[name]of [...nodes,[driver]]){try{docker('rm','-f',name);}catch{}}
}
//#endregion
