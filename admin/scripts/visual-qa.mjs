import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
await mkdir('artifacts/screenshots',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'fa-IR',reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[],overflow=[];
page.on('pageerror',error=>errors.push(error.message));
const cases=[['dashboard','/dashboard'],['courses','/courses'],['lesson','/lessons/csharp-variables'],['labs','/labs/variables'],['challenge','/challenges/variable-assignment'],['project','/projects/my-first-api'],['users','/users'],['analytics','/analytics'],['settings','/settings']];
try{
 for(const [name,path] of cases){
  const response=await page.goto(`http://127.0.0.1:3001${path}`,{waitUntil:'networkidle'});
  if(!response?.ok())throw new Error(`${path} returned ${response?.status()}`);
  await page.waitForSelector('.admin-skeleton',{state:'hidden'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`artifacts/screenshots/${name}-desktop.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'فعال‌کردن تم روشن'}).click();
 await page.goto('http://127.0.0.1:3001/dashboard',{waitUntil:'networkidle'});
 await page.screenshot({path:'artifacts/screenshots/dashboard-light.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 for(const [name,path] of cases){
  await page.goto(`http://127.0.0.1:3001${path}`,{waitUntil:'networkidle'});
  await page.waitForSelector('.admin-skeleton',{state:'hidden'});
  const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  if(widths.page>widths.viewport+1)overflow.push({path,...widths});
  await page.screenshot({path:`artifacts/screenshots/${name}-mobile.png`,fullPage:true});
 }
 await writeFile('artifacts/visual-qa.json',JSON.stringify({errors,overflow,screenshots:cases.length*2+1},null,2));
 console.log(JSON.stringify({errors,overflow}));
 if(errors.length||overflow.length)process.exitCode=1;
}finally{await browser.close();}
