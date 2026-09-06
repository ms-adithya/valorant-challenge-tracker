// Shared line-chart SVG renderer.
function lineSVG(values, format=v=>v.toFixed(1), labels=null, overlay=null, options=null){
 const pairs=values.map((v,i)=>({v:(v===null||v===undefined||v==="")?NaN:Number(v),label:Number(labels?.[i]??(i+1))})).filter(x=>Number.isFinite(x.v)&&Number.isFinite(x.label));
 const overlayPairs=(overlay?.values||[]).map((v,i)=>({v:(v===null||v===undefined||v==="")?NaN:Number(v),label:Number(labels?.[i]??(i+1))})).filter(x=>Number.isFinite(x.v)&&Number.isFinite(x.label));
 const clean=[...pairs.map(x=>x.v),...overlayPairs.map(x=>x.v)],w=720,h=220,pl=54,pr=18,pt=22,pb=34;
 if(!pairs.length)return '<div class="empty chart-empty">No chart data yet.</div>';
 let min=Math.min(...clean),max=Math.max(...clean);
 // RR progression is cumulative net change, so zero is a meaningful reference point.
 // Include it in the domain rather than allowing auto-scaling to hide the baseline.
 if(options?.zeroBaseline){min=Math.min(min,0);max=Math.max(max,0)}
 if(min===max){min-=1;max+=1}
 const pad=(max-min)*.12||1;min-=pad;max+=pad;
 const allLabels=[...pairs,...overlayPairs].map(x=>x.label),minLabel=Math.min(...allLabels),maxLabel=Math.max(...allLabels);
 const x=label=>minLabel===maxLabel?(pl+w-pr)/2:pl+(label-minLabel)*(w-pl-pr)/(maxLabel-minLabel),y=v=>pt+(max-v)*(h-pt-pb)/(max-min);
 const pts=pairs.map(p=>`${x(p.label)},${y(p.v)}`).join(' '),gid='g'+Math.random().toString(36).slice(2,8);
 const smoothPath=ps=>{if(!ps.length)return '';const xy=ps.map(p=>[x(p.label),y(p.v)]);if(xy.length===1)return `M ${xy[0][0]} ${xy[0][1]}`;let d=`M ${xy[0][0]} ${xy[0][1]}`;for(let i=1;i<xy.length-1;i++){const mx=(xy[i][0]+xy[i+1][0])/2,my=(xy[i][1]+xy[i+1][1])/2;d+=` Q ${xy[i][0]} ${xy[i][1]} ${mx} ${my}`}d+=` Q ${xy.at(-1)[0]} ${xy.at(-1)[1]} ${xy.at(-1)[0]} ${xy.at(-1)[1]}`;return d};
 const hasZeroBaseline=Boolean(options?.zeroBaseline&&min<=0&&max>=0),zeroY=hasZeroBaseline?y(0):null;
 let grid='';for(let i=0;i<5;i++){const yy=pt+i*(h-pt-pb)/4,val=max-i*(max-min)/4;const nearZero=hasZeroBaseline&&Math.abs(yy-zeroY)<14;grid+=`<line class="chart-grid-line" x1="${pl}" y1="${yy}" x2="${w-pr}" y2="${yy}"/>${nearZero?'':`<text class="chart-axis-label" x="${pl-10}" y="${yy+4}" text-anchor="end">${format(val)}</text>`}`}
 // For cumulative RR, zero is the semantic baseline. Fill gain/loss area to zero, not to the chart floor.
 const areaBaseY=hasZeroBaseline?zeroY:(h-pb);
 const area=`${x(pairs[0].label)},${areaBaseY} ${pts} ${x(pairs.at(-1).label)},${areaBaseY}`;
 const zeroBaseline=hasZeroBaseline?`<line class="chart-zero-line" x1="${pl}" y1="${zeroY}" x2="${w-pr}" y2="${zeroY}"/><text class="chart-zero-label" x="${pl-10}" y="${zeroY+4}" text-anchor="end">0</text>`:'';
 const overlaySvg=overlayPairs.length?`<path class="chart-average-path" d="${smoothPath(overlayPairs)}"/>${overlayPairs.map(p=>`<circle class="chart-average-point" cx="${x(p.label)}" cy="${y(p.v)}" r="3"><title>Match #${p.label} · ${overlay?.label||"Average"}: ${format(p.v)}</title></circle>`).join('')}`:'';
 return `<svg class="modern-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Match trend from match ${minLabel} to ${maxLabel}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef5360" stop-opacity=".28"/><stop offset="1" stop-color="#ef5360" stop-opacity="0"/></linearGradient></defs>${grid}${zeroBaseline}<polygon points="${area}" fill="url(#${gid})"/><polyline class="chart-path" points="${pts}"/>${overlaySvg}${pairs.map(p=>`<circle class="chart-point" cx="${x(p.label)}" cy="${y(p.v)}" r="4" tabindex="0"><title>Match #${p.label}: ${format(p.v)}</title></circle>`).join('')}<text class="chart-x-label" x="${pl}" y="${h-8}">MATCH ${minLabel}</text><text class="chart-x-label" x="${w-pr}" y="${h-8}" text-anchor="end">MATCH ${maxLabel}</text></svg>`;
}
