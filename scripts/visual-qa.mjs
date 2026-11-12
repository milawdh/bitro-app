import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output='artifacts/screenshots';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'fa-IR',reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const cases=[['landing','/'],['dashboard','/dashboard'],['courses','/learn'],['lesson','/learn/csharp/variables'],['lab','/concept-labs/objects'],['playground','/playground'],['project','/projects/my-first-api']];
for(const [name,path] of cases){
  const response=await page.goto(`http://127.0.0.1:3000${path}`,{waitUntil:'networkidle'});
  if(!response?.ok())throw new Error(`${path}: ${response?.status()}`);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${output}/${name}-desktop.png`,fullPage:true});
}
await page.setViewportSize({width:390,height:844});
const overflow=[];
for(const [name,path] of [...cases,['challenges','/challenges'],['settings','/settings']]){
  await page.goto(`http://127.0.0.1:3000${path}`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  if(widths.page>widths.viewport+1)overflow.push({path,...widths});
  await page.screenshot({path:`${output}/${name}-mobile.png`,fullPage:true});
}
await writeFile('artifacts/visual-qa.json',JSON.stringify({errors,overflow,screenshots:cases.length*2+2},null,2));
await browser.close();
console.log(JSON.stringify({errors,overflow}));
if(errors.length||overflow.length)process.exitCode=1;
