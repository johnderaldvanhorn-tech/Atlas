(() => {
  const reportView = document.querySelector('#reportsView');
  if (!reportView) return;

  const oldShowView = showView;
  const unique = values => [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const statusSlug = value => String(value || '').toLowerCase().replace(/\s+/g,'-');
  const monthName = index => new Date(Math.floor(index/12), index%12, 1).toLocaleDateString('en-US',{month:'short'}).toUpperCase();
  const fiscalYearForIndex = index => {
    const year=Math.floor(index/12), month=index%12;
    return month>=9 ? year+1 : year;
  };
  const fiscalYearStart = fy => (fy-1)*12+9; // October of prior calendar year
  const quarterStartIndex = (fy,q) => fiscalYearStart(fy)+(q-1)*3;

  function reportStatus(p){
    const e=p.execution||{}, pct=Number(e.percentComplete)||0;
    if(p.status==='Completed'||pct>=100) return 'Completed';
    if(p.status==='On Hold'||e.health==='On Hold') return 'On Hold';
    if(e.health==='Red'||e.health==='Yellow') return 'At Risk';
    if(p.status==='Parking Lot') return 'Parking Lot';
    if(p.status==='Proposed'||(pct===0&&!['Active','Approved'].includes(p.status))) return 'Not Started';
    return 'In Process';
  }

  function projectRange(p){
    if(!/^\d{4}-\d{2}$/.test(p.startDate||'')) return null;
    const [y,m]=p.startDate.split('-').map(Number);
    const start=y*12+m-1;
    return {start,end:start+Math.max(1,calculate(p).months)-1};
  }

  function availableYears(){
    const set=new Set();
    projects.forEach(p=>{
      const r=projectRange(p); if(!r)return;
      for(let i=r.start;i<=r.end;i++) set.add(fiscalYearForIndex(i));
    });
    if(!set.size){const now=new Date();set.add(fiscalYearForIndex(now.getFullYear()*12+now.getMonth()));}
    return [...set].sort((a,b)=>a-b);
  }

  function selectedPeriod(){
    const fy=Number($('#quarterReportYear').value);
    const quarter=$('#quarterReportQuarter').value;
    if(!fy) return null;
    if(quarter==='all') return {fy,quarter:'all',start:fiscalYearStart(fy),months:12,label:`FY${fy}`};
    const q=Number(quarter);
    return {fy,quarter:q,start:quarterStartIndex(fy,q),months:3,label:`FY${fy} Q${q}`};
  }

  function matchesCommonFilters(p, status){
    return ($('#quarterReportDivision').value==='all'||p.division===$('#quarterReportDivision').value) &&
      ($('#quarterReportChampion').value==='all'||(p.champion||'Unassigned')===$('#quarterReportChampion').value) &&
      ($('#quarterReportStatus').value==='all'||status===$('#quarterReportStatus').value);
  }

  function reportList(){
    const period=selectedPeriod(); if(!period)return [];
    const periodEnd=period.start+period.months-1;
    return projects.filter(p=>{
      const status=reportStatus(p);
      if(status==='Parking Lot') return false;
      const r=projectRange(p); if(!r)return false;
      return r.start<=periodEnd && r.end>=period.start && matchesCommonFilters(p,status);
    });
  }

  function parkingLotList(){
    const statusFilter=$('#quarterReportStatus').value;
    if(statusFilter!=='all'&&statusFilter!=='Parking Lot') return [];
    return projects.filter(p=>reportStatus(p)==='Parking Lot'&&matchesCommonFilters(p,'Parking Lot'));
  }

  function initFilters(){
    const years=availableYears(), year=$('#quarterReportYear');
    year.innerHTML=years.map(y=>`<option value="${y}">FY${y}</option>`).join('');
    year.value=String(years.at(-1));
    $('#quarterReportQuarter').innerHTML='<option value="all">All Quarters — Yearly Report</option><option value="1">Q1 — Oct–Dec</option><option value="2">Q2 — Jan–Mar</option><option value="3">Q3 — Apr–Jun</option><option value="4">Q4 — Jul–Sep</option>';
    $('#quarterReportDivision').innerHTML='<option value="all">All</option>'+unique(projects.map(p=>p.division)).map(v=>`<option>${escapeHtml(v)}</option>`).join('');
    $('#quarterReportChampion').innerHTML='<option value="all">All</option>'+unique(projects.map(p=>p.champion||'Unassigned')).map(v=>`<option>${escapeHtml(v)}</option>`).join('');
  }

  function renderReport(){
    const period=selectedPeriod(); if(!period)return;
    const monthIndexes=Array.from({length:period.months},(_,i)=>period.start+i);
    const list=reportList();
    const parking=parkingLotList();
    const periodEnd=period.start+period.months-1;
    const startDate=new Date(Math.floor(period.start/12),period.start%12,1);
    const endDate=new Date(Math.floor(periodEnd/12),(periodEnd%12)+1,0);
    const dateRange=`${startDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} – ${endDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
    const periodWord=period.quarter==='all'?'year':'quarter';

    $('#quarterReportPeriod').textContent=`${period.label} (${dateRange})`;
    $('#quarterReportDescription').textContent=`Overview of project performance, timeline, and status for the selected fiscal ${periodWord}.`;
    $('#quarterReportGenerated').textContent=`Generated: ${new Date().toLocaleString()}`;

    const counts={Completed:0,'In Process':0,'On Hold':0,'At Risk':0,'Not Started':0};
    list.forEach(p=>counts[reportStatus(p)]++);
    const spend=list.reduce((s,p)=>s+calculate(p).totalSpend,0);
    $('#quarterReportKpis').innerHTML=[
      ['total','▣','Total Initiatives',list.length,`in this ${periodWord}`],
      ['completed','✓','Completed',counts.Completed,`${list.length?Math.round(counts.Completed/list.length*100):0}%`],
      ['process','◔','In Process',counts['In Process'],`${list.length?Math.round(counts['In Process']/list.length*100):0}%`],
      ['hold','Ⅱ','On Hold',counts['On Hold'],`${list.length?Math.round(counts['On Hold']/list.length*100):0}%`],
      ['parking','P','Parking Lot',parking.length,'excluded from timeline'],
      ['spend','$','Total Spend',money(spend),`active in this ${periodWord}`]
    ].map(x=>`<div class="quarterKpi ${x[0]}"><div class="quarterKpiIcon">${x[1]}</div><div><span>${x[2]}</span><strong>${x[3]}</strong><small>${x[4]}</small></div></div>`).join('');

    $('#quarterReportHead').innerHTML=`<tr><th rowspan="2">Project</th><th rowspan="2">Division</th><th rowspan="2">Champion</th><th rowspan="2">Status</th><th rowspan="2">Alignment Score</th><th colspan="${period.months}" class="timelineHead">Timeline (${period.label})</th><th rowspan="2">% Complete</th></tr><tr>${monthIndexes.map(i=>`<th>${monthName(i)}</th>`).join('')}</tr>`;

    $('#quarterReportRows').innerHTML=list.map(p=>{
      const c=calculate(p), e=p.execution||{}, status=reportStatus(p), slug=statusSlug(status);
      const pct=status==='Completed'?100:Number(e.percentComplete)||0;
      const r=projectRange(p);
      const left=Math.max(0,(r.start-period.start)/period.months*100);
      const right=Math.min(100,(r.end-period.start+1)/period.months*100);
      const width=Math.max(1.2,right-left);
      const progressEnd=Math.min(right,left+width*(pct/100));
      const align=Math.round((c.alignmentScore||0)*100);
      const alignClass=align>=80?'reportAlignGood':align>=60?'reportAlignWarn':'reportAlignBad';
      return `<tr><td class="projectReportName"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.status)} · ${escapeHtml(typeof categoryLabel==='function'?categoryLabel(p.category):p.category||'')}</small></td><td>${escapeHtml(p.division||'')}</td><td>${escapeHtml(p.champion||'Unassigned')}</td><td><span class="reportStatus ${slug}">${status}</span></td><td class="${alignClass}">${align}%</td><td colspan="${period.months}" class="timelineCell"><i class="reportTimelineTrack" style="left:${left}%;width:${width}%"></i><i class="reportTimelineBar ${slug}" style="left:${left}%;width:${Math.max(0,progressEnd-left)}%"></i><i class="reportTimelineMarker ${slug}" style="left:${Math.max(left,progressEnd)}%"></i></td><td class="${slug==='completed'?'reportAlignGood':slug==='at-risk'?'reportAlignBad':'reportAlignWarn'}"><b>${pct}%</b></td></tr>`;
    }).join('')||`<tr><td colspan="${period.months+6}" class="empty">No projects match the selected year, quarter, and filters.</td></tr>`;

    const parkingSection=$('#parkingLotReportSection');
    parkingSection.classList.toggle('hidden',parking.length===0);
    $('#parkingLotReportCount').textContent=`${parking.length} project${parking.length===1?'':'s'}`;
    $('#parkingLotReportRows').innerHTML=parking.map(p=>{
      const c=calculate(p), align=Math.round((c.alignmentScore||0)*100);
      const alignClass=align>=80?'reportAlignGood':align>=60?'reportAlignWarn':'reportAlignBad';
      return `<tr><td class="projectReportName"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.description||'Deferred project')}</small></td><td>${escapeHtml(p.division||'')}</td><td>${escapeHtml(p.champion||'Unassigned')}</td><td><span class="parkingCategory">${escapeHtml(typeof categoryLabel==='function'?categoryLabel(p.category):p.category||'')}</span></td><td class="${alignClass}">${align}%</td><td><b>${money(c.totalSpend)}</b></td><td>${escapeHtml(p.startDate||'Not scheduled')}</td></tr>`;
    }).join('');

    $('#quarterReportSummaryTitle').textContent=period.quarter==='all'?'Year Summary':'Quarter Summary';
    $('#quarterReportSummary').innerHTML=`<li>${counts.Completed} project${counts.Completed===1?'':'s'} completed during this ${periodWord}</li><li>${counts['In Process']} project${counts['In Process']===1?' is':'s are'} in process</li><li>${counts['On Hold']} project${counts['On Hold']===1?' is':'s are'} on hold</li><li>${counts['At Risk']} project${counts['At Risk']===1?' is':'s are'} at risk</li><li>${parking.length} project${parking.length===1?' is':'s are'} in the parking lot and excluded from the timeline</li><li>Total active investment in this ${periodWord}: ${money(spend)}</li>`;
  }

  function collectExportCss(){
    let css='';
    for(const sheet of [...document.styleSheets]){
      try{css += [...sheet.cssRules].map(rule=>rule.cssText).join('\n')+'\n';}catch(_){/* ignore inaccessible sheets */}
    }
    return css;
  }

  function svgToCanvas(svg,width,height,scale=1.35){
    return new Promise((resolve,reject)=>{
      const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob), image=new Image();
      image.onload=()=>{
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(width*scale); canvas.height=Math.round(height*scale);
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.scale(scale,scale); ctx.drawImage(image,0,0,width,height);
        URL.revokeObjectURL(url); resolve(canvas);
      };
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Unable to render the report PDF.'));};
      image.src=url;
    });
  }

  function dataUrlBytes(dataUrl){
    const binary=atob(dataUrl.split(',')[1]), bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes;
  }

  function makePdf(jpegBytes,imageWidth,imageHeight){
    const pageWidth=1224,pageHeight=792;
    const marginLeft=42,marginRight=42,marginTop=38,marginBottom=38;
    const scale=Math.min((pageWidth-marginLeft-marginRight)/imageWidth,(pageHeight-marginTop-marginBottom)/imageHeight);
    const drawWidth=imageWidth*scale,drawHeight=imageHeight*scale;
    const dx=marginLeft+(pageWidth-marginLeft-marginRight-drawWidth)/2;
    const dy=pageHeight-marginTop-drawHeight;
    const enc=new TextEncoder(),chunks=[],offsets=[0];let size=0;
    const text=value=>{const b=enc.encode(value);chunks.push(b);size+=b.length;};
    const bytes=value=>{chunks.push(value);size+=value.length;};
    const obj=(n,body,stream)=>{offsets[n]=size;text(`${n} 0 obj\n${body}`);if(stream){text('\nstream\n');bytes(stream);text('\nendstream');}text('\nendobj\n');};
    text('%PDF-1.4\n%âãÏÓ\n');
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4,`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,jpegBytes);
    const cmd=enc.encode(`q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm\n/Im0 Do\nQ`);
    obj(5,`<< /Length ${cmd.length} >>`,cmd);
    const xref=size;text('xref\n0 6\n0000000000 65535 f \n');
    for(let i=1;i<=5;i++) text(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks,{type:'application/pdf'});
  }

  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function roundedRect(ctx,x,y,w,h,r,fill,stroke){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }

  function drawText(ctx,text,x,y,maxWidth,opts={}){
    const size=opts.size||14, weight=opts.weight||400, color=opts.color||'#172033', align=opts.align||'left';
    ctx.font=`${weight} ${size}px Arial, sans-serif`; ctx.fillStyle=color; ctx.textAlign=align; ctx.textBaseline='middle';
    const raw=String(text??'');
    if(!maxWidth){ctx.fillText(raw,x,y);return;}
    let out=raw;
    while(out.length>1 && ctx.measureText(out).width>maxWidth) out=out.slice(0,-1);
    if(out!==raw) out=out.slice(0,-1)+'…';
    ctx.fillText(out,x,y);
  }

  function statusColors(status){
    return ({
      'Completed':['#dcfce7','#15803d'],
      'In Process':['#dbeafe','#1d4ed8'],
      'On Hold':['#ffedd5','#c2410c'],
      'At Risk':['#fee2e2','#b91c1c'],
      'Not Started':['#e2e8f0','#475569'],
      'Parking Lot':['#f3e8ff','#7e22ce']
    })[status]||['#e2e8f0','#475569'];
  }

  function drawBadge(ctx,text,x,y,w,h,bg,fg){
    roundedRect(ctx,x,y,w,h,h/2,bg); drawText(ctx,text,x+w/2,y+h/2,w-10,{size:11,weight:700,color:fg,align:'center'});
  }

  async function downloadPdf(){
    const period=selectedPeriod(); if(!period) throw new Error('Select a fiscal year first.');
    const list=reportList(), parking=parkingLotList();
    const months=Array.from({length:period.months},(_,i)=>period.start+i);
    const W=1800, margin=70, headerH=155, kpiH=105, tableHeadH=58, rowH=66;
    const parkingH=parking.length?75+parking.length*54:0;
    const summaryH=150;
    const H=Math.max(1080,margin+headerH+kpiH+tableHeadH+Math.max(1,list.length)*rowH+parkingH+summaryH+margin);
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);

    const periodEnd=period.start+period.months-1;
    const startDate=new Date(Math.floor(period.start/12),period.start%12,1);
    const endDate=new Date(Math.floor(periodEnd/12),(periodEnd%12)+1,0);
    const dateRange=`${startDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} – ${endDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
    const periodWord=period.quarter==='all'?'year':'quarter';

    let y=margin;
    drawText(ctx,'Year / Quarter Report',margin,y+24,null,{size:34,weight:700});
    drawText(ctx,`${period.label} (${dateRange})`,margin,y+64,null,{size:21,weight:700});
    drawText(ctx,`Overview of project performance, timeline, and status for the selected fiscal ${periodWord}.`,margin,y+96,null,{size:15,color:'#64748b'});
    drawText(ctx,`Generated: ${new Date().toLocaleString()}`,W-margin,y+24,null,{size:13,color:'#64748b',align:'right'});
    y+=headerH;

    const counts={Completed:0,'In Process':0,'On Hold':0,'At Risk':0,'Not Started':0}; list.forEach(p=>counts[reportStatus(p)]++);
    const spend=list.reduce((sum,p)=>sum+calculate(p).totalSpend,0);
    const cards=[['Total Initiatives',String(list.length),'#eff6ff','#1E3A8A'],['Completed',String(counts.Completed),'#dcfce7','#16a34a'],['In Process',String(counts['In Process']),'#dbeafe','#1E3A8A'],['On Hold',String(counts['On Hold']),'#ffedd5','#ea580c'],['Parking Lot',String(parking.length),'#f3e8ff','#9333ea'],['Total Spend',money(spend),'#f3e8ff','#9333ea']];
    const gap=14,cw=(W-margin*2-gap*5)/6;
    cards.forEach((c,i)=>{const x=margin+i*(cw+gap);roundedRect(ctx,x,y,cw,kpiH-15,12,'#fff','#dbe3ef');roundedRect(ctx,x+16,y+20,46,46,23,c[2]);drawText(ctx,i===5?'$':i===1?'✓':i===2?'◔':i===3?'Ⅱ':i===4?'P':'▣',x+39,y+43,null,{size:20,weight:700,color:c[3],align:'center'});drawText(ctx,c[0],x+76,y+27,cw-90,{size:13,color:'#475569'});drawText(ctx,c[1],x+76,y+56,cw-90,{size:i===5?22:25,weight:700});});
    y+=kpiH;

    const cols={project:470,division:105,champion:145,status:115,align:110,complete:100};
    const timelineW=W-margin*2-cols.project-cols.division-cols.champion-cols.status-cols.align-cols.complete;
    ctx.fillStyle='#f8fafc';ctx.fillRect(margin,y,W-margin*2,tableHeadH);
    let x=margin;
    [['PROJECT',cols.project],['DIVISION',cols.division],['CHAMPION',cols.champion],['STATUS',cols.status],['ALIGNMENT',cols.align]].forEach(([t,w])=>{drawText(ctx,t,x+8,y+tableHeadH/2,w-16,{size:12,weight:700,color:'#475569'});x+=w;});
    drawText(ctx,`TIMELINE (${period.label})`,x+timelineW/2,y+15,timelineW,{size:12,weight:700,color:'#475569',align:'center'});
    months.forEach((m,i)=>drawText(ctx,monthName(m),x+(i+.5)*timelineW/period.months,y+40,timelineW/period.months,{size:11,weight:700,color:'#475569',align:'center'}));
    x+=timelineW;drawText(ctx,'% COMPLETE',x+cols.complete/2,y+tableHeadH/2,cols.complete,{size:12,weight:700,color:'#475569',align:'center'});
    y+=tableHeadH;

    list.forEach((p,idx)=>{
      if(idx%2){ctx.fillStyle='#fbfdff';ctx.fillRect(margin,y,W-margin*2,rowH);} ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(margin,y+rowH);ctx.lineTo(W-margin,y+rowH);ctx.stroke();
      const c=calculate(p), status=reportStatus(p), pct=status==='Completed'?100:Number(p.execution?.percentComplete)||0, r=projectRange(p), align=Math.round((c.alignmentScore||0)*100);
      x=margin;drawText(ctx,p.name,x+8,y+23,cols.project-16,{size:14,weight:700});drawText(ctx,`${p.status} · ${typeof categoryLabel==='function'?categoryLabel(p.category):p.category||''}`,x+8,y+46,cols.project-16,{size:11,color:'#64748b'});x+=cols.project;
      drawText(ctx,p.division||'',x+8,y+rowH/2,cols.division-16,{size:13});x+=cols.division;
      drawText(ctx,p.champion||'Unassigned',x+8,y+rowH/2,cols.champion-16,{size:13});x+=cols.champion;
      const [bg,fg]=statusColors(status);drawBadge(ctx,status,x+6,y+20,cols.status-12,27,bg,fg);x+=cols.status;
      drawText(ctx,`${align}%`,x+cols.align/2,y+rowH/2,cols.align,{size:14,weight:700,color:align>=80?'#15803d':align>=60?'#b45309':'#b91c1c',align:'center'});x+=cols.align;
      months.forEach((_,i)=>{ctx.strokeStyle='#e5e7eb';ctx.beginPath();ctx.moveTo(x+i*timelineW/period.months,y);ctx.lineTo(x+i*timelineW/period.months,y+rowH);ctx.stroke();});
      if(r){const left=Math.max(0,(r.start-period.start)/period.months*timelineW), right=Math.min(timelineW,(r.end-period.start+1)/period.months*timelineW), full=Math.max(8,right-left), progress=Math.max(status==='Not Started'?0:8,full*pct/100);roundedRect(ctx,x+left,y+28,full,10,5,'#e6edf8');if(progress>0)roundedRect(ctx,x+left,y+28,Math.min(full,progress),10,5,fg);ctx.beginPath();ctx.arc(x+left+Math.min(full,progress),y+33,6,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=fg;ctx.stroke();ctx.lineWidth=1;}
      x+=timelineW;drawText(ctx,`${pct}%`,x+cols.complete/2,y+rowH/2,cols.complete,{size:14,weight:700,color:pct===100?'#15803d':status==='At Risk'?'#b91c1c':'#b45309',align:'center'});
      y+=rowH;
    });
    if(!list.length){drawText(ctx,'No projects match the selected period and filters.',W/2,y+rowH/2,null,{size:16,color:'#64748b',align:'center'});y+=rowH;}

    if(parking.length){y+=20;drawText(ctx,'Parking Lot Initiatives',margin,y+20,null,{size:20,weight:700});drawText(ctx,'Deferred initiatives are excluded from the active delivery timeline.',margin,y+48,null,{size:13,color:'#64748b'});y+=65;
      parking.forEach((p,idx)=>{if(idx%2){ctx.fillStyle='#fcfaff';ctx.fillRect(margin,y,W-margin*2,54);}ctx.strokeStyle='#e2e8f0';ctx.strokeRect(margin,y,W-margin*2,54);drawText(ctx,p.name,margin+12,y+27,520,{size:13,weight:700});drawBadge(ctx,'Parking Lot',margin+545,y+14,105,26,'#f3e8ff','#7e22ce');drawText(ctx,p.division||'',margin+680,y+27,130,{size:12});drawText(ctx,p.champion||'Unassigned',margin+850,y+27,180,{size:12});drawText(ctx,`${Math.round((calculate(p).alignmentScore||0)*100)}%`,margin+1090,y+27,80,{size:13,weight:700});drawText(ctx,money(calculate(p).totalSpend),W-margin-10,y+27,170,{size:13,weight:700,align:'right'});y+=54;});
    }

    y+=28;roundedRect(ctx,margin,y,(W-margin*2-18)/2,112,12,'#f8fafc','#e2e8f0');roundedRect(ctx,margin+(W-margin*2-18)/2+18,y,(W-margin*2-18)/2,112,12,'#f8fafc','#e2e8f0');
    drawText(ctx,'STATUS LEGEND',margin+18,y+23,null,{size:12,weight:700,color:'#475569'});
    let lx=margin+18;[['Completed'],['In Process'],['On Hold'],['At Risk'],['Not Started']].forEach(([st])=>{const [b,f]=statusColors(st);drawBadge(ctx,st,lx,y+47,108,25,b,f);lx+=125;});
    const sx=margin+(W-margin*2-18)/2+36;drawText(ctx,period.quarter==='all'?'YEAR SUMMARY':'QUARTER SUMMARY',sx,y+23,null,{size:12,weight:700,color:'#475569'});drawText(ctx,`${counts.Completed} completed · ${counts['In Process']} in process · ${counts['On Hold']} on hold · ${counts['At Risk']} at risk · ${parking.length} parked`,sx,y+53,(W-margin*2-18)/2-36,{size:13});drawText(ctx,`Total active investment: ${money(spend)}`,sx,y+82,null,{size:14,weight:700});

    const jpeg=canvas.toDataURL('image/jpeg',0.94);
    const label=(period.label||'project-report').toLowerCase().replace(/\s+/g,'-');
    downloadBlob(makePdf(dataUrlBytes(jpeg),canvas.width,canvas.height),`${label}-project-report.pdf`);
  }

  showView=function(v){
    oldShowView(v);
    if(v==='reports'){
      $('#pageTitle').textContent='Reports';
      $('#pageSubtitle').textContent='Yearly and quarterly project performance, timeline, and status reporting.';
      $('#newProject').classList.add('hidden');
      renderReport();
    }
  };

  initFilters();
  ['quarterReportYear','quarterReportQuarter','quarterReportDivision','quarterReportChampion','quarterReportStatus'].forEach(id=>$('#'+id).onchange=renderReport);
  $('#clearQuarterReportFilters').onclick=()=>{
    $('#quarterReportQuarter').value='all';
    $('#quarterReportDivision').value=$('#quarterReportChampion').value=$('#quarterReportStatus').value='all';
    renderReport();
  };
  $('#downloadQuarterReportPdf').onclick=async()=>{const b=$('#downloadQuarterReportPdf');b.disabled=true;const old=b.textContent;b.textContent='Preparing PDF…';try{await downloadPdf();}catch(e){console.error(e);alert(e.message||'PDF download failed.');}finally{b.disabled=false;b.textContent=old;}};
  renderReport();
})();
