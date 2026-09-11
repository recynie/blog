// Plotly preview and exported frames share trace data and view settings.
import {loadPlotly, figure, setFrame} from "./plot.js";
const D = JSON.parse(document.querySelector('#data').textContent);
const app = document.querySelector('#app');
app.innerHTML = `<style>
body{margin:0;font:14px system-ui;color:#23354b}#plot{width:100%;height:560px}#plot.locked{pointer-events:none}button,select,input{box-sizing:border-box;margin:5px;padding:6px}button{cursor:pointer}#status{min-height:24px}a{margin:12px}input[type=range]{width:95%}.note{color:#536378}
</style><div id="plot" aria-label="True MSE and blended loss landscape"></div>
<div><button id="play">▶ Play</button><button id="pause">Pause</button><button id="reset">Reset</button>
<select id="view" aria-label="Landscape view"><option value="2d">2D heatmap</option><option value="3d">3D surface</option></select><output id="clock"></output></div>
<input id="time" aria-label="Training step" type="range" min="0" max="${D.losses.length-1}" value="0" step="1">
<div class="note">2D: drag to zoom; use the toolbar to pan or reset. 3D: drag to rotate; scroll to zoom. Hover for values. Export preserves the current ranges and camera. Ball height = interpolated blended loss + display offset.</div>
<div><label>Export frames <input id="frames" type="number" min="2" max="240" value="80"></label><label>FPS <input id="fps" type="number" min="1" max="30" value="15"></label>
<button id="gif">Export GIF</button><button id="mp4">Export MP4</button><button id="cancel" disabled>Cancel export</button></div>
<progress id="progress" max="1" value="0"></progress><div id="status" role="status">Ready</div><div id="downloads"></div>`;
const $ = id => document.getElementById(id);
const Plotly = await loadPlotly(), plot = $('plot');
let step=0, playing=false, view='2d';
let encoder=null, generation=0, busy=false, urls=[];
const N=D.losses.length-1;
let compact = window.innerWidth < 600;
const previewFigure = (selected, t) => figure(D, selected, t, compact);
const config={responsive:true,scrollZoom:true,displaylogo:false,toImageButtonOptions:{format:'png',width:1100,height:560}};
const savedViews={};
let renderQueue=Promise.resolve(), pendingFrame=null, frameScheduled=false;
const clone = value => JSON.parse(JSON.stringify(value));
function snapshotLayout() {
 const layout=clone(plot.layout);
 for(const key of ['xaxis','yaxis','xaxis2','yaxis2']) {
  if(plot._fullLayout[key])layout[key]={...layout[key],range:clone(plot._fullLayout[key].range),autorange:false};
 }
 if(view==='3d')layout.scene.camera=clone(plot._fullLayout.scene.camera);
 return layout;
}
function enqueue(fn) {
 renderQueue=renderQueue.then(fn).catch(e=>{playing=false;$('status').textContent=`Plot failed: ${e.message}`;console.error(e);});
 return renderQueue;
}
function update(t){
 step=Math.max(0,Math.min(N,Math.round(t)));
 $('time').value=step;$('clock').textContent=`Step ${step} / ${N}`;
 pendingFrame=step;
 if(frameScheduled)return renderQueue;
 frameScheduled=true;
 return enqueue(async()=>{
  try {
   while(pendingFrame!==null){
    const frame=pendingFrame;pendingFrame=null;
    await setFrame(Plotly,plot,D,view,frame);
   }
  } finally {frameScheduled=false;}
 });
}
async function animate(){
 if(playing&&!busy){await update(step+1);if(step===N)playing=false;}
 setTimeout(animate,1000/30);
}
$('play').onclick=()=>{if(step===N)update(0);playing=true;};
$('pause').onclick=()=>playing=false;
$('reset').onclick=()=>{playing=false;update(0);};
$('time').oninput=e=>{playing=false;update(+e.target.value);};
$('view').onchange=e=>{
 playing=false;
 const selected=e.target.value;
 enqueue(async()=>{
  savedViews[view]=snapshotLayout();view=selected;
  const f=previewFigure(view,step);
  const layout=savedViews[view] || f.layout;
  layout.title=f.layout.title;
  await Plotly.react(plot,f.data,layout,config);
 });
};
function controls(disabled){busy=disabled;plot.classList.toggle('locked',disabled);for(const id of ['play','pause','reset','time','view','gif','mp4','frames','fps'])$(id).disabled=disabled;$('cancel').disabled=!disabled;}
function clearDownloads(){urls.forEach(URL.revokeObjectURL);urls=[];$('downloads').replaceChildren();}
$('cancel').onclick=()=>{generation++;encoder?.terminate();encoder=null;controls(false);$('status').textContent='Export cancelled. Retry with either export button.';};
async function encode(format){
 const count=+$('frames').value,fps=+$('fps').value;
 if(!Number.isInteger(count)||count<2||count>240||!Number.isInteger(fps)||fps<1||fps>30){$('status').textContent='Invalid export: frames must be 2–240, FPS 1–30 (integers).';return;}
 playing=false;controls(true);clearDownloads();const ticket=++generation;let worker,exportPlot,log='';
 try{
  await renderQueue;
  if(ticket!==generation)return;
  const selected=view, layout=snapshotLayout();
  exportPlot=document.createElement('div');
  exportPlot.style.cssText='position:fixed;left:-12000px;top:0;width:1100px;height:560px';
  document.body.append(exportPlot);
  await Plotly.newPlot(exportPlot,clone(plot.data),{...layout,width:1100,height:560,autosize:false},{staticPlot:true,displayModeBar:false});
  if(ticket!==generation)return;
  $('status').textContent='Loading ffmpeg.wasm (about 32 MB on first use)…';$('progress').value=0;
  const {FFmpeg}=await import('./ffmpeg/ffmpeg/index.js');
  if(ticket!==generation)return;
  worker=new FFmpeg();encoder=worker;
  worker.on('log',e=>log=e.message);
  worker.on('progress',e=>{if(ticket===generation)$('progress').value=.35+.65*Math.max(0,Math.min(1,e.progress));});
  await worker.load({coreURL:new URL('./ffmpeg/core/ffmpeg-core.js',import.meta.url).href,wasmURL:new URL('./ffmpeg/core/ffmpeg-core.wasm',import.meta.url).href});
  const indices=Array.from({length:count},(_,i)=>Math.round(i*N/(count-1)));
  for(let i=0;i<count;i++){
   if(ticket!==generation)return;
   await setFrame(Plotly,exportPlot,D,selected,indices[i]);
   const image=await Plotly.toImage(exportPlot,{format:'png',width:1100,height:560});
   const blob=await (await fetch(image)).blob();
   if(ticket!==generation)return;
   await worker.writeFile(`frame-${String(i).padStart(4,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
   $('status').textContent=`Rendering ${i+1}/${count} · Step ${indices[i]}/${N}`;$('progress').value=.35*(i+1)/count;
  }
  $('status').textContent=`Encoding ${format.toUpperCase()} with ffmpeg.wasm…`;
  const args=['-framerate',String(fps),'-i','frame-%04d.png','-frames:v',String(count)];
  if(format==='mp4')args.push('-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-threads','1','-movflags','+faststart');
  else args.push('-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0','-threads','1');
  args.push(`output.${format}`);
  const code=await worker.exec(args);
  if(code!==0)throw new Error(`FFmpeg ${code}: ${log}`);
  const bytes=await worker.readFile(`output.${format}`);
  if(ticket!==generation)return;
  const url=URL.createObjectURL(new Blob([bytes],{type:format==='mp4'?'video/mp4':'image/gif'}));urls.push(url);
  const a=document.createElement('a');a.href=url;a.download=`sticky-${view}.${format}`;a.textContent=`Download ${format.toUpperCase()} (${(bytes.length/1e6).toFixed(2)} MB)`;$('downloads').append(a);
  $('status').textContent=`${format.toUpperCase()} ready · ${count} frames · steps 0–${N} · ${(count/fps).toFixed(2)} s`;$('progress').value=1;
 }catch(e){if(ticket===generation){console.error(e);$('status').textContent=`Export failed: ${e.message}. Check HTTP(S) assets or reduce frame count, then retry.`;}}
 finally{worker?.terminate();if(exportPlot){Plotly.purge(exportPlot);exportPlot.remove();}if(ticket===generation){encoder=null;controls(false);}}
}
$('gif').onclick=()=>encode('gif');$('mp4').onclick=()=>encode('mp4');
window.addEventListener('pagehide',()=>{generation++;encoder?.terminate();clearDownloads();});
const initial=previewFigure(view,0);
plot.style.height = `${initial.layout.height}px`;
await Plotly.newPlot(plot,initial.data,initial.layout,config);
await update(0);animate();
window.addEventListener('resize', () => {
 const next = window.innerWidth < 600;
 if (next === compact || busy) return;
 compact = next;
 enqueue(async () => {
  for (const key of Object.keys(savedViews)) delete savedViews[key];
  const f = previewFigure(view,step);
  plot.style.height = `${f.layout.height}px`;
  await Plotly.react(plot,f.data,f.layout,config);
 });
});
