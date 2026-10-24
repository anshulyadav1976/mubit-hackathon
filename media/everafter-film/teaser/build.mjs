import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url)), MAIN=path.resolve(ROOT,'../composition');
export const CUTS=[{id:'C01',start:0,duration:3,title:'Bring her home.'},{id:'C03',start:3,duration:5,title:'Your words shape the chapter.'},{id:'C05',start:8,duration:4,title:'Your chapter begins.'},{id:'C10B',start:12,duration:5,title:'Your way.'},{id:'TITLE',start:17,duration:3}];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
export function assetPath(p){if(typeof p!=='string'||!p.startsWith('assets/')||p.split(/[\\/]/).includes('..')||path.isAbsolute(p))throw Error('Only local assets/ paths are allowed');return path.join(MAIN,p);}
function linkAsset(relative){const source=assetPath(relative),dest=path.join(ROOT,relative);if(!fs.existsSync(source))return false;fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest)){if(fs.statSync(source).ino===fs.statSync(dest).ino)return true;fs.unlinkSync(dest);}fs.linkSync(source,dest);return true;}
export function selectedClips(manifest,selection){return Object.fromEntries(CUTS.filter(c=>c.id!=='TITLE').map(c=>[c.id,{...(manifest.clips?.[c.id]??{}),...(selection.clips?.[c.id]??{})}]));}
export function check(clips,{probe=false}={}){
 const issues=[];
 for(const cut of CUTS.filter(c=>c.id!=='TITLE')){const c=clips[cut.id]??{};let source;try{source=assetPath(c.path);}catch(error){issues.push(`${cut.id}: ${error.message}`);continue;}if(!fs.existsSync(source)){issues.push(`${cut.id}: missing footage`);continue;}if(c.verified!==true)issues.push(`${cut.id}: capture not verified`);if(!Number.isFinite(c.sourceStartSeconds)||c.sourceStartSeconds<0)issues.push(`${cut.id}: invalid source offset`);if(cut.id==='C03'&&c.voiceVerified!==true)issues.push('C03: complete real voice excerpt not verified');if(probe){try{const data=JSON.parse(execFileSync(process.env.FFPROBE||'ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',source],{encoding:'utf8'}));if(!data.streams.some(x=>x.codec_type==='video')||+data.format.duration+.035<c.sourceStartSeconds+cut.duration)issues.push(`${cut.id}: insufficient video interval`);}catch(error){issues.push(`${cut.id}: media probe failed`);}}}
 return issues;
}
const css=`@font-face{font-family:FilmSerif;src:url('assets/fonts/EBGaramond-700.woff2');font-weight:700}@font-face{font-family:FilmSans;src:url('assets/fonts/Inter-400.woff2')}@font-face{font-family:FilmMono;src:url('assets/fonts/JetBrainsMono-400.woff2')}*{box-sizing:border-box;margin:0}#root{position:absolute;inset:0;background:#101719;color:#F0E8D6;overflow:hidden}.clip{position:absolute;inset:0}.footage{width:1920px;height:1080px;object-fit:contain}.caption{position:absolute;left:200px;top:138px;background:#101719;padding:24px 32px;max-width:1500px}.caption h2{font:700 66px/1.15 FilmSerif}.rule{width:144px;height:3px;background:#E9AD5A;margin-top:18px;transform-origin:left}.label{position:absolute;right:192px;bottom:120px;font:28px FilmMono;background:#101719;padding:16px 24px;color:#A7B1AE}.missing{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:32px;font:40px FilmSans}.missing strong{color:#E9AD5A;font:32px FilmMono}.end{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:36px;text-align:center}.end h1{font:700 124px FilmSerif;letter-spacing:8px}.tag{font:700 56px FilmSerif;color:#E9AD5A}.product{font:34px FilmSans}.credit{font:28px FilmSans;color:#A7B1AE;max-width:1500px;margin-top:42px}`;
export function build({strict=false}={}){
 const manifest=read(path.join(MAIN,'capture-manifest.json')),selection=read(path.join(ROOT,'selection.json'));
 const clips=selectedClips(manifest,selection),issues=check(clips,{probe:strict});
 const music=manifest.music??{path:'assets/audio/music.wav',sourceStartSeconds:0,volume:.12,licenseVerified:true};
 if(music.licenseVerified!==true)issues.push('Music license not verified');
 if(!fs.existsSync(assetPath(music.path)))issues.push('Music missing');
 if(strict&&issues.length)throw Error(`Final teaser rejected:\n${issues.join('\n')}`);
 for(const p of ['assets/vendor/gsap.min.js','assets/fonts/EBGaramond-700.woff2','assets/fonts/Inter-400.woff2','assets/fonts/JetBrainsMono-400.woff2'])if(!linkAsset(p))throw Error(`Missing shared asset ${p}`);
 fs.mkdirSync(path.join(ROOT,'compositions'),{recursive:true});const hosts=[];
 for(const cut of CUTS){const id=`teaser-${cut.id}`,clip=clips[cut.id];let body='',animation='';
  if(cut.id==='TITLE'){
   body=`<div id="${id}-lockup" class="clip" data-start="0" data-duration="3" data-track-index="1"><div class="end" data-hold="true"><h1 id="${id}-name" data-var-text="title">EVERAFTER</h1><p class="tag">Bring her home. Your way.</p><p class="product">A conversation becomes a playable chapter.</p><p class="credit">Music: “Uprising” · Scott Buckley · CC BY 4.0</p></div></div>`;
   animation=`tl.fromTo('#${id}-name',{opacity:0,y:16},{opacity:1,y:0,duration:.45,ease:'power3.out'},0);`;
  }else{
   const present=clip.path&&linkAsset(clip.path);
   body=present?`<video id="${id}-video" class="clip footage" src="${esc(clip.path)}" data-var-src="footage" data-start="0" data-duration="${cut.duration}" data-media-start="${clip.sourceStartSeconds??0}" data-playback-rate="1" data-track-index="0" ${cut.id==='C03'&&clip.audio!==false?'data-has-audio="true" data-volume="0.75"':'muted'} playsinline></video>`:`<div id="${id}-missing" class="clip" data-start="0" data-duration="${cut.duration}" data-track-index="0"><div class="missing" data-hold="true"><strong>DRAFT · FOOTAGE MISSING · ${cut.id}</strong><p>Production placeholder, not gameplay.</p></div></div>`;
   const note=cut.id==='C03'?'Synthetic player voice · real microphone / STT':cut.id==='C10B'?'Recorded post-reunion state':'Edited gameplay sequence';
   body+=`<div id="${id}-overlay" class="clip" data-start="0" data-duration="${cut.duration}" data-track-index="2"><div class="caption"><h2 id="${id}-title" data-var-text="headline">${esc(cut.title)}</h2><div id="${id}-rule" class="rule"></div></div><p class="label">${note}</p></div>`;
   animation=`tl.fromTo('#${id}-title',{opacity:0,y:16},{opacity:1,y:0,duration:.35,ease:'power3.out'},0);tl.fromTo('#${id}-rule',{scaleX:0},{scaleX:1,duration:.4},.2);`;
  }
  const vars=cut.id==='TITLE'?[{id:'title',type:'string',label:'Title',default:'EVERAFTER'}]:[{id:'headline',type:'string',label:'Editorial headline',default:cut.title},...(clip.path?[{id:'footage',type:'string',label:'Footage',default:clip.path}]:[])];
  fs.writeFileSync(path.join(ROOT,`compositions/${id}.html`),`<template><style>${css}</style><div id="root" data-composition-id="${id}" data-duration="${cut.duration}" data-width="1920" data-height="1080" data-composition-variables='${esc(JSON.stringify(vars))}'>${body}</div><script>const tl=gsap.timeline({paused:true});${animation}tl.addLabel('end',${cut.duration});window.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;</script></template>`);
  hosts.push(`<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${cut.start}" data-duration="${cut.duration}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`);
 }
 const audio=linkAsset(music.path)?`<audio id="teaser-music" class="clip" src="${esc(music.path)}" data-start="0" data-duration="20" data-media-start="${music.sourceStartSeconds??0}" data-track-index="5" data-volume="${music.volume??.12}" data-fade-in="1" data-fade-out="2"></audio>`:'';
 fs.writeFileSync(path.join(ROOT,'index.html'),`<!doctype html><html lang="en" data-resolution="landscape"><head><meta charset="utf-8"><meta name="viewport" content="width=1920,height=1080"><title>EVERAFTER · 20-second teaser</title><script src="assets/vendor/gsap.min.js"></script><style>html,body{margin:0;width:1920px;height:1080px;background:#101719;overflow:hidden}#root,.clip{position:absolute;inset:0}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="20" data-width="1920" data-height="1080" data-fps="30">${hosts.join('\n')}${audio}</div><script>const tl=gsap.timeline({paused:true});tl.addLabel('end',20);window.__timelines=window.__timelines||{};window.__timelines.main=tl;</script></body></html>`);
 fs.writeFileSync(path.join(ROOT,'build-status.json'),JSON.stringify({frames:600,edits:5,strict,issues},null,2)+'\n');return{frames:600,edits:5,issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(build({strict:process.argv.includes('--final')}),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
