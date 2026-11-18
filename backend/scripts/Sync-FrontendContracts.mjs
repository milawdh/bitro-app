import {readFile,writeFile} from 'node:fs/promises';
const source = new URL('../src/BitroLearn.Api/Data/animation-registry.json',import.meta.url);
const content=await readFile(source,'utf8');
for(const name of ['app','admin']) {
  const target=new URL(`../../${name}/src/lib/animation-registry.json`,import.meta.url);
  if(process.argv.includes('--check')) {
    if(await readFile(target,'utf8')!==content)throw new Error(`${name}: animation contracts differ`);
  } else await writeFile(target,content);
}
const api=await readFile(new URL('../contracts/course-api.ts',import.meta.url),'utf8');
for(const name of ['app','admin']) {
  const target=new URL(`../../${name}/src/lib/course-api.ts`,import.meta.url);
  if(process.argv.includes('--check')) { if(await readFile(target,'utf8')!==api)throw new Error(`${name}: API contracts differ`); }
  else await writeFile(target,api);
}
const provider=await readFile(new URL('../../app/src/lib/course-commerce.ts',import.meta.url),'utf8');
const adminProvider=new URL('../../admin/src/lib/course-commerce.ts',import.meta.url);
if(process.argv.includes('--check')) { if(await readFile(adminProvider,'utf8')!==provider)throw new Error('Frontend mock providers differ'); }
else await writeFile(adminProvider,provider);
