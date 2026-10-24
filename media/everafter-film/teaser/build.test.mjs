import {test}from'node:test';import assert from'node:assert/strict';import{CUTS,assetPath,selectedClips,check}from'./build.mjs';
test('five cuts form exactly 20 seconds',()=>{let end=0;for(const c of CUTS){assert.equal(c.start,end);end+=c.duration;}assert.equal(end*30,600);assert.equal(CUTS.length,5);});
test('untrusted asset URLs and traversal fail',()=>{for(const p of ['https://example.com/clip.mp4','assets/../secrets','/tmp/clip.mp4'])assert.throws(()=>assetPath(p));});
test('selection overrides offsets without losing source provenance',()=>{const c=selectedClips({clips:{C03:{path:'assets/footage/C03.mp4',sourceStartSeconds:0,sessionId:'s'}}},{clips:{C03:{sourceStartSeconds:10,voiceVerified:true}}});assert.equal(c.C03.sessionId,'s');assert.equal(c.C03.sourceStartSeconds,10);assert.equal(c.C03.voiceVerified,true);});
test('missing footage is rejected',()=>{const p=check({});assert.equal(p.length,4);assert.ok(p.every(x=>x.includes('local assets')));});
