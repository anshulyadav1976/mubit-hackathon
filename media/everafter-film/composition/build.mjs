import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, text) => fs.writeFileSync(path.join(ROOT, file), text);
export function readTimeline() {
  const [header,...lines] = fs.readFileSync(path.join(ROOT,'../timeline.csv'),'utf8').trim().split('\n');
  const keys=header.split(',');
  const rows=lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[keys[i],v])));
  let end=0;
  for (const row of rows) {
    if (+row.record_in_frame!==end || +row.record_out_frame-end!==+row.duration_frames) throw Error('Timeline has a gap or inconsistent duration');
    end=+row.record_out_frame;
  }
  if (end!==4950 || rows.length!==19) throw Error('Expected 19 edits and 4950 frames');
  return rows;
}
export function safeAsset(value) {
  if (typeof value!=='string' || !value.startsWith('assets/') || path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) throw Error('Asset must stay under local assets/');
  return path.join(ROOT,value);
}
export function evidenceCards(e) {
  if(e.schemaVersion!==1 || !Array.isArray(e.turns)) throw Error('Unsupported evidence contract');
  const count = n => Number.isSafeInteger(n)&&n>=0 ? String(n) : 'Unknown';
  const t=e.training??{}, m=e.metrics??{};
  const trainingTurns=t.preparedTrainingTurns;
  const sessions=t.preparedSessions??t.preparedTrainingSessions;
  const holdouts=t.preparedHoldouts??t.preparedHoldoutCases;
  return [
    {title:'Mubit in the loop',kicker:'PRIOR COMPLETED SESSION',rows:[`${count(m.mubitResponses)} Mubit responses`,`${count(m.localFallbackResponses)} local text fallbacks`,`${count(m.providerErrors)} provider errors`],foot:'Historical integration observation · not an adapter evaluation'},
    {title:'A director with boundaries',kicker:'ONE RECURRING DECISION CONTRACT',rows:['Player chooses in their own words','Model proposes dialogue and intent','Game validates evidence and progress'],foot:'Authored realms · committed chapters · factual outcomes'},
    {title:'V2 training is next',kicker:'OFFLINE PREPARATION',rows:[Number.isSafeInteger(trainingTurns)&&Number.isSafeInteger(sessions)?`${trainingTurns} turns / ${sessions} sessions prepared`:'Prepared corpus counts not verified',Number.isSafeInteger(holdouts)?`${holdouts} separate held-out cases`:'Held-out corpus count not verified',`Submitted: ${count(t.submitted)} · kept: ${count(t.kept).toLowerCase()} · target: ${count(t.targetKept)}`],foot:'V2 not trained · no demonstrated small-model savings'}
  ];
}
const labels={C01:['Bring her home.',''],C02:['It starts with a conversation.',''],C03:['Speak your next chapter.','Synthetic player voice · real microphone / STT / NPC response'],C04:['Change your mind.','Typed correction · before chapter commitment'],C05:['Your chapter begins.','Recorded gameplay · authored realm'],C06A:['Ember Keep','Four authored realms · separate recorded views'],C06B:['Sunken Archive','Four authored realms · separate recorded views'],C06C:['Sky Monastery','Four authored realms · separate recorded views'],C06D:['Thornwild','Four authored realms · separate recorded views'],C07:['',''],C08A:['Meet the guardians.','Authored encounter highlights · separate takes'],C08B:['Meet the guardians.','Authored encounter highlights · separate takes'],C10A:['Find her.','Recorded refuge approach'],C10B:['Home together.','Recorded post-reunion state'],C10C:['','']};
const css=`
@font-face{font-family:FilmSerif;src:url('assets/fonts/EBGaramond-400.woff2')}@font-face{font-family:FilmSerif;src:url('assets/fonts/EBGaramond-700.woff2');font-weight:700}
@font-face{font-family:FilmMono;src:url('assets/fonts/JetBrainsMono-400.woff2')}@font-face{font-family:FilmSans;src:url('assets/fonts/Inter-400.woff2')}@font-face{font-family:FilmSans;src:url('assets/fonts/Inter-700.woff2');font-weight:700}
*{box-sizing:border-box;margin:0}#root{position:absolute;inset:0;color:#F0E8D6;font-family:FilmSans;background:#101719;overflow:hidden}
.clip{position:absolute;inset:0}.footage{width:1920px;height:1080px;object-fit:contain;background:#101719}
.caption-box{position:absolute;left:200px;right:200px;bottom:130px;background:#101719;padding:24px 32px;font:34px/1.35 FilmSans;text-align:center}
.lt{position:absolute;left:200px;top:134px;max-width:1500px;padding:20px 30px;background:#101719}.lt-name{font:62px/1.1 FilmSerif}.lt-rule{height:3px;background:#E9AD5A;width:140px;margin:16px 0;transform-origin:0 50%}.lt-role{font:28px/1.35 FilmMono;color:#A7B1AE}
.missing{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:26px;background:#182226;text-align:center;padding:100px}.missing h2{font:58px FilmSerif}.missing p{font:30px FilmMono;color:#E9AD5A}.missing small{font:28px FilmSans;max-width:1300px}
.panel{position:absolute;left:200px;top:150px;width:1520px;padding:58px 64px;background:#101719;border-top:3px solid #8BC9C0}.kicker{font:28px FilmMono;color:#8BC9C0;letter-spacing:2px}.panel h2{font:76px/1.1 FilmSerif;margin:28px 0 48px}.rows{display:flex;flex-direction:column;gap:26px;font:35px/1.3 FilmMono}.foot{font:28px/1.4 FilmSans;color:#A7B1AE;margin-top:52px;max-width:1380px}
.end{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:30px;text-align:center}.end h1{font:700 126px/1 FilmSerif;letter-spacing:9px}.end .tag{font:52px FilmSerif;color:#E9AD5A}.end .product{font:34px FilmSans;margin-top:18px}.end .credit{font:28px FilmSans;color:#A7B1AE;margin-top:68px}
.trace{position:absolute;right:160px;top:310px;width:570px;padding:24px 26px;background:#101719;border-left:3px solid #8BC9C0;font:26px/1.4 FilmMono;white-space:pre-wrap;overflow-wrap:anywhere}.proof-label{position:absolute;left:192px;top:112px;padding:16px 24px;background:#101719;font:28px FilmMono;color:#8BC9C0}.voice-note{position:absolute;left:192px;top:800px;padding:12px 18px;background:#101719;font:26px/1.4 FilmSans;max-width:760px}.music-credit{font:26px FilmSans;color:#A7B1AE;max-width:1600px}
`;
function scene(id,duration,body,animation='',variables=[]) {
  return `<template><style>${css}</style><div id="root" data-composition-id="${id}" data-duration="${duration}" data-width="1920" data-height="1080" data-composition-variables='${esc(JSON.stringify(variables))}'>${body}</div><script>
const tl=gsap.timeline({paused:true});${animation}
tl.addLabel('end',${duration});window.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;
</script></template>`;
}
function lower(id,title,subtitle,duration) {
  if(!title)return ['', ''];
  const end=Math.min(duration,6);
  return [`<div id="${id}-overlay" class="clip" data-start="0" data-duration="${end}" data-track-index="2"><div class="lt"><div id="${id}-name" class="lt-name" data-var-text="headline">${esc(title)}</div><div id="${id}-rule" class="lt-rule"></div>${subtitle?`<div id="${id}-role" class="lt-role">${esc(subtitle)}</div>`:''}</div></div>`, `tl.fromTo('#${id}-name',{y:24,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'},.1);tl.fromTo('#${id}-rule',{scaleX:0},{scaleX:1,duration:.45,ease:'power3.out'},.3);`];
}
function probe(file) {
  const binary=process.env.FFPROBE||'ffprobe';
  return JSON.parse(execFileSync(binary,['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{encoding:'utf8'}));
}
export function checkAssets(rows,captures,e,{strict=false,probeMedia=probe}={}) {
  const issues=[];
  for(const row of rows.filter(r=>r.clip_id.startsWith('C'))){
    const id=row.clip_id, clip=captures.clips?.[id], d=+row.duration_frames/30;
    if(!clip){issues.push(`${id}: missing capture entry`);continue;}
    let file;try{file=safeAsset(clip.path);}catch(error){issues.push(`${id}: ${error.message}`);continue;}
    if(!fs.existsSync(file)){issues.push(`${id}: missing footage ${clip.path}`);continue;}
    if(clip.verified!==true)issues.push(`${id}: footage not verified`);
    if(!Number.isFinite(clip.sourceStartSeconds)||clip.sourceStartSeconds<0)issues.push(`${id}: invalid source offset`);
    if(strict){try{const p=probeMedia(file);if(!p.streams.some(s=>s.codec_type==='video'))issues.push(`${id}: not video`);if(Number(p.format.duration)+.035<clip.sourceStartSeconds+d)issues.push(`${id}: source shorter than required interval`);}catch(error){issues.push(`${id}: media probe failed: ${error.message}`);}}
    if(id==='C07'){
      if(clip.continuous!==true)issues.push('C07: continuous source not verified');
      const turn=e.turns.find(t=>t.clipId==='C07'&&t.requestId===clip.requestId&&t.sessionId===clip.sessionId);
      if(!turn)issues.push('C07: no matching captured request trace');
      else {
        const decision=turn.rawDecision||turn.guardedDecision||turn.decision;
        const responseOffset=turn.eventOffsetsMs?.responseReceived/1000-clip.sourceStartSeconds;
        if(!decision||!turn.transcript||!Number.isFinite(responseOffset)||responseOffset<0||responseOffset>=28)issues.push('C07: incomplete transcript/structured decision or response timing outside proof interval');
        if(!turn.gameOutcome)issues.push('C07: per-turn game outcome not exported');
      }
    }
  }
  const sequence=['C03','C04','C05'].map(id=>captures.clips?.[id]?.sessionId);
  if(sequence.some(x=>!x)||new Set(sequence).size!==1)issues.push('C03–C05: same session not verified');
  if(captures.music){try{if(!fs.existsSync(safeAsset(captures.music.path)))issues.push('Music asset missing');}catch(error){issues.push(error.message);}if(!captures.music.licenseVerified)issues.push('Music license not verified');}
  return issues;
}
export function build({strict=false,evidencePath=path.resolve(ROOT,'../../../../work/film-data/session-evidence.json'),manifestPath=path.join(ROOT,'capture-manifest.json')}={}){
  const rows=readTimeline(), evidence=read(evidencePath), cards=evidenceCards(evidence);
  const captures=fs.existsSync(manifestPath)?read(manifestPath):{clips:{}};
  const issues=checkAssets(rows,captures,evidence,{strict});
  if(strict&&issues.length)throw Error(`Final asset check rejected:\n${issues.join('\n')}`);
  fs.mkdirSync(path.join(ROOT,'compositions'),{recursive:true});
  const hosts=[];
  for(const row of rows){
    const id=row.clip_id,d=+row.duration_frames/30,start=+row.record_in_frame/30;
    let body='',animation='',vars=[];
    if(id.startsWith('C')){
      const clip=captures.clips?.[id];
      const present=clip?.path&&fs.existsSync(safeAsset(clip.path));
      if(present){body=`<video id="${id}-video" class="clip footage" src="${esc(clip.path)}" data-var-src="footage" data-start="0" data-duration="${d}" data-media-start="${clip.sourceStartSeconds??0}" data-playback-rate="1" data-track-index="0" ${clip.audio===false?'muted':'data-has-audio="true" data-volume="0.75"'} playsinline></video>`;vars.push({id:'footage',type:'string',label:'Footage source',default:clip.path});}
      else body=`<div id="${id}-missing" class="clip" data-start="0" data-duration="${d}" data-track-index="0"><div class="missing" data-hold="true"><p>DRAFT · FOOTAGE MISSING · ${id}</p><h2>${esc(labels[id]?.[0]||'Continuous voice → decision → consequence')}</h2><small>This is a production placeholder, not gameplay.</small></div></div>`;
      const [overlay,tween]=lower(id,...(labels[id]??['','']),d);body+=overlay;animation+=tween;
      if(labels[id]?.[0])vars.push({id:'headline',type:'string',label:'Editorial headline',default:labels[id][0]});
      if(id==='C07'){
        const turn=evidence.turns.find(t=>t.clipId===id&&t.requestId===clip?.requestId&&t.sessionId===clip?.sessionId);
        const decision=turn?.rawDecision??turn?.guardedDecision??turn?.decision;
        const label=clip?.continuous&&present?'DECISION REPLAY · REAL TIME · BEFORE ENTRY':'DRAFT · CONTINUOUS PROOF TAKE REQUIRED';
        body+=`<div id="C07-label" class="clip" data-start="0" data-duration="32" data-track-index="2"><div class="proof-label" style="left:112px;width:370px;padding:14px;font-size:23px;line-height:1.4">${label.replace(' · REAL TIME','<br>REAL TIME')}</div><div class="voice-note">Player input: synthetic voice → local STT</div></div>`;
        const offset=turn?.eventOffsetsMs?.responseReceived/1000-(clip?.sourceStartSeconds??0);
        if(decision&&Number.isFinite(offset)&&offset>=0&&offset<28){
          const extract={realm:decision.chapter?.realm,trial:decision.chapter?.trial,mood:decision.mood};
          body+=`<div id="C07-trace" class="clip" data-start="${offset}" data-duration="${Math.min(8,32-offset)}" data-track-index="3"><div class="trace">Validated scene decision\n${esc(JSON.stringify(extract,null,2))}\n${esc(turn.source)} · requested ${esc(turn.providerModel)}\nBackend request: ${esc((turn.latencyMs/1000).toFixed(3))} s\nID …${esc(turn.requestId.slice(-12))}\nProvisional chapter selected</div></div>`;
        }
      }
      if(id==='C10C')body+=`<div id="C10C-label" class="clip" data-start="0" data-duration="4" data-track-index="2"><div class="proof-label" data-layout-allow-caption-zone="true" style="top:900px">Recorded chronicle · page 1 of 2</div></div>`;
      for(const [i,c]of(clip?.captions??[]).entries()){
        if(c.verified!==true||!Number.isFinite(c.start)||!Number.isFinite(c.duration)||c.start<0||c.start+c.duration>d)throw Error(`${id}: invalid or unverified caption`);
        body+=`<div id="${id}-caption-${i}" class="clip" data-start="${c.start}" data-duration="${c.duration}" data-track-index="4"><div class="caption-box" data-layout-allow-caption-zone>${esc(c.text)}</div></div>`;
      }
    } else if(id==='G04'){
      body=`<div id="G04-lockup" class="clip" data-start="0" data-duration="8" data-track-index="1"><div class="end" data-hold="true"><h1 id="G04-title" data-var-text="title">EVERAFTER</h1><p id="G04-tag" class="tag">Bring her home. Your way.</p><p class="product">A bounded narrative director for RPGs.</p><p class="credit">Built for Mubit Night Shift · Minecraft Java prototype</p><p class="music-credit">Music: Uprising — Scott Buckley · CC BY 4.0 · scottbuckley.com.au</p></div></div>`;
      animation=`tl.fromTo('#G04-title',{opacity:0,y:20},{opacity:1,y:0,duration:.75,ease:'power3.out'},0);tl.fromTo('#G04-tag',{opacity:0},{opacity:1,duration:.6},.65);`;
      vars=[{id:'title',type:'string',label:'Film title',default:'EVERAFTER'}];
    }else{
      const c=cards[Number(id.slice(1))-1];
      body=`<div id="${id}-card" class="clip" data-start="0" data-duration="${d}" data-track-index="1"><div class="panel" data-hold="true"><p class="kicker">${esc(c.kicker)}</p><h2 id="${id}-heading" data-var-text="headline">${esc(c.title)}</h2><div class="rows">${c.rows.map((text,i)=>`<p id="${id}-row-${i}">${esc(text)}</p>`).join('')}</div><p class="foot">${esc(c.foot)}</p></div></div>`;
      animation=`tl.fromTo('#${id}-heading',{opacity:0,y:12},{opacity:1,y:0,duration:.45},0);`+c.rows.map((_,i)=>`tl.fromTo('#${id}-row-${i}',{opacity:0,y:12},{opacity:1,y:0,duration:.4},${.35+i*.35});`).join('');
      vars=[{id:'headline',type:'string',label:'Evidence headline',default:c.title}];
    }
    write(`compositions/${id}.html`,scene(id,d,body,animation,vars));
    hosts.push(`<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${d}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`);
  }
  const music=captures.music&&fs.existsSync(safeAsset(captures.music.path))?`<audio id="film-music" class="clip" src="${esc(captures.music.path)}" data-start="0" data-duration="165" data-media-start="${captures.music.sourceStartSeconds??0}" data-track-index="5" data-volume="${captures.music.volume??.14}" data-fade-in="2" data-fade-out="3"></audio>`:'';
  write('index.html',`<!doctype html><html lang="en" data-resolution="landscape"><head><meta charset="utf-8"><meta name="viewport" content="width=1920,height=1080"><title>EVERAFTER · 165-second film</title><script src="assets/vendor/gsap.min.js"></script><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#101719}#root{position:absolute;inset:0}.clip{position:absolute;inset:0}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="165" data-width="1920" data-height="1080" data-fps="30">${hosts.join('\n')}${music}</div><script>const tl=gsap.timeline({paused:true});tl.addLabel('end',165);window.__timelines=window.__timelines||{};window.__timelines.main=tl;</script></body></html>`);
  write('build-status.json',JSON.stringify({schemaVersion:1,durationFrames:4950,edits:19,strict,issues,evidenceCapturedAt:evidence.capturedAt??null,historicalEvidenceScope:evidence.scope?.label??null},null,2)+'\n');
  return {edits:rows.length,frames:4950,issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=build({strict:process.argv.includes('--final')});console.log(JSON.stringify(result,null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
