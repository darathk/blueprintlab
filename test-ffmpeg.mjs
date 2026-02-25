import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js').then(m => {
  console.log('FFmpeg module loaded:', Object.keys(m));
}).catch(console.error);

import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js').then(m => {
  console.log('Util module loaded:', Object.keys(m));
}).catch(console.error);
