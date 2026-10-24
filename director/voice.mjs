import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const run=promisify(execFile);
const repo=resolve(import.meta.dirname,'..');
const binary=process.env.WHISPER_BIN||join(repo,'.tooling/whisper.cpp/build/bin/whisper-cli');
const model=process.env.WHISPER_MODEL||join(repo,'.tooling/ggml-tiny.en.bin');
let active=false;
export async function voiceAvailable(){try{await Promise.all([access(binary),access(model)]);return true;}catch{return false;}}
export function validateWave(buffer){if(buffer.length<44||buffer.length>1000044||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE'||buffer.toString('ascii',12,16)!=='fmt '||buffer.readUInt32LE(16)!==16||buffer.readUInt16LE(20)!==1||buffer.readUInt16LE(22)!==1||buffer.readUInt32LE(24)!==16000||buffer.readUInt16LE(34)!==16||buffer.toString('ascii',36,40)!=='data'||buffer.readUInt32LE(40)!==buffer.length-44||(buffer.length-44)%2)throw Object.assign(Error('Expected a short mono 16 kHz PCM recording'),{status:400});}
export async function transcribe(request){if(active)throw Object.assign(Error('Voice is still processing'),{status:429});if(!await voiceAvailable())throw Object.assign(Error('Local voice model is unavailable; type your reply instead.'),{status:503});if(request.headers['content-type']!=='audio/wav')throw Object.assign(Error('Expected audio/wav'),{status:415});active=true;let folder;try{let size=0;const chunks=[];for await(const c of request){size+=c.length;if(size>1000044)throw Object.assign(Error('Recording too long'),{status:413});chunks.push(c);}const buffer=Buffer.concat(chunks);validateWave(buffer);folder=await mkdtemp(join(tmpdir(),'everafter-voice-'));const wav=join(folder,'speech.wav');await writeFile(wav,buffer,{mode:0o600});await run(binary,['-m',model,'-f',wav,'-l','en','-otxt','-of',join(folder,'transcript'),'-nt','-t','4'],{timeout:30000,maxBuffer:1024*1024});const text=(await readFile(join(folder,'transcript.txt'),'utf8')).trim().replace(/\[.*?\]/g,'').trim();if(!text||text.length>1200)throw Object.assign(Error('No clear speech heard. Try again or type your reply.'),{status:422});return{text,source:'local-whisper',model:'tiny.en'};}finally{active=false;if(folder)await rm(folder,{recursive:true,force:true});}}
