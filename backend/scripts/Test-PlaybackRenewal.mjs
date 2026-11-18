import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const artifacts=path.join(workspace,'backend/artifacts/playback-browser');
await mkdir(artifacts,{recursive:true});
try{await readFile(path.join(workspace,'backend/artifacts/media-test-probe/package/ffprobe'));}
catch{throw new Error('First run backend/scripts/Test-MediaStorage.ps1 to prepare the pinned test probe.');}
const compose=['compose','--env-file','backend/.env'];
async function launch(executable,args,log,cwd=workspace){
 const output=await open(path.join(workspace,'backend/artifacts',log),'w');
 const child=spawn(executable,args,{cwd,windowsHide:true,stdio:['ignore',output.fd,output.fd]});
 const finished=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));}).finally(()=>output.close());
 return {child,finished};
}
const build=await launch('docker',[...compose,'--profile','test','build','backend-tests'],'playback-browser-build.log');
if(await build.finished!==0)throw new Error('Test image build failed; see backend/artifacts/playback-browser-build.log.');
let previous;
try{previous=JSON.parse(await readFile(path.join(artifacts,'session.json'),'utf8')).runId;}catch{}
const fixture=await launch('docker',[...compose,'--profile','playback-test','run','--rm','--service-ports','--name','bitro-playback-browser-tests','backend-playback-tests'],'playback-browser-fixture.log');
let session,browserResult=1;
try{
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  try{const candidate=JSON.parse(await readFile(path.join(artifacts,'session.json'),'utf8'));if(candidate.runId!==previous){session=candidate;break;}}catch{}
  if(fixture.child.exitCode!==null)break;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!session)throw new Error('Playback fixture did not become ready; see its artifact log.');
 const browser=await launch(process.execPath,[path.join(workspace,'app/node_modules/@playwright/test/cli.js'),'test','--config','tests/playback-browser/playwright.config.ts'],'playback-browser.log',path.join(workspace,'app'));
 console.log('Testing a real 60-second signed URL; the paused-player case waits for wall-clock expiration.');
 browserResult=await browser.finished;
}finally{
 if(session)await writeFile(path.join(artifacts,'done-'+session.runId+'.json'),JSON.stringify({passed:browserResult===0}));
}
const fixtureResult=await fixture.finished;
if(browserResult!==0||fixtureResult!==0)throw new Error('Playback renewal failed; see backend/artifacts/playback-browser.log and playback-browser-fixture.log.');
console.log('PASS: expiration rejection, authorized renewal, position and play/pause preservation, and denied access. Production TTL remains unchanged.');
