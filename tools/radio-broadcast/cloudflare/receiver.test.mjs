import test from 'node:test';
import assert from 'node:assert/strict';
import { validLiveUrl } from '../../../fm/long-wave/receiver.js';
test('Accept only a deployed Cloudflare Worker MP3 live feed',()=>{
 assert.equal(validLiveUrl('https://humkin-long-wave.the-static-collective.workers.dev/live.mp3'),
  'https://humkin-long-wave.the-static-collective.workers.dev/live.mp3');
 assert.equal(validLiveUrl('https://stream.abundent.org/live.mp3'),'https://stream.abundent.org/live.mp3');
 for(const s of ['http://humkin-long-wave.any.workers.dev/live.mp3',
  'https://example.com/live.mp3','https://evil.workers.dev.attacker.com/live.mp3',
  'https://a.b.workers.dev/private.mp3','https://u:p@a.b.workers.dev/live.mp3',
  'https://a.b.workers.dev/live.mp3?key=secret'])assert.equal(validLiveUrl(s),null,s);
});
