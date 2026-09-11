// Interactive loss landscape with synchronized training steps and view settings.
import {loadPlotly, figure, setFrame} from "./plot.js";
const D = JSON.parse(document.querySelector('#data').textContent);
const app = document.querySelector('#app');
app.innerHTML = `<style>
body{margin:0;font:14px system-ui;color:#23354b}#plot{width:100%;height:560px}button,select{margin:5px;padding:6px}button{cursor:pointer}#status{min-height:24px}input[type=range]{width:95%}.note{color:#536378}
</style><div id="plot" aria-label="True MSE and blended loss landscape"></div>
<div><button id="play">▶ Play</button><button id="pause">Pause</button><button id="reset">Reset</button>
<select id="view" aria-label="Landscape view"><option value="2d">2D heatmap</option><option value="3d">3D surface</option></select><output id="clock"></output></div>
<input id="time" aria-label="Training step" type="range" min="0" max="${D.losses.length-1}" value="0" step="1">
<div class="note">2D: drag to zoom; use the toolbar to pan or reset. 3D: drag to rotate; scroll to zoom. Hover for values. Ball height = interpolated blended loss + display offset.</div>
<div id="status" role="status">Ready</div>`;
const $ = id => document.getElementById(id);
const Plotly = await loadPlotly(), plot = $('plot');
let step=0, playing=false, view='2d';
const N=D.losses.length-1;
let compact = window.innerWidth < 600;
const previewFigure = (selected, t) => figure(D, selected, t, compact);
const config={responsive:true,scrollZoom:true,displaylogo:false,modeBarButtonsToRemove:['toImage']};
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
 if(playing){await update(step+1);if(step===N)playing=false;}
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
const initial=previewFigure(view,0);
plot.style.height = `${initial.layout.height}px`;
await Plotly.newPlot(plot,initial.data,initial.layout,config);
await update(0);animate();
window.addEventListener('resize', () => {
 const next = window.innerWidth < 600;
 if (next === compact) return;
 compact = next;
 enqueue(async () => {
  for (const key of Object.keys(savedViews)) delete savedViews[key];
  const f = previewFigure(view,step);
  plot.style.height = `${f.layout.height}px`;
  await Plotly.react(plot,f.data,f.layout,config);
 });
});
