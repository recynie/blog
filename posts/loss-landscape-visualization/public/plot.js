// Plotly traces for the interactive loss landscape.
export async function loadPlotly() {
  if (window.Plotly) return window.Plotly;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./plotly/plotly.min.js', import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load same-origin Plotly assets'));
    document.head.append(script);
  });
  return window.Plotly;
}
export function figure(D, view, t, compact = false) {
  const N = D.losses.length - 1;
  const x = D.pc.map(p => p[0]), y = D.pc.map(p => p[1]);
  const values = D.grid.flat(), lo = Math.min(...values), hi = Math.max(...values);
  const z = D.heights.map(h => h + .03 * Math.max(hi-lo, 1e-12));
  const steps = D.losses.map((_, i) => i);
  const displayedLoss = D.losses.map(value => Math.max(value, 1e-16));
  const data = [
    {type:'scatter', x:steps, y:displayedLoss, customdata:D.losses, mode:'lines', name:'True MSE', line:{color:'#226cca'}, hovertemplate:'Step %{x}<br>MSE %{customdata:.5g}<extra></extra>'},
    {type:'scatter', x:[t], y:[displayedLoss[t]], customdata:[D.losses[t]], mode:'markers', name:'Current step', marker:{color:'#ef354b', size:11, line:{color:'white',width:2}}, hovertemplate:'Step %{x}<br>MSE %{customdata:.5g}<extra></extra>'},
  ];
  const heat = {colorscale:'Viridis', colorbar:{title:{text:'Blended loss'}, x:1.01, len:.85}, showscale:true, name:'Blended loss'};
  const path = {mode:'lines', name:'Full trajectory', line:{color:'#aaa',width:2}, showlegend:true};
  const trail = {mode:'lines', name:'Traversed trajectory', line:{color:'#ef6274',width:4}, showlegend:true};
  const point = {mode:'markers', name:'Current position', marker:{color:'#ef354b',size:view==='3d'?5:11}, showlegend:false};
  if (view === '2d') {
    data.push({type:'heatmap',x:D.axisX,y:D.axisY,z:D.grid,xaxis:'x2',yaxis:'y2',...heat, hovertemplate:'PC1 %{x:.4g}<br>PC2 %{y:.4g}<br>Blended loss %{z:.5g}<extra></extra>'});
    for (const [style, xx, yy] of [[path,x,y],[trail,x.slice(0,t+1),y.slice(0,t+1)],[point,[x[t]],[y[t]]]])
      data.push({type:'scatter',xaxis:'x2',yaxis:'y2',x:xx,y:yy,...style,hovertemplate:'PC1 %{x:.4g}<br>PC2 %{y:.4g}<extra></extra>'});
  } else {
    data.push({type:'surface',x:D.axisX,y:D.axisY,z:D.grid,...heat, hovertemplate:'PC1 %{x:.4g}<br>PC2 %{y:.4g}<br>Blended loss %{z:.5g}<extra></extra>'});
    for (const [style, xx, yy, zz] of [[path,x,y,z],[trail,x.slice(0,t+1),y.slice(0,t+1),z.slice(0,t+1)],[point,[x[t]],[y[t]],[z[t]]]])
      data.push({type:'scatter3d',x:xx,y:yy,z:zz,...style,hovertemplate:'PC1 %{x:.4g}<br>PC2 %{y:.4g}<br>Display height %{z:.5g}<extra></extra>'});
  }
  const layout = {
    title:{text:`Seeing sticky plateau · f(x) = ${D.config.task}<br><sup>Step ${t} / ${N} · True MSE ${D.losses[t].toExponential(4)}</sup>`,x:.04},
    font:{family:'system-ui, sans-serif',color:'#23354b'},paper_bgcolor:'white',plot_bgcolor:'white',
    margin:{l:75,r:100,t:105,b:95},height:560, dragmode:'zoom', uirevision:view,
    legend:{orientation:'h',x:0,y:-.18},
    xaxis:{domain:[0,.43],title:{text:'Training step'},range:[0,N]},
    yaxis:{title:{text:'True training MSE'},type:'log',autorange:true},
    annotations:[{text:'True training MSE (log scale)',x:.20,y:1.08,xref:'paper',yref:'paper',showarrow:false},
      {text:`Blended local-plane loss · ${view.toUpperCase()}`,x:.80,y:1.08,xref:'paper',yref:'paper',showarrow:false}],
  };
  if (view==='2d') Object.assign(layout, {
    xaxis2:{domain:[.57,1],anchor:'y2',title:{text:'PC1'},range:[D.axisX[0],D.axisX.at(-1)]},
    yaxis2:{anchor:'x2',title:{text:'PC2'},range:[D.axisY[0],D.axisY.at(-1)]},
  });
  else layout.scene={domain:{x:[.55,1],y:[0,1]},xaxis:{title:{text:'PC1'}},yaxis:{title:{text:'PC2'}},zaxis:{title:{text:'Blended loss'}},aspectmode:'cube',dragmode:'orbit',camera:{eye:{x:1.6,y:1.6,z:1.3}}};
  // Article adaptation: stack the panels on phones, keeping both axes readable.
  if (compact) {
    layout.height = 760;
    layout.font.size = 11;
    layout.margin = {l:60,r:65,t:105,b:115};
    layout.title.font = {size:13};
    layout.xaxis.domain = [0,1];
    layout.yaxis.domain = [.65,1];
    layout.legend = {orientation:'h',x:0,y:-.14,font:{size:10}};
    layout.annotations[0] = {...layout.annotations[0],x:.5,y:1.06};
    layout.annotations[1] = {...layout.annotations[1],x:.5,y:.51};
    data[2].colorbar = {...data[2].colorbar,len:.43,y:.215,thickness:12};
    if (view === '2d') {
      layout.xaxis2.domain = [0,1];
      layout.yaxis2.domain = [0,.43];
    } else {
      layout.scene.domain = {x:[0,1],y:[0,.43]};
    }
  }
  return {data,layout};
}
export async function setFrame(Plotly, plot, D, view, t) {
  const next = figure(D, view, t);
  const ids=[1,4,5];
  const update={x:ids.map(i=>next.data[i].x),y:ids.map(i=>next.data[i].y),customdata:ids.map(i=>next.data[i].customdata || [])};
  if(view==='3d')update.z=ids.map(i=>next.data[i].z || []);
  await Plotly.restyle(plot,update,ids);
  await Plotly.relayout(plot,{'title.text':next.layout.title.text});
}
