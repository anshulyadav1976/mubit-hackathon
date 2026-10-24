import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWave } from '../voice.mjs';
function wav(){const b=Buffer.alloc(44+3200);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(3200,40);return b;}
test('voice accepts only bounded canonical mono PCM data',()=>{assert.doesNotThrow(()=>validateWave(wav()));assert.throws(()=>validateWave(Buffer.alloc(40)));const stereo=wav();stereo.writeUInt16LE(2,22);assert.throws(()=>validateWave(stereo));const size=wav();size.writeUInt32LE(9999,40);assert.throws(()=>validateWave(size));assert.throws(()=>validateWave(Buffer.alloc(1000045)));});
