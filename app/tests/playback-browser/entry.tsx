import React from 'react';
import {createRoot} from 'react-dom/client';
import {RenewableVideo} from '../../src/features/media/renewable-video';
import {backendPlaybackLoader} from '../../src/features/media/playback-source';

const requestPlayback=backendPlaybackLoader('/fixture/playback','POST','/fixture/csrf');
createRoot(document.getElementById('root')!).render(<RenewableVideo mediaKey="real-private-video" initialPosition={1} requestPlayback={requestPlayback}/>);
