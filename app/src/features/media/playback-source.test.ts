import {afterEach,expect,it,vi} from 'vitest';
import {backendPlaybackLoader,checkedPlayback} from './playback-source';
afterEach(()=>vi.unstubAllGlobals());
it('requests fresh CSRF and playback authorization on each renewal without caching',async()=>{
 const fetch=vi.fn().mockImplementation(async(url:string)=>url.includes('csrf')?new Response(JSON.stringify({requestToken:'csrf'})):new Response(JSON.stringify({url:'https://storage.example/video',expiresAt:'2026-11-19T00:00:00Z'})));
 vi.stubGlobal('fetch',fetch);const loader=backendPlaybackLoader('/app/lessons/id/playback');const signal=new AbortController().signal;
 await loader(signal);await loader(signal);expect(fetch).toHaveBeenCalledTimes(4);
 expect(fetch.mock.calls[3][1]).toMatchObject({method:'POST',cache:'no-store',credentials:'include',headers:{'X-CSRF-TOKEN':'csrf'},signal});
});
it('does not return a playback link when authorization is denied',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:403})));
 await expect(backendPlaybackLoader('/playback','GET')(new AbortController().signal)).rejects.toMatchObject({status:403});
});
it('rejects unusable or unsafe playback metadata',()=>{
 expect(()=>checkedPlayback({url:'javascript:alert(1)',expiresAt:'2026-11-19T00:00:00Z'})).toThrow();
 expect(()=>checkedPlayback({url:'/file',expiresAt:'invalid'})).toThrow();
});
