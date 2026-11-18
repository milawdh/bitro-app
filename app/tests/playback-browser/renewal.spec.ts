import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('real 60-second storage expiry renews through authorization and preserves playback state',async({page,request})=>{
 const directory=path.resolve(process.cwd(),'../backend/artifacts/playback-browser');
 const fixture=JSON.parse(await fs.readFile(path.join(directory,'session.json'),'utf8')) as {runId:string;apiOrigin:string;lessonId:string;cookie:string;csrf:string};
 let passed=false;const links:{url:string;expiresAt:string}[]=[];
 try{
  await page.route('**/fixture/**',async route=>{
   const csrf=route.request().url().endsWith('/csrf');
   const response=await request.fetch(fixture.apiOrigin+(csrf?'/public/auth/csrf?area=app':'/app/lessons/'+fixture.lessonId+'/playback'),{method:csrf?'GET':'POST',headers:{Cookie:fixture.cookie,'X-CSRF-TOKEN':fixture.csrf}}).catch(()=>null);
   if(!response){await route.fulfill({status:503,body:'Playback test server unavailable'});return;}
   if(!csrf&&response.ok())links.push(await response.json());
   await route.fulfill({response});
  });
  await page.goto('/');
  const element=page.getByLabel('ویدئوی دوره');
  await expect.poll(()=>element.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(()=>element.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeCloseTo(1,1);
  await element.evaluate((v:HTMLVideoElement)=>v.play());await expect.poll(()=>element.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(1.3);await element.evaluate((v:HTMLVideoElement)=>v.pause());
  const position=await element.evaluate((v:HTMLVideoElement)=>v.currentTime);
  expect(links).toHaveLength(1);const original=links[0];
  const parameters=new URL(original.url).searchParams;
  if(parameters.has('X-Amz-Expires'))expect(parameters.get('X-Amz-Expires')).toBe('60');
  else expect(Number(parameters.get('Expires'))-Math.floor(Date.now()/1000)).toBeGreaterThanOrEqual(55);
  expect(Date.parse(original.expiresAt)-Date.now()).toBeLessThanOrEqual(60000);
  const remaining=Date.parse(original.expiresAt)-Date.now()+1500;
  // Real wall-clock expiry, not a browser clock simulation.
  await page.waitForTimeout(Math.max(0,remaining));
  const denied=await request.get(original.url,{headers:{Range:'bytes=0-31'}});expect(denied.status()).toBe(403);
  expect(links).toHaveLength(1); // paused players do not continuously renew
  await element.evaluate((v:HTMLVideoElement)=>v.play().catch(()=>{}));
  await expect.poll(()=>links.length).toBe(2);
  await expect.poll(()=>element.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(false);
  expect(await element.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThanOrEqual(position-.1);
  const ranged=await request.get(links[1].url,{headers:{Range:'bytes=0-31'}});expect(ranged.status()).toBe(206);
  await element.evaluate((v:HTMLVideoElement)=>{v.pause();v.dispatchEvent(new Event('error'));});
  await expect.poll(()=>links.length).toBe(3);await expect.poll(()=>element.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);
  expect(await element.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
  const loggedOut=await request.post(fixture.apiOrigin+'/app/auth/logout',{headers:{Cookie:fixture.cookie,'X-CSRF-TOKEN':fixture.csrf},data:{}});expect(loggedOut.ok()).toBe(true);
  await element.evaluate((v:HTMLVideoElement)=>v.dispatchEvent(new Event('error')));
  await expect(page.getByRole('alert')).toContainText('وارد حساب شوید');
  expect(await element.getAttribute('src')).toBeNull();expect(links).toHaveLength(3);
  passed=true;
 }finally{await fs.writeFile(path.join(directory,'done-'+fixture.runId+'.json'),JSON.stringify({passed}));}
});
