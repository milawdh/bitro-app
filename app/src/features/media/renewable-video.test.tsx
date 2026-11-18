// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render} from '@testing-library/react';
import {RenewableVideo} from './renewable-video';
import {PlaybackRequestError} from './playback-source';

describe('renewable video state',()=>{
 beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  const paused=new WeakMap<HTMLMediaElement,boolean>();
  vi.spyOn(HTMLMediaElement.prototype,'paused','get').mockImplementation(function(this:HTMLMediaElement){return paused.get(this)??true;});
  vi.spyOn(HTMLMediaElement.prototype,'currentSrc','get').mockImplementation(function(this:HTMLMediaElement){return this.src;});
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){paused.set(this,false);fireEvent.play(this);return Promise.resolve();});
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(function(this:HTMLMediaElement){paused.set(this,true);fireEvent.pause(this);});
 });
 afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
 function ready(video:HTMLVideoElement){act(()=>{fireEvent.loadedMetadata(video);fireEvent.seeked(video);fireEvent.canPlay(video);});}
 it('renews an actively playing lease before expiry and restores its position',async()=>{
  let calls=0;const loader=vi.fn(async()=>({url:'http://localhost/video.mp4?lease='+ ++calls,expiresAt:new Date(Date.now()+60000).toISOString()}));
  const onPosition=vi.fn();const view=render(<RenewableVideo mediaKey="one" requestPlayback={loader} initialPosition={12} onPosition={onPosition}/>);
  await act(async()=>{});const video=view.getByLabelText('ویدئوی دوره') as HTMLVideoElement;ready(video);
  await act(async()=>{await video.play();});video.currentTime=22;
  await act(async()=>{await vi.advanceTimersByTimeAsync(55000);});expect(loader).toHaveBeenCalledTimes(2);
  ready(video);expect(video.currentTime).toBe(22);expect(video.paused).toBe(false);expect(onPosition).toHaveBeenLastCalledWith(22);
 });
 it('waits during a long pause and clears the source when renewed authorization is denied',async()=>{
  const loader=vi.fn().mockResolvedValueOnce({url:'http://localhost/video.mp4',expiresAt:new Date(Date.now()+60000).toISOString()}).mockRejectedValueOnce(new PlaybackRequestError(403,'دسترسی تأیید نشد.'));
  const view=render(<RenewableVideo mediaKey="one" requestPlayback={loader} initialPosition={12}/>);
  await act(async()=>{});const video=view.getByLabelText('ویدئوی دوره') as HTMLVideoElement;ready(video);
  await act(async()=>{await vi.advanceTimersByTimeAsync(65000);});expect(loader).toHaveBeenCalledTimes(1);
  await act(async()=>{await video.play();await vi.advanceTimersByTimeAsync(1);});expect(loader).toHaveBeenCalledTimes(2);expect(video.paused).toBe(true);expect(video.getAttribute('src')).toBeNull();
  expect(view.getByRole('alert').textContent).toContain('دسترسی تأیید نشد');
 });
});
