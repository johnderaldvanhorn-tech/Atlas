(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
  const number=v=>new Intl.NumberFormat('en-US').format(Number(v)||0);
  const storeKey='atlas.executiveReport.v1';
  const completeStatuses=['closed','done','completed','complete','released','deployed'];
  const riskWords=['blocked','at risk','critical','high priority'];

  function fyForDate(value){
    if(!value)return null;
    const d=new Date(`${String(value).slice(0,10)}T12:00:00`); if(Number.isNaN(d.getTime()))return null;
    return d.getMonth()>=9?d.getFullYear()+1:d.getFullYear();
  }
  function fiscalPeriod(fy,q){
    const starts={1:[fy-1,9],2:[fy,0],3:[fy,3],4:[fy,6]};
    if(q==='all')return {start:new Date(fy-1,9,1),end:new Date(fy,9,0),label:`Fiscal Year ${fy}`};
    const [y,m]=starts[Number(q)];return {start:new Date(y,m,1),end:new Date(y,m+3,0),label:`FY${fy} Q${q}`};
  }
  function nextPeriod(fy,q){
    if(q==='all')return fiscalPeriod(fy+1,'1');
    const n=Number(q);return n===4?fiscalPeriod(fy+1,'1'):fiscalPeriod(fy,String(n+1));
  }
  function itemDate(item,field){const v=item?.[field];if(!v)return null;const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?null:d;}
  function isComplete(item){return completeStatuses.includes(String(item.status||'').trim().toLowerCase());}
  function inRange(d,p){return d&&d>=p.start&&d<=p.end;}
  function formatDate(v){const d=itemDate({v},'v');return d?d.toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';}
  function availableYears(){
    const years=new Set([new Date().getMonth()>=9?new Date().getFullYear()+1:new Date().getFullYear()]);
    (window.projects||[]).forEach(p=>{const y=fyForDate(p.startDate);if(y)years.add(y)});
    (window.developmentItems||[]).forEach(i=>{const y=fyForDate(i.start_date||i.end_date);if(y)years.add(y)});
    return [...years].sort((a,b)=>b-a);
  }
  function loadSettings(){try{return JSON.parse(localStorage.getItem(storeKey)||'{}')}catch{return {}}}
  function saveSettings(){
    const data={currentMrr:Number($('#executiveCurrentMrr').value)||0,priorMrr:Number($('#executivePriorMrr').value)||0,connections:Number($('#executiveConnections').value)||0};
    localStorage.setItem(storeKey,JSON.stringify(data));render();
  }
  function syncYears(){
    const el=$('#executiveReportYear');if(!el)return;const old=el.value;el.innerHTML=availableYears().map(y=>`<option value="${y}">FY ${y}</option>`).join('');if([...el.options].some(o=>o.value===old))el.value=old;
  }
  function deliverableHtml(i,kind=''){
    const meta=[i.department,i.release,i.status].filter(Boolean).join(' · ');
    const date=i.end_date||i.start_date;
    return `<div class="executiveDeliverable ${kind}"><i></i><div><strong>${esc(i.title||'Untitled development item')}</strong><small>${esc(meta||i.area||'Software development')}</small></div><em>${esc(formatDate(date))}</em></div>`;
  }

  function milestoneGroupName(item){
    return String(
      item.area
      || item.source_line
      || item.release
      || item.department
      || 'Other Software'
    ).trim();
  }

  function milestoneTheme(title){
    const value=String(title||'').toLowerCase();

    if(value.includes('bug') || value.includes('error') || value.includes('fix')){
      return 'Reliability and defect corrections';
    }

    if(value.includes('import') || value.includes('export') || value.includes('report')){
      return 'Data import, export, and reporting improvements';
    }

    if(value.includes('heartbeat') || value.includes('firmware') || value.includes('device')){
      return 'Device, firmware, and fleet-management updates';
    }

    if(value.includes('account') || value.includes('employee') || value.includes('customer')){
      return 'Account and customer-management improvements';
    }

    if(value.includes('inventory') || value.includes('planogram')){
      return 'Inventory and planogram workflow improvements';
    }

    if(value.includes('ui') || value.includes('keypad') || value.includes('touchscreen')){
      return 'User-interface and device-interaction improvements';
    }

    return 'Feature and platform enhancements';
  }

  function groupedMilestonesHtml(items){
    const groups=new Map();

    items.forEach(item=>{
      const name=milestoneGroupName(item);
      const key=name.toLowerCase();

      if(!groups.has(key)){
        groups.set(key,{
          name,
          items:[],
          themes:new Map()
        });
      }

      const group=groups.get(key);
      group.items.push(item);

      const theme=milestoneTheme(item.title);
      group.themes.set(theme,(group.themes.get(theme)||0)+1);
    });

    return [...groups.values()]
      .sort((a,b)=>b.items.length-a.items.length)
      .map(group=>{
        const themes=[...group.themes.entries()]
          .sort((a,b)=>b[1]-a[1])
          .slice(0,3);

        const bullets=themes
          .map(([theme,count])=>
            `<li>${esc(theme)}${count>1?` (${count})`:''}</li>`
          )
          .join('');

        return `
          <section class="executiveMilestoneGroup">
            <div class="executiveMilestoneGroupHeader">
              <strong>${esc(group.name)}</strong>
              <span>${number(group.items.length)} completed</span>
            </div>
            <ul>${bullets}</ul>
          </section>
        `;
      })
      .join('');
  }


  function upcomingTheme(title){
    const value=String(title||'').toLowerCase();

    if(value.includes('qa') || value.includes('test')){
      return 'QA validation and test completion';
    }

    if(value.includes('ui') || value.includes('keypad') || value.includes('touchscreen')){
      return 'User-interface and device-interaction updates';
    }

    if(value.includes('import') || value.includes('upload') || value.includes('data')){
      return 'Data import and upload improvements';
    }

    if(value.includes('report') || value.includes('email')){
      return 'Reporting and notification improvements';
    }

    if(value.includes('inventory') || value.includes('product')){
      return 'Inventory and product-control enhancements';
    }

    return 'Planned feature and platform delivery';
  }

  function riskTheme(item){
    const value=`${item.title||''} ${item.status||''}`.toLowerCase();

    if(value.includes('blocked')){
      return 'Blocked development dependencies';
    }

    if(value.includes('bug') || value.includes('error') || value.includes('issue')){
      return 'Open defects and reliability risks';
    }

    if(value.includes('inventory') || value.includes('planogram')){
      return 'Inventory workflow risks';
    }

    if(value.includes('keypad') || value.includes('touchscreen') || value.includes('ui')){
      return 'Device interaction and UI risks';
    }

    if(value.includes('data') || value.includes('transmission')){
      return 'Data transmission and integration risks';
    }

    return 'Management attention required';
  }

  function groupedExecutiveItemsHtml(items,mode){
    const groups=new Map();

    items.forEach(item=>{
      const name=milestoneGroupName(item);
      const key=name.toLowerCase();

      if(!groups.has(key)){
        groups.set(key,{
          name,
          items:[],
          themes:new Map()
        });
      }

      const group=groups.get(key);
      group.items.push(item);

      const theme=mode==='risk'
        ?riskTheme(item)
        :upcomingTheme(item.title);

      group.themes.set(theme,(group.themes.get(theme)||0)+1);
    });

    const label=mode==='risk'?'open':'planned';

    return [...groups.values()]
      .sort((a,b)=>b.items.length-a.items.length)
      .map(group=>{
        const themes=[...group.themes.entries()]
          .sort((a,b)=>b[1]-a[1])
          .slice(0,3);

        const bullets=themes
          .map(([theme,count])=>
            `<li>${esc(theme)}${count>1?` (${count})`:''}</li>`
          )
          .join('');

        return `
          <section class="executiveMilestoneGroup ${mode}">
            <div class="executiveMilestoneGroupHeader">
              <strong>${esc(group.name)}</strong>
              <span>${number(group.items.length)} ${label}</span>
            </div>
            <ul>${bullets}</ul>
          </section>
        `;
      })
      .join('');
  }
  function render(){
    const yearEl=$('#executiveReportYear');if(!yearEl)return;
    syncYears();
    const fy=Number(yearEl.value)||availableYears()[0]; const q=$('#executiveReportQuarter').value||'all';
    const p=fiscalPeriod(fy,q), next=nextPeriod(fy,q), items=Array.isArray(window.developmentItems)?window.developmentItems:[], projects=Array.isArray(window.projects)?window.projects:[];
    const completed=items.filter(i=>isComplete(i)&&inRange(itemDate(i,'end_date')||itemDate(i,'start_date'),p)).sort((a,b)=>String(b.end_date||b.start_date||'').localeCompare(String(a.end_date||a.start_date||'')));
    const upcoming=items
      .filter(i=>{
        const status=String(i.status||'').trim().toLowerCase();
        const date=itemDate(i,'end_date')||itemDate(i,'start_date');

        return !isComplete(i)
          && !status.includes('blocked')
          && inRange(date,next);
      })
      .sort((a,b)=>
        String(a.end_date||a.start_date||'')
          .localeCompare(String(b.end_date||b.start_date||''))
      );
    const risks=items.filter(i=>riskWords.some(w=>`${i.status||''} ${i.priority||''}`.toLowerCase().includes(w))&&!isComplete(i)).slice(0,6);
    const activeProjects=projects.filter(x=>!['completed','parking lot'].includes(String(x.status||'').toLowerCase()));
    const completedProjects=projects.filter(x=>String(x.status||'').toLowerCase()==='completed').length;
    const scorecard=Array.isArray(window.scorecardMetrics)?window.scorecardMetrics:[];
    const scorecardHistory=Array.isArray(window.scorecardHistory)?window.scorecardHistory:[];

    const findMetric=(...names)=>scorecard.find(m=>
      names.some(n=>String(m.metric_name||m.name||'').trim().toLowerCase()===n)
    );

    const metricHistory=(metric,cutoff)=>{
      if(!metric)return [];
      const cutoffTime=cutoff instanceof Date?cutoff.getTime():new Date(cutoff).getTime();

      return scorecardHistory
        .filter(row=>String(row.metric_id)===String(metric.id))
        .map(row=>({
          ...row,
          date:new Date(`${String(row.period_end||row.period_date).slice(0,10)}T12:00:00`)
        }))
        .filter(row=>!Number.isNaN(row.date.getTime())&&row.date.getTime()<=cutoffTime)
        .sort((a,b)=>b.date-a.date);
    };

    const scorecardValue=(metric,cutoff,fallback=true)=>{
      const row=metricHistory(metric,cutoff)[0];
      if(row)return Number(row.value)||0;
      return fallback?Number(metric?.current_value)||0:0;
    };

    const mrrMetric=findMetric('software mrr','mrr of software');
    const connectionMetric=findMetric(
      'connections',
      'current connections',
      'connection count'
    );

    const currentCutoff=new Date(p.end);
    const priorCutoff=new Date(p.end);
    priorCutoff.setFullYear(priorCutoff.getFullYear()-1);

    const current=scorecardValue(mrrMetric,currentCutoff,true);
    const prior=scorecardValue(mrrMetric,priorCutoff,false);
    const connections=scorecardValue(connectionMetric,currentCutoff,true);

    const latestRows=[
      ...metricHistory(mrrMetric,currentCutoff).slice(0,1),
      ...metricHistory(connectionMetric,currentCutoff).slice(0,1)
    ].sort((a,b)=>b.date-a.date);

    const updatedEl=$('#executiveScorecardUpdated');
    if(updatedEl){
      updatedEl.textContent=latestRows[0]
        ?latestRows[0].date.toLocaleDateString('en-US',{
            month:'short',
            day:'numeric',
            year:'numeric'
          })
        :'No scorecard data';
    }

    const growth=prior?((current-prior)/prior*100):null;
    $('#executiveReportPeriod').textContent=p.label;
    $('#executiveRevenuePeriod').textContent=p.label;
    $('#executiveReportGenerated').textContent=`Generated ${new Date().toLocaleString()}`;
    $('#executiveGrowthValue').textContent=growth==null?'—':`${growth>=0?'+':''}${growth.toFixed(1)}%`;
    $('#executiveGrowthCaption').textContent=growth==null?'Enter current and prior-year MRR':`${money(current-prior)} year-over-year change`;
    if ($('#executivePriorLabel')) $('#executivePriorLabel').textContent=prior?money(prior):'—';if ($('#executiveCurrentLabel')) $('#executiveCurrentLabel').textContent=current?money(current):'—';if ($('#executiveConnectionLabel')) $('#executiveConnectionLabel').textContent=connections?number(Math.round(connections)):'—';
    const max=Math.max(current,prior,1);if ($('#executivePriorBar')) $('#executivePriorBar').style.height=`${Math.max(prior/max*100,prior?8:0)}%`;if ($('#executiveCurrentBar')) $('#executiveCurrentBar').style.height=`${Math.max(current/max*100,current?8:0)}%`;
    $('#executiveKpis').innerHTML=[
      ['Active Initiatives',activeProjects.length,'Portfolio workload'],['Projects Completed',completedProjects,'All-time portfolio'],['Development Delivered',completed.length,p.label],['Next Deliverables',upcoming.length,next.label],['Open Risks',risks.length,'Needs attention']
    ].map(([l,v,s])=>`<div class="executiveKpi"><span>${l}</span><strong>${number(v)}</strong><small>${s}</small></div>`).join('');
    $('#executiveMilestones').innerHTML=
      groupedMilestonesHtml(completed)
      || '<div class="executiveEmpty">No completed software milestones are dated in this period.</div>';
    $('#executiveDeliverables').innerHTML=
      groupedExecutiveItemsHtml(upcoming,'upcoming')
      || '<div class="executiveEmpty">No upcoming development deliverables are dated in the next period.</div>';
    $('#executiveRisks').innerHTML=
      groupedExecutiveItemsHtml(risks,'risk')
      || '<div class="executiveEmpty">No blocked, at-risk, critical, or high-priority development items are open.</div>';
    renderExecutiveRevenueTrend({
      fy,
      q,
      mrrMetric,
      connectionMetric
    });

    requestAnimationFrame(renderExecutiveMixChart);
    requestAnimationFrame(enhanceExecutiveReportCards);
    requestAnimationFrame(
      refreshExecutiveSummaryFromScorecard
    );
    requestAnimationFrame(hideExecutiveKpiRow);

    const growthText=growth==null?'Recurring revenue metrics have not yet been entered.':`Backend software MRR is ${growth>=0?'up':'down'} ${Math.abs(growth).toFixed(1)}% year over year at ${money(current)}.`;
    $('#executiveNarrative').textContent=`${growthText} Software delivered ${completed.length} milestone${completed.length===1?'':'s'} during ${p.label}, with ${upcoming.length} deliverable${upcoming.length===1?'':'s'} currently scheduled for ${next.label}. The active product portfolio contains ${activeProjects.length} initiatives and ${risks.length} software item${risks.length===1?'':'s'} requiring management attention.`;
  }

  function executiveHistoryRows(metric){
    const history=Array.isArray(window.scorecardHistory)
      ?window.scorecardHistory
      :[];

    if(!metric)return [];

    return history
      .filter(row=>String(row.metric_id)===String(metric.id))
      .map(row=>{
        const raw=row.period_end||row.period_date;
        const date=new Date(`${String(raw||'').slice(0,10)}T12:00:00`);

        return {
          date,
          value:Number(row.value)||0
        };
      })
      .filter(row=>!Number.isNaN(row.date.getTime()))
      .sort((a,b)=>a.date-b.date);
  }

  function executiveYtdPeriod(fy,q){
    const fiscalStart=new Date(fy-1,9,1);

    if(q==='all'){
      return {
        start:fiscalStart,
        end:new Date(fy,9,0),
        label:`FY${fy}`
      };
    }

    const quarter=fiscalPeriod(fy,q);

    return {
      start:fiscalStart,
      end:quarter.end,
      label:`FY${fy} YTD through Q${q}`
    };
  }

  function valueAtOrBefore(rows,date){
    let result=null;

    for(const row of rows){
      if(row.date<=date){
        result=row.value;
      }else{
        break;
      }
    }

    return result;
  }

  function compactTrendPoints(points,maxPoints=18){
    if(points.length<=maxPoints)return points;

    const step=(points.length-1)/(maxPoints-1);
    const selected=[];

    for(let index=0;index<maxPoints;index++){
      selected.push(points[Math.round(index*step)]);
    }

    return selected.filter(
      (point,index,array)=>
        index===0 || point.date.getTime()!==array[index-1].date.getTime()
    );
  }

  function linearTrend(values){
    const valid=values
      .map((value,index)=>({x:index,y:Number(value)}))
      .filter(point=>Number.isFinite(point.y));

    if(valid.length<2)return values;

    const count=valid.length;
    const sumX=valid.reduce((sum,p)=>sum+p.x,0);
    const sumY=valid.reduce((sum,p)=>sum+p.y,0);
    const sumXY=valid.reduce((sum,p)=>sum+(p.x*p.y),0);
    const sumXX=valid.reduce((sum,p)=>sum+(p.x*p.x),0);
    const denominator=(count*sumXX)-(sumX*sumX);

    if(!denominator)return values;

    const slope=((count*sumXY)-(sumX*sumY))/denominator;
    const intercept=(sumY-(slope*sumX))/count;

    return values.map((_,index)=>intercept+(slope*index));
  }

  function renderExecutiveRevenueTrend({
    fy,
    q,
    mrrMetric,
    connectionMetric
  }){
    const container=$('#executiveRevenueTrendChart');
    if(!container)return;

    const period=executiveYtdPeriod(fy,q);
    const mrrRows=executiveHistoryRows(mrrMetric);
    const connectionRows=executiveHistoryRows(connectionMetric);

    const allDates=[
      ...mrrRows.map(row=>row.date),
      ...connectionRows.map(row=>row.date)
    ]
      .filter(date=>date>=period.start&&date<=period.end)
      .sort((a,b)=>a-b);

    const uniqueDates=[
      ...new Map(
        allDates.map(date=>[date.toISOString().slice(0,10),date])
      ).values()
    ];

    let points=uniqueDates.map(date=>({
      date,
      mrr:valueAtOrBefore(mrrRows,date),
      connections:valueAtOrBefore(connectionRows,date)
    })).filter(point=>point.mrr!==null||point.connections!==null);

    points=compactTrendPoints(points);

    if ($('#executiveRevenuePeriod')) $('#executiveRevenuePeriod').textContent=period.label;

    if(!points.length){
      container.innerHTML=`
        <div class="executiveRevenueEmpty">
          No Scorecard history is available for ${esc(period.label)}.
        </div>
      `;

      if ($('#executiveYtdChange')) $('#executiveYtdChange').textContent='—';
      return;
    }

    const width=1040;
    const height=330;
    const margin={top:24,right:135,bottom:62,left:135};
    const chartWidth=width-margin.left-margin.right;
    const chartHeight=height-margin.top-margin.bottom;

    const mrrValues=points
      .map(point=>point.mrr)
      .filter(Number.isFinite);

    const connectionValues=points
      .map(point=>point.connections)
      .filter(Number.isFinite);

    const maxMrr=Math.max(...mrrValues,1)*1.12;
    const maxConnections=Math.max(...connectionValues,1)*1.08;
    const minConnections=Math.min(...connectionValues,0);
    const connectionRange=Math.max(maxConnections-minConnections,1);

    const x=index=>
      margin.left+
      (
        points.length===1
          ?chartWidth/2
          :(index/(points.length-1))*chartWidth
      );

    const yMrr=value=>
      margin.top+chartHeight-
      ((Number(value)||0)/maxMrr)*chartHeight;

    const yConnections=value=>
      margin.top+chartHeight-
      (((Number(value)||0)-minConnections)/connectionRange)*chartHeight;

    const trend=linearTrend(
      points.map(point=>Number(point.mrr)||0)
    );

    const connectionPath=points
      .map((point,index)=>{
        const value=point.connections;

        if(!Number.isFinite(value))return null;

        return `${index===0?'M':'L'} ${x(index).toFixed(1)} ${yConnections(value).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

    const trendPath=trend
      .map((value,index)=>
        `${index===0?'M':'L'} ${x(index).toFixed(1)} ${yMrr(value).toFixed(1)}`
      )
      .join(' ');

    const barWidth=Math.max(
      8,
      Math.min(30,chartWidth/Math.max(points.length,1)*0.55)
    );

    const grid=[0,.25,.5,.75,1].map(fraction=>{
      const y=margin.top+chartHeight-(fraction*chartHeight);
      const revenue=maxMrr*fraction;
      const connections=minConnections+(connectionRange*fraction);

      return `
        <line
          x1="${margin.left}"
          y1="${y}"
          x2="${width-margin.right}"
          y2="${y}"
          class="executiveChartGrid"
        />
        <text
          x="${margin.left-24}"
          y="${y+4}"
          text-anchor="end"
          class="executiveChartAxis"
        >${money(revenue)}</text>
        <text
          x="${width-margin.right+24}"
          y="${y+4}"
          text-anchor="start"
          class="executiveChartAxis"
        >${number(Math.round(connections))}</text>
      `;
    }).join('');

    const bars=points.map((point,index)=>{
      if(!Number.isFinite(point.mrr))return '';

      const y=yMrr(point.mrr);
      const barHeight=(margin.top+chartHeight)-y;

      return `
        <rect
          x="${x(index)-(barWidth/2)}"
          y="${y}"
          width="${barWidth}"
          height="${Math.max(barHeight,1)}"
          rx="4"
          class="executiveMrrBar"
        >
          <title>
            ${point.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${money(point.mrr)}
          </title>
        </rect>
      `;
    }).join('');

    const dots=points.map((point,index)=>{
      if(!Number.isFinite(point.connections))return '';

      return `
        <circle
          cx="${x(index)}"
          cy="${yConnections(point.connections)}"
          r="4"
          class="executiveConnectionDot"
        >
          <title>
            ${point.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${number(Math.round(point.connections))} connections
          </title>
        </circle>
      `;
    }).join('');

    const labelIndexes=new Set([
      0,
      Math.floor((points.length-1)/2),
      points.length-1
    ]);

    const dateLabels=points.map((point,index)=>{
      if(!labelIndexes.has(index))return '';

      return `
        <text
          x="${x(index)}"
          y="${height-20}"
          text-anchor="middle"
          class="executiveChartDate"
        >${point.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text>
      `;
    }).join('');

    container.innerHTML=`
      <svg
        viewBox="0 0 ${width} ${height}"
        class="executiveRevenueSvg"
        aria-hidden="true"
      >
        ${grid}

        ${bars}

        <path
          d="${trendPath}"
          class="executiveMrrTrend"
        />

        <path
          d="${connectionPath}"
          class="executiveConnectionPath"
        />

        ${dots}
        ${dateLabels}

        <text
          x="28"
          y="${margin.top+(chartHeight/2)}"
          transform="rotate(-90 28 ${margin.top+(chartHeight/2)})"
          text-anchor="middle"
          class="executiveChartAxisTitle"
        >Monthly recurring revenue</text>

        <text
          x="${width-28}"
          y="${margin.top+(chartHeight/2)}"
          transform="rotate(90 ${width-28} ${margin.top+(chartHeight/2)})"
          text-anchor="middle"
          class="executiveChartAxisTitle"
        >Connections</text>
      </svg>
    `;

    const firstMrr=mrrValues[0];
    const latestMrr=mrrValues[mrrValues.length-1];
    const change=firstMrr
      ?((latestMrr-firstMrr)/firstMrr)*100
      :null;

    if ($('#executiveYtdChange')) {
      $('#executiveYtdChange').textContent=
        change===null
          ?'—'
          :`${change>=0?'+':''}${change.toFixed(1)}%`;
    }
  }

  function show(mode){
    const executive=mode==='executive';$('#quarterReport').classList.toggle('hidden',executive);$('#executiveReport').classList.toggle('hidden',!executive);
    $('#showQuarterReport').classList.toggle('active',!executive);$('#showExecutiveReport').classList.toggle('active',executive);
    $('#showQuarterReport').setAttribute('aria-selected',String(!executive));$('#showExecutiveReport').setAttribute('aria-selected',String(executive));
    if(executive)render();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    syncYears();
    $('#showQuarterReport')?.addEventListener('click',()=>show('quarter'));$('#showExecutiveReport')?.addEventListener('click',()=>show('executive'));
    $('#executiveReportYear')?.addEventListener('change',render);$('#executiveReportQuarter')?.addEventListener('change',render);
    
    window.renderExecutiveReport=render;
    const old=window.refreshAllData; if(typeof old==='function')window.refreshAllData=async function(...args){const result=await old.apply(this,args);render();return result;};
    render();
  });

  /* Keep Executive Report synchronized with Scorecard data. */
  window.renderExecutiveReport = render;

  function refreshExecutiveFromScorecard(){
    const metrics=Array.isArray(window.scorecardMetrics)
      ?window.scorecardMetrics
      :[];

    if(!metrics.length){
      return false;
    }

    render();
    return true;
  }

  window.addEventListener(
    'atlas:scorecard-updated',
    refreshExecutiveFromScorecard
  );

  document.addEventListener('DOMContentLoaded',()=>{
    let attempts=0;

    const timer=setInterval(()=>{
      attempts+=1;

      if(refreshExecutiveFromScorecard() || attempts>=40){
        clearInterval(timer);
      }
    },250);
  });



  function executiveMixPeriod(fy, quarter){
    const fiscalYear=Number(fy);

    if(String(quarter)==='all'){
      return {
        start:new Date(fiscalYear-1,9,1,12),
        end:new Date(fiscalYear,8,30,12),
        label:`FY${fiscalYear} Full Year`
      };
    }

    const q=Number(quarter);
    const ranges={
      1:{
        start:new Date(fiscalYear-1,9,1,12),
        end:new Date(fiscalYear-1,11,31,12),
        label:`FY${fiscalYear} Q1`
      },
      2:{
        start:new Date(fiscalYear,0,1,12),
        end:new Date(fiscalYear,2,31,12),
        label:`FY${fiscalYear} Q2`
      },
      3:{
        start:new Date(fiscalYear,3,1,12),
        end:new Date(fiscalYear,5,30,12),
        label:`FY${fiscalYear} Q3`
      },
      4:{
        start:new Date(fiscalYear,6,1,12),
        end:new Date(fiscalYear,8,30,12),
        label:`FY${fiscalYear} Q4`
      }
    };

    return ranges[q]||ranges[1];
  }

  function executiveDate(value){
    if(!value)return null;

    const date=new Date(`${String(value).slice(0,10)}T12:00:00`);
    return Number.isNaN(date.getTime())?null:date;
  }

  function executiveProjectInPeriod(project, period){
    const start=executiveDate(
      project.startDate
      || project.start_date
      || project.created_at
    );

    const finish=executiveDate(
      project.targetDate
      || project.endDate
      || project.end_date
      || project.execution?.forecastFinish
      || project.execution?.plannedFinish
    );

    if(start && finish){
      return start<=period.end && finish>=period.start;
    }

    if(start){
      return start>=period.start && start<=period.end;
    }

    if(finish){
      return finish>=period.start && finish<=period.end;
    }

    return false;
  }

  function executiveDevelopmentInPeriod(item, period){
    const date=executiveDate(
      item.end_date
      || item.start_date
      || item.updated_at
      || item.created_at
    );

    return Boolean(
      date
      && date>=period.start
      && date<=period.end
    );
  }

  function ensureExecutiveMixCard(){
    const grid=document.querySelector(
      '#executiveReportView .executiveReportGrid, #executiveReport .executiveReportGrid, .executiveReportGrid'
    );

    if(!grid)return null;

    let card=document.querySelector('#executiveMixCard');

    if(!card){
      card=document.createElement('section');
      card.id='executiveMixCard';
      card.className='executiveBoardCard executiveMixCard';

      card.innerHTML=`
        <div class="executiveCardHead">
          <div>
            <span class="executiveSectionLabel">Portfolio and development</span>
            <h2>Year / Quarter Mix</h2>
          </div>
          <span
            id="executiveMixPeriod"
            class="executiveCardPeriod"
          ></span>
        </div>

        <div class="executiveMixBody">
          <div
            id="executiveMixPie"
            class="executiveMixPie"
            role="img"
            aria-label="Portfolio and software work distribution"
          >
            <div>
              <strong id="executiveMixTotal">0</strong>
              <span>Items</span>
            </div>
          </div>

          <div
            id="executiveMixLegend"
            class="executiveMixLegend"
          ></div>
        </div>
      `;

      const milestoneCard=
        document.querySelector('#executiveMilestones')
          ?.closest('.executiveBoardCard');

      if(milestoneCard){
        grid.insertBefore(card,milestoneCard);
      }else{
        grid.appendChild(card);
      }
    }

    grid.classList.add('executiveReportBoardLayout');

    const revenueCard=
      document.querySelector('#executiveRevenueTrendChart')
        ?.closest('.executiveBoardCard')
      || document.querySelector('.executiveRevenueCard');

    const milestoneCard=
      document.querySelector('#executiveMilestones')
        ?.closest('.executiveBoardCard');

    const deliverableCard=
      document.querySelector('#executiveDeliverables')
        ?.closest('.executiveBoardCard');

    const riskCard=
      document.querySelector('#executiveRisks')
        ?.closest('.executiveBoardCard');

    revenueCard?.classList.add('executiveGridRevenue');
    card.classList.add('executiveGridMix');
    milestoneCard?.classList.add('executiveGridMilestones');
    deliverableCard?.classList.add('executiveGridDeliverables');
    riskCard?.classList.add('executiveGridRisks');

    return card;
  }

  function renderExecutiveMixChart(){
    const card=ensureExecutiveMixCard();
    if(!card)return;

    const fy=Number(
      document.querySelector('#executiveReportYear')?.value
      || new Date().getFullYear()
    );

    const quarter=
      document.querySelector('#executiveReportQuarter')?.value
      || 'all';

    const period=executiveMixPeriod(fy,quarter);

    const projects=Array.isArray(window.projects)
      ?window.projects
      :[];

    const development=Array.isArray(window.developmentItems)
      ?window.developmentItems
      :[];

    const periodProjects=projects.filter(project=>
      executiveProjectInPeriod(project,period)
    );

    const periodDevelopment=development.filter(item=>
      executiveDevelopmentInPeriod(item,period)
    );

    const categories=[
      {
        key:'NPD',
        label:'NPD',
        description:'New Product Development',
        color:'#2f6fe4',
        value:periodProjects.filter(project=>
          String(project.category||'').toUpperCase()==='NPD'
        ).length
      },
      {
        key:'CI',
        label:'CI',
        description:'Continuous Improvement',
        color:'#46b252',
        value:periodProjects.filter(project=>
          String(project.category||'').toUpperCase()==='CI'
        ).length
      },
      {
        key:'DPT',
        label:'Skunkworks',
        description:'Experimental',
        color:'#8242db',
        value:periodProjects.filter(project=>
          ['DPT','SKUNKWORKS'].includes(
            String(project.category||'').toUpperCase()
          )
        ).length
      },
      {
        key:'CLOUD',
        label:'Cloud Sustained',
        description:'Bugs and enhancements',
        color:'#ff7a16',
        value:periodDevelopment.filter(item=>
          String(item.department||'Cloud')
            .trim()
            .toLowerCase()==='cloud'
        ).length
      },
      {
        key:'EDGE',
        label:'Edge Sustained',
        description:'Bugs and enhancements',
        color:'#f5b82e',
        value:periodDevelopment.filter(item=>
          String(item.department||'')
            .trim()
            .toLowerCase()==='edge'
        ).length
      }
    ];

    const total=categories.reduce(
      (sum,category)=>sum+category.value,
      0
    );

    let offset=0;
    const segments=[];

    categories.forEach(category=>{
      const percent=total
        ?category.value/total*100
        :0;

      const end=offset+percent;

      if(percent>0){
        segments.push(
          `${category.color} ${offset}% ${end}%`
        );
      }

      category.percent=percent;
      offset=end;
    });

    const pie=document.querySelector('#executiveMixPie');
    const totalElement=document.querySelector('#executiveMixTotal');
    const legend=document.querySelector('#executiveMixLegend');
    const periodElement=document.querySelector('#executiveMixPeriod');

    if(periodElement){
      periodElement.textContent=period.label;
    }

    if(totalElement){
      totalElement.textContent=total.toLocaleString();
    }

    if(pie){
      pie.style.background=segments.length
        ?`conic-gradient(${segments.join(',')})`
        :'conic-gradient(#e5eaf2 0 100%)';

      pie.setAttribute(
        'aria-label',
        `${period.label}: ${total} portfolio and development items`
      );
    }

    if(legend){
      legend.innerHTML=categories.map(category=>`
        <div class="executiveMixLegendRow">
          <span
            class="executiveMixDot"
            style="background:${category.color}"
          ></span>

          <div>
            <strong>${esc(category.label)}</strong>
            <small>${esc(category.description)}</small>
          </div>

          <b>${category.value.toLocaleString()}</b>

          <em>${Math.round(category.percent)}%</em>
        </div>
      `).join('');
    }
  }

  window.renderExecutiveMixChart=renderExecutiveMixChart;

  document.addEventListener('DOMContentLoaded',()=>{
    ensureExecutiveMixCard();
    renderExecutiveMixChart();

    document
      .querySelector('#executiveReportYear')
      ?.addEventListener(
        'change',
        renderExecutiveMixChart
      );

    document
      .querySelector('#executiveReportQuarter')
      ?.addEventListener(
        'change',
        renderExecutiveMixChart
      );

    setTimeout(renderExecutiveMixChart,300);
    setTimeout(renderExecutiveMixChart,1000);
  });

  window.addEventListener(
    'atlas:scorecard-updated',
    renderExecutiveMixChart
  );


  function hideExecutiveKpiRow(){
    const labels=[
      'ACTIVE INITIATIVES',
      'PROJECTS COMPLETED',
      'DEVELOPMENT DELIVERED',
      'NEXT DELIVERABLES',
      'OPEN RISKS'
    ];

    const allElements=[...document.querySelectorAll('*')];

    const matches=labels
      .map(label=>allElements.find(el=>
        String(el.textContent||'').trim()===label
      ))
      .filter(Boolean);

    if(matches.length<3)return;

    const first=matches[0];

    let parent=first.parentElement;

    while(parent && parent!==document.body){
      const text=String(parent.textContent||'');

      const count=labels.filter(label=>text.includes(label)).length;

      if(count>=3){
        parent.style.display='none';
        parent.setAttribute('data-executive-kpi-row-hidden','true');
        return;
      }

      parent=parent.parentElement;
    }
  }

  window.hideExecutiveKpiRow=hideExecutiveKpiRow;

  document.addEventListener('DOMContentLoaded',()=>{
    hideExecutiveKpiRow();
    setTimeout(hideExecutiveKpiRow,250);
    setTimeout(hideExecutiveKpiRow,1000);
  });


  function executiveScorecardMetric(...names){
    const metrics=Array.isArray(window.scorecardMetrics)
      ?window.scorecardMetrics
      :[];

    const normalizedNames=names.map(name=>
      String(name).trim().toLowerCase()
    );

    return metrics.find(metric=>{
      const metricName=String(
        metric.metric_name
        ||metric.name
        ||''
      ).trim().toLowerCase();

      return normalizedNames.includes(metricName);
    })||null;
  }

  function executiveScorecardRows(metric){
    const history=Array.isArray(window.scorecardHistory)
      ?window.scorecardHistory
      :[];

    if(!metric)return [];

    return history
      .filter(row=>
        String(row.metric_id)===String(metric.id)
      )
      .map(row=>{
        const rawDate=
          row.period_end
          ||row.period_date
          ||row.week_ending;

        const date=new Date(
          `${String(rawDate||'').slice(0,10)}T12:00:00`
        );

        return {
          ...row,
          date,
          value:Number(row.value)||0
        };
      })
      .filter(row=>!Number.isNaN(row.date.getTime()))
      .sort((a,b)=>a.date-b.date);
  }

  function executiveValueAtDate(metric,date,useCurrentFallback=true){
    const rows=executiveScorecardRows(metric);
    let result=null;

    rows.forEach(row=>{
      if(row.date<=date){
        result=row.value;
      }
    });

    if(result!==null){
      return Number(result)||0;
    }

    return useCurrentFallback
      ?Number(metric?.current_value)||0
      :0;
  }

  function executivePeriodEnd(){
    const fy=Number(
      document.querySelector('#executiveReportYear')?.value
      ||new Date().getFullYear()
    );

    const quarter=String(
      document.querySelector('#executiveReportQuarter')?.value
      ||'all'
    );

    if(quarter==='all'){
      return new Date(fy,8,30,12);
    }

    const ends={
      1:new Date(fy-1,11,31,12),
      2:new Date(fy,2,31,12),
      3:new Date(fy,5,30,12),
      4:new Date(fy,8,30,12)
    };

    return ends[Number(quarter)]||ends[4];
  }

  function executiveVisibleGroupCount(containerSelector){
    const container=document.querySelector(containerSelector);
    if(!container)return 0;

    return [
      ...container.querySelectorAll(
        '.executiveMilestoneGroupHeader span'
      )
    ].reduce((total,element)=>{
      const match=String(element.textContent||'').match(/\d[\d,]*/);

      return total+(
        match
          ?Number(match[0].replace(/,/g,''))
          :0
      );
    },0);
  }

  function executiveSummaryCard(){
    const labels=[
      ...document.querySelectorAll(
        '.executiveSectionLabel, [class*="SectionLabel"], span'
      )
    ];

    const label=labels.find(element=>
      String(element.textContent||'')
        .trim()
        .toLowerCase()==='executive summary'
    );

    if(!label)return null;

    return label.closest(
      '.executiveSummary, .executiveSummaryCard, section, article, div'
    );
  }

  function refreshExecutiveSummaryFromScorecard(){
    const mrrMetric=executiveScorecardMetric(
      'Software MRR',
      'MRR of Software'
    );

    const connectionMetric=executiveScorecardMetric(
      'Current Connections',
      'Connections',
      'Connection Count'
    );

    const periodEnd=executivePeriodEnd();

    const priorEnd=new Date(periodEnd);
    priorEnd.setFullYear(priorEnd.getFullYear()-1);

    const currentMrr=executiveValueAtDate(
      mrrMetric,
      periodEnd,
      true
    );

    const priorMrr=executiveValueAtDate(
      mrrMetric,
      priorEnd,
      false
    );

    const connections=Math.round(
      executiveValueAtDate(
        connectionMetric,
        periodEnd,
        true
      )
    );

    const growth=priorMrr
      ?((currentMrr-priorMrr)/priorMrr)*100
      :null;

    const completed=
      executiveVisibleGroupCount('#executiveMilestones');

    const upcoming=
      executiveVisibleGroupCount('#executiveDeliverables');

    const risks=
      executiveVisibleGroupCount('#executiveRisks');

    const mixTotal=Number(
      String(
        document.querySelector('#executiveMixTotal')
          ?.textContent
        ||'0'
      ).replace(/,/g,'')
    )||0;

    const card=executiveSummaryCard();

    if(card){
      const heading=card.querySelector('h1,h2,h3');
      const paragraph=card.querySelector('p');

      if(heading){
        heading.textContent=
          'Software performance and delivery remain focused on strategic growth.';
      }

      if(paragraph){
        const revenueText=currentMrr
          ?`Software MRR is ${currentMrr.toLocaleString(
              'en-US',
              {
                style:'currency',
                currency:'USD',
                maximumFractionDigits:0
              }
            )}${growth===null
              ?''
              :`, ${growth>=0?'up':'down'} ${Math.abs(growth).toFixed(1)}% from the comparable prior-year period`
            }`
          :'Software MRR has not been entered in the Scorecard';

        const connectionText=connections
          ?` across ${connections.toLocaleString()} connected endpoints`
          :'';

        paragraph.textContent=
          `${revenueText}${connectionText}. `+
          `The selected reporting period contains ${mixTotal.toLocaleString()} portfolio and development items, `+
          `${completed.toLocaleString()} completed software milestones, `+
          `${upcoming.toLocaleString()} deliverables planned for the next reporting period, `+
          `and ${risks.toLocaleString()} open items requiring management attention.`;
      }
    }

    const growthValue=document.querySelector(
      '#executiveGrowthValue'
    );

    const growthCaption=document.querySelector(
      '#executiveGrowthCaption'
    );

    const growthLabel=growthValue
      ?.parentElement
      ?.querySelector('span,small,label');

    if(growth!==null){
      if(growthLabel){
        growthLabel.textContent='Recurring revenue growth';
      }

      if(growthValue){
        growthValue.textContent=
          `${growth>=0?'+':''}${growth.toFixed(1)}%`;
      }

      if(growthCaption){
        growthCaption.textContent=
          `${Math.abs(currentMrr-priorMrr).toLocaleString(
            'en-US',
            {
              style:'currency',
              currency:'USD',
              maximumFractionDigits:0
            }
          )} year-over-year change`;
      }
    }else{
      if(growthLabel){
        growthLabel.textContent='Current recurring revenue';
      }

      if(growthValue){
        growthValue.textContent=currentMrr
          ?currentMrr.toLocaleString(
              'en-US',
              {
                style:'currency',
                currency:'USD',
                maximumFractionDigits:0
              }
            )
          :'—';
      }

      if(growthCaption){
        growthCaption.textContent=connections
          ?`${connections.toLocaleString()} connected endpoints · prior-year comparison unavailable`
          :'Prior-year comparison unavailable';
      }
    }
  }

  window.refreshExecutiveSummaryFromScorecard=
    refreshExecutiveSummaryFromScorecard;

  window.addEventListener(
    'atlas:scorecard-updated',
    ()=>{
      setTimeout(refreshExecutiveSummaryFromScorecard,0);
      setTimeout(refreshExecutiveSummaryFromScorecard,250);
    }
  );

  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(refreshExecutiveSummaryFromScorecard,300);
    setTimeout(refreshExecutiveSummaryFromScorecard,1000);

    document
      .querySelector('#executiveReportYear')
      ?.addEventListener(
        'change',
        ()=>setTimeout(
          refreshExecutiveSummaryFromScorecard,
          0
        )
      );

    document
      .querySelector('#executiveReportQuarter')
      ?.addEventListener(
        'change',
        ()=>setTimeout(
          refreshExecutiveSummaryFromScorecard,
          0
        )
      );
  });


  function executiveCardTitle(card){
    return String(
      card.querySelector('h1,h2,h3')?.textContent
      || card.querySelector('.executiveSectionLabel')?.textContent
      || 'ATLAS Executive Report'
    ).trim();
  }

  function executiveSafeFilename(value){
    return String(value||'atlas-report-section')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,80)
      || 'atlas-report-section';
  }

  function executiveCardText(card){
    const clone=card.cloneNode(true);

    clone
      .querySelectorAll('.executiveCardActions,script,style,button')
      .forEach(element=>element.remove());

    return String(clone.innerText||clone.textContent||'')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
  }

  async function copyExecutiveCard(card,button){
    const title=executiveCardTitle(card);
    const text=`${title}\n\n${executiveCardText(card)}`;

    try{
      await navigator.clipboard.writeText(text);
    }catch(error){
      const textarea=document.createElement('textarea');
      textarea.value=text;
      textarea.style.position='fixed';
      textarea.style.left='-9999px';

      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    const original=button.getAttribute('aria-label');
    button.classList.add('success');
    button.setAttribute('aria-label','Copied');

    setTimeout(()=>{
      button.classList.remove('success');
      button.setAttribute('aria-label',original);
    },1200);
  }

  function executiveInlineStyles(source,clone){
    const sourceElements=[source,...source.querySelectorAll('*')];
    const cloneElements=[clone,...clone.querySelectorAll('*')];

    sourceElements.forEach((element,index)=>{
      const target=cloneElements[index];
      if(!target)return;

      const style=getComputedStyle(element);

      target.setAttribute(
        'style',
        [
          `box-sizing:${style.boxSizing}`,
          `display:${style.display}`,
          `position:${style.position==='fixed'?'static':style.position}`,
          `width:${style.width}`,
          `height:${style.height}`,
          `margin:${style.margin}`,
          `padding:${style.padding}`,
          `background:${style.background}`,
          `background-color:${style.backgroundColor}`,
          `color:${style.color}`,
          `border:${style.border}`,
          `border-radius:${style.borderRadius}`,
          `font:${style.font}`,
          `font-family:${style.fontFamily}`,
          `font-size:${style.fontSize}`,
          `font-weight:${style.fontWeight}`,
          `line-height:${style.lineHeight}`,
          `letter-spacing:${style.letterSpacing}`,
          `text-align:${style.textAlign}`,
          `white-space:${style.whiteSpace}`,
          `grid-template-columns:${style.gridTemplateColumns}`,
          `grid-template-rows:${style.gridTemplateRows}`,
          `grid-template-areas:${style.gridTemplateAreas}`,
          `gap:${style.gap}`,
          `align-items:${style.alignItems}`,
          `justify-content:${style.justifyContent}`,
          `overflow:${style.overflow}`,
          `opacity:${style.opacity}`
        ].join(';')
      );
    });
  }

  async function downloadExecutiveCard(card,button){
    const title=executiveCardTitle(card);
    const filename=executiveSafeFilename(title);
    const rect=card.getBoundingClientRect();

    const width=Math.max(Math.ceil(rect.width),400);
    const height=Math.max(Math.ceil(rect.height),160);
    const scale=2;

    const clone=card.cloneNode(true);

    clone
      .querySelectorAll('.executiveCardActions,script,button')
      .forEach(element=>element.remove());

    executiveInlineStyles(card,clone);

    clone.style.width=`${width}px`;
    clone.style.height=`${height}px`;
    clone.style.margin='0';
    clone.style.position='static';

    const wrapper=document.createElement('div');
    wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
    wrapper.style.width=`${width}px`;
    wrapper.style.height=`${height}px`;
    wrapper.style.background='#ffffff';
    wrapper.appendChild(clone);

    const serialized=new XMLSerializer().serializeToString(wrapper);

    const svg=`
      <svg xmlns="http://www.w3.org/2000/svg"
           width="${width*scale}"
           height="${height*scale}"
           viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
          ${serialized}
        </foreignObject>
      </svg>
    `;

    const blob=new Blob([svg],{
      type:'image/svg+xml;charset=utf-8'
    });

    const objectUrl=URL.createObjectURL(blob);
    const image=new Image();

    image.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=width*scale;
      canvas.height=height*scale;

      const context=canvas.getContext('2d');
      context.scale(scale,scale);
      context.fillStyle='#ffffff';
      context.fillRect(0,0,width,height);
      context.drawImage(image,0,0,width,height);

      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(pngBlob=>{
        if(!pngBlob)return;

        const link=document.createElement('a');
        link.href=URL.createObjectURL(pngBlob);
        link.download=`${filename}.png`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(()=>URL.revokeObjectURL(link.href),1000);

        button.classList.add('success');
        setTimeout(()=>button.classList.remove('success'),1200);
      },'image/png');
    };

    image.onerror=()=>{
      URL.revokeObjectURL(objectUrl);
      alert('This section could not be converted to an image.');
    };

    image.src=objectUrl;
  }

  function executiveActionButton(type){
    const button=document.createElement('button');
    button.type='button';
    button.className=`executiveCardAction executiveCardAction-${type}`;

    if(type==='download'){
      button.setAttribute('aria-label','Download section as PNG');
      button.setAttribute('title','Download section as PNG');
      button.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/>
        </svg>
      `;
    }else{
      button.setAttribute('aria-label','Copy section to clipboard');
      button.setAttribute('title','Copy section to clipboard');
      button.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="8" y="8" width="11" height="12" rx="2"/>
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>
        </svg>
      `;
    }

    return button;
  }

  function enhanceExecutiveReportCards(){
    const report=
      document.querySelector('#executiveReportView')
      || document.querySelector('#executiveReport');

    if(!report)return;

    const selectors=[
      '.executiveSummary',
      '.executiveSummaryCard',
      '.executiveBoardCard',
      '.executiveReportCard',
      '.executiveGridRevenue',
      '.executiveGridMix',
      '.executiveGridMilestones',
      '.executiveGridDeliverables',
      '.executiveGridRisks'
    ];

    const cards=[
      ...new Set(
        selectors.flatMap(selector=>[
          ...report.querySelectorAll(selector)
        ])
      )
    ];

    cards.forEach(card=>{
      if(card.querySelector(':scope > .executiveCardActions')){
        return;
      }

      card.classList.add('executiveCardExportable');

      const actions=document.createElement('div');
      actions.className='executiveCardActions';

      const copyButton=executiveActionButton('copy');
      const downloadButton=executiveActionButton('download');

      copyButton.addEventListener(
        'click',
        event=>{
          event.stopPropagation();
          copyExecutiveCard(card,copyButton);
        }
      );

      downloadButton.addEventListener(
        'click',
        event=>{
          event.stopPropagation();
          downloadExecutiveCard(card,downloadButton);
        }
      );

      actions.append(copyButton,downloadButton);
      /*
       * Keep the toolbar outside internal quarter grids.
       * The toolbar remains absolutely positioned relative
       * to the complete top-level panel.
       */
      card.appendChild(actions);
    });
  }

  window.enhanceExecutiveReportCards=
    enhanceExecutiveReportCards;

  document.addEventListener('DOMContentLoaded',()=>{
    enhanceExecutiveReportCards();
    setTimeout(enhanceExecutiveReportCards,300);
    setTimeout(enhanceExecutiveReportCards,1000);
  });

  window.addEventListener(
    'atlas:scorecard-updated',
    ()=>setTimeout(enhanceExecutiveReportCards,0)
  );


  function removeExecutivePrintPage(){
    document.querySelector('#atlasExecutivePrintPage')?.remove();
    document.documentElement.classList.remove('atlas-printing-executive');
  }
function setActiveSidebarReport(mode){
    document.querySelectorAll('[data-report-mode]').forEach(button=>{
      const active=button.getAttribute('data-report-mode')===mode;

      button.classList.toggle('reportActive',active);

      if(active){
        button.setAttribute('aria-current','page');
      }else{
        button.removeAttribute('aria-current');
      }
    });
  }

  function activateSidebarReport(mode){
    setActiveSidebarReport(mode);

    window.setTimeout(()=>{
      show(mode==='executive' ? 'executive' : 'quarter');
      setActiveSidebarReport(mode);
    },0);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-report-mode]');
    if(!button)return;

    activateSidebarReport(
      button.getAttribute('data-report-mode')
    );
  });

})();

/* =========================================================
   ATLAS clean one-page Executive Report PDF
   ========================================================= */

(function installCleanExecutivePdfExport(){

  function collectAtlasScreenCss(){
    let css='';

    for(const sheet of [...document.styleSheets]){
      try{
        for(const rule of [...sheet.cssRules]){
          const text=rule.cssText||'';
          const lower=text.trim().toLowerCase();

          // Exclude all accumulated print rules.
          if(lower.startsWith('@media print')) continue;
          if(lower.startsWith('@page')) continue;

          css+=text+'\n';
        }
      }catch(error){
        console.warn('Could not read stylesheet:',error);
      }
    }

    return css;
  }

  function cleanExecutiveClone(source){
    const clone=source.cloneNode(true);

    clone.querySelectorAll(`
      button,
      nav,
      .executiveCardActions,
      .executiveControlPanel,
      #executiveReportControls,
      #executiveReportGenerated,
      #downloadExecutiveReportPdf,
      #printExecutiveReport,
      #executiveReportPdf
    `).forEach(element=>element.remove());

    clone.querySelectorAll('[id]').forEach(element=>{
      element.removeAttribute('id');
    });

    clone.classList.remove('hidden');

    clone.style.display='block';
    clone.style.visibility='visible';
    clone.style.position='static';
    clone.style.inset='auto';
    clone.style.left='auto';
    clone.style.right='auto';
    clone.style.top='auto';
    clone.style.bottom='auto';
    clone.style.width='1600px';
    clone.style.maxWidth='none';
    clone.style.height='auto';
    clone.style.margin='0';
    clone.style.padding='18px';
    clone.style.transform='none';
    clone.style.zoom='1';
    clone.style.overflow='visible';
    clone.style.background='#ffffff';

    return clone;
  }

  async function printExecutiveReportClean(){
    const source =
      document.querySelector('#executiveReportView')
      || document.querySelector('#executiveReport');

    if(!source){
      alert('The Executive Report could not be found.');
      return;
    }

    const popup = window.open(
      '',
      'atlasExecutiveCleanPrint',
      'width=1000,height=1100'
    );

    if(!popup){
      alert('Please allow pop-ups for project.splatterin.com.');
      return;
    }

    let css = '';

    for(const sheet of [...document.styleSheets]){
      try{
        for(const rule of [...sheet.cssRules]){
          const text = rule.cssText || '';
          const lower = text.trim().toLowerCase();

          if(lower.startsWith('@media print')) continue;
          if(lower.startsWith('@page')) continue;

          css += text + '\n';
        }
      }catch(error){
        console.warn('Could not read stylesheet:', error);
      }
    }

    const clone = source.cloneNode(true);

    clone.querySelectorAll(`
      button,
      nav,
      .executiveCardActions,
      .executiveControlPanel,
      #executiveReportControls,
      #executiveReportGenerated,
      #downloadExecutiveReportPdf,
      #printExecutiveReport,
      #executiveReportPdf
    `).forEach(element => element.remove());

    clone.querySelector('#executiveKpis')?.remove();

    clone.classList.remove('hidden');

    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.position = 'static';
    clone.style.inset = 'auto';
    clone.style.width = '1440px';
    clone.style.maxWidth = 'none';
    clone.style.height = 'auto';
    clone.style.margin = '0';
    clone.style.padding = '20px';
    clone.style.transform = 'none';
    clone.style.zoom = '1';
    clone.style.overflow = 'visible';
    clone.style.background = '#ffffff';

    popup.document.open();
    popup.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${location.origin}${location.pathname}">
  <title>ATLAS Executive Report</title>

  <style>
    ${css}

    @page{
      size:Letter portrait;
      margin:0;
    }

    *{
      box-sizing:border-box;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }

    html,
    body{
      width:816px;
      height:1056px;
      margin:0 !important;
      padding:0 !important;
      overflow:hidden !important;
      background:#fff !important;
    }

    #atlasPrintPage{
      position:relative;
      width:816px;
      height:1056px;
      overflow:hidden;
      background:#fff;
    }

    #atlasPrintCanvas{
      position:absolute;
      top:12px;
      left:12px;
      width:1440px;
      transform-origin:top left;
    }

    #atlasPrintCanvas .executiveReportGrid.executiveReportBoardLayout{
      display:grid !important;
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      grid-template-areas:
        "revenue mix"
        "milestones deliverables"
        "risks risks" !important;
      gap:16px !important;
      align-items:start !important;
    }

    #atlasPrintCanvas .executiveGridRevenue{
      grid-area:revenue !important;
    }

    #atlasPrintCanvas .executiveGridMix{
      grid-area:mix !important;
    }

    #atlasPrintCanvas .executiveGridMilestones{
      grid-area:milestones !important;
    }

    #atlasPrintCanvas .executiveGridDeliverables{
      grid-area:deliverables !important;
    }

    #atlasPrintCanvas .executiveGridRisks{
      grid-area:risks !important;
    }

    #atlasPrintCanvas .executiveRevenueTrendChart{
      min-height:310px !important;
    }

    #atlasPrintCanvas .executiveRevenueSvg{
      width:100% !important;
      height:auto !important;
      max-height:none !important;
    }

    #atlasPrintCanvas .executiveGridMix .executiveMixBody{
      grid-template-columns:minmax(260px,.9fr) minmax(320px,1.1fr) !important;
      min-height:390px !important;
      gap:34px !important;
      padding:28px 24px 30px !important;
    }

    #atlasPrintCanvas .executiveGridMix .executiveMixPie{
      width:min(300px,100%) !important;
      max-width:300px !important;
    }

    #atlasPrintCanvas #executiveMilestones,
    #atlasPrintCanvas #executiveDeliverables{
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    }

    #atlasPrintCanvas #executiveRisks{
      grid-template-columns:repeat(3,minmax(0,1fr)) !important;
    }

    #atlasPrintCanvas .executiveSummary,
    #atlasPrintCanvas .executiveSummaryCard{
      margin-bottom:16px !important;
    }

    #atlasPrintCanvas button,
    #atlasPrintCanvas nav,
    #atlasPrintCanvas .executiveCardActions,
    #atlasPrintCanvas .executiveControlPanel{
      display:none !important;
    }

    @media print{
      html,
      body,
      #atlasPrintPage{
        width:8.5in !important;
        height:11in !important;
        overflow:hidden !important;
      }
    }
  </style>
</head>

<body>
  <div id="atlasPrintPage">
    <div id="atlasPrintCanvas">
      ${clone.outerHTML}
    </div>
  </div>
</body>
</html>
    `);

    popup.document.close();

    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = popup.document.querySelector('#atlasPrintCanvas');
    const report = canvas?.firstElementChild;

    if(!canvas || !report){
      popup.close();
      alert('The Executive Report could not be prepared.');
      return;
    }

    const availableWidth = 792;
    const availableHeight = 1032;

    const contentWidth = Math.max(
      report.scrollWidth,
      report.getBoundingClientRect().width,
      1
    );

    const contentHeight = Math.max(
      report.scrollHeight,
      report.getBoundingClientRect().height,
      1
    );

    const widthScale = availableWidth / contentWidth;
    const heightScale = availableHeight / contentHeight;

    const scale = Math.min(widthScale, heightScale) * 0.985;

    const renderedWidth=contentWidth*scale;
    const horizontalOffset=Math.max(
      12,
      12+((availableWidth-renderedWidth)/2)
    );

    canvas.style.width = `${contentWidth}px`;
    canvas.style.height = `${contentHeight}px`;
    canvas.style.left = `${horizontalOffset}px`;
    canvas.style.transform = `scale(${scale})`;

    console.log('ATLAS PDF export', {
      contentWidth,
      contentHeight,
      widthScale,
      heightScale,
      scale
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    popup.focus();
    popup.print();
  }

  function attachCleanExecutivePdfButton(){
    const oldButton=document.querySelector(
      '#downloadExecutiveReportPdf'
    );

    if(!oldButton)return;

    // Replacing the node removes all previous broken handlers.
    const newButton=oldButton.cloneNode(true);

    newButton.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      printExecutiveReportClean();
    });

    oldButton.replaceWith(newButton);
  }

  window.printExecutiveReportClean=printExecutiveReportClean;

  document.addEventListener('DOMContentLoaded',()=>{
    attachCleanExecutivePdfButton();
    setTimeout(attachCleanExecutivePdfButton,500);
    setTimeout(attachCleanExecutivePdfButton,1500);
  });

})();
















/* =========================================================
   Executive Report section actions — PNG only
   ========================================================= */

(function installExecutivePngActions(){

  function getExportCard(button){
    return button.closest('.executiveCardExportable');
  }

  function getExportTitle(card){
    return String(
      card.querySelector('h1,h2,h3')?.textContent
      || card.querySelector('.executiveSectionLabel')?.textContent
      || 'ATLAS Report Section'
    ).trim();
  }

  function safePngFilename(value){
    return String(value || 'atlas-report-section')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,80)
      || 'atlas-report-section';
  }

  function showExportSuccess(button){
    button.classList.add('success');

    setTimeout(()=>{
      button.classList.remove('success');
    },1200);
  }

  function copyComputedStyles(source,clone){
    const sourceNodes=[
      source,
      ...source.querySelectorAll('*')
    ];

    const cloneNodes=[
      clone,
      ...clone.querySelectorAll('*')
    ];

    sourceNodes.forEach((sourceNode,index)=>{
      const cloneNode=cloneNodes[index];
      if(!cloneNode)return;

      const style=getComputedStyle(sourceNode);

      const properties=[
        'box-sizing',
        'display',
        'position',
        'width',
        'height',
        'min-width',
        'min-height',
        'max-width',
        'max-height',
        'margin',
        'padding',
        'background',
        'background-color',
        'background-image',
        'background-size',
        'background-position',
        'color',
        'border',
        'border-radius',
        'box-shadow',
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'line-height',
        'letter-spacing',
        'text-align',
        'text-transform',
        'white-space',
        'grid-template-columns',
        'grid-template-rows',
        'grid-template-areas',
        'grid-column',
        'grid-row',
        'gap',
        'align-items',
        'align-content',
        'justify-items',
        'justify-content',
        'flex-direction',
        'flex-wrap',
        'overflow',
        'opacity'
      ];

      properties.forEach(property=>{
        const value=style.getPropertyValue(property);

        if(value){
          cloneNode.style.setProperty(
            property,
            value,
            style.getPropertyPriority(property)
          );
        }
      });

      /*
       * SVG styles must be set as explicit attributes.
       * Otherwise html-to-image can render them as black.
       */
      if(sourceNode instanceof SVGElement){
        const fill=style.fill;
        const stroke=style.stroke;
        const strokeWidth=style.strokeWidth;
        const strokeDasharray=style.strokeDasharray;
        const strokeLinecap=style.strokeLinecap;
        const strokeLinejoin=style.strokeLinejoin;

        if(fill && fill !== 'none'){
          cloneNode.setAttribute('fill',fill);
          cloneNode.style.fill=fill;
        }else{
          cloneNode.setAttribute('fill','none');
          cloneNode.style.fill='none';
        }

        if(stroke && stroke !== 'none'){
          cloneNode.setAttribute('stroke',stroke);
          cloneNode.style.stroke=stroke;
        }else{
          cloneNode.setAttribute('stroke','none');
          cloneNode.style.stroke='none';
        }

        if(strokeWidth){
          cloneNode.setAttribute('stroke-width',strokeWidth);
        }

        if(strokeDasharray && strokeDasharray !== 'none'){
          cloneNode.setAttribute(
            'stroke-dasharray',
            strokeDasharray
          );
        }

        if(strokeLinecap){
          cloneNode.setAttribute(
            'stroke-linecap',
            strokeLinecap
          );
        }

        if(strokeLinejoin){
          cloneNode.setAttribute(
            'stroke-linejoin',
            strokeLinejoin
          );
        }

        cloneNode.style.opacity=style.opacity;
        cloneNode.style.fontFamily=style.fontFamily;
        cloneNode.style.fontSize=style.fontSize;
        cloneNode.style.fontWeight=style.fontWeight;
      }
    });
  }

  async function createCardPngBlob(card){
    if(!window.htmlToImage){
      throw new Error('The local html-to-image library did not load.');
    }

    /*
     * Initiative Mix must be captured directly from the live DOM.
     * Rebuilding this panel as a computed-style clone breaks its
     * four-column quarter grid and donut positioning.
     */
    if(card.classList.contains('initiativeMixPngExportable')){
      const actions=card.querySelector('.initiativeMixCardActions');
      const oldDisplay=actions?.style.display || '';
      const oldVisibility=actions?.style.visibility || '';

      if(actions){
        actions.style.display='none';
        actions.style.visibility='hidden';
      }

      try{
        await document.fonts?.ready;

        await new Promise(resolve=>
          requestAnimationFrame(()=>
            requestAnimationFrame(resolve)
          )
        );

        const rect=card.getBoundingClientRect();
        const width=Math.max(
          Math.ceil(card.scrollWidth),
          Math.ceil(rect.width),
          900
        );

        const height=Math.max(
          Math.ceil(card.scrollHeight),
          Math.ceil(rect.height),
          400
        );

        const blob=await window.htmlToImage.toBlob(card,{
          backgroundColor:'#ffffff',
          cacheBust:true,
          pixelRatio:2.5,
          width,
          height,
          canvasWidth:Math.ceil(width*2.5),
          canvasHeight:Math.ceil(height*2.5),
          skipAutoScale:true,
          style:{
            margin:'0',
            transform:'none',
            width:`${width}px`,
            height:`${height}px`
          },
          filter:node=>
            !node.classList?.contains('initiativeMixCardActions')
            && !node.classList?.contains('executiveCardActions')
        });

        if(!blob){
          throw new Error(
            'Initiative Mix PNG generation returned no image.'
          );
        }

        return blob;
      }finally{
        if(actions){
          actions.style.display=oldDisplay;
          actions.style.visibility=oldVisibility;
        }
      }
    }

    const rect=card.getBoundingClientRect();
    const width=Math.max(
      Math.ceil(card.scrollWidth),
      Math.ceil(rect.width),
      400
    );

    const height=Math.max(
      Math.ceil(card.scrollHeight),
      Math.ceil(rect.height),
      180
    );

    const clone=card.cloneNode(true);

    clone
      .querySelectorAll('.executiveCardActions,button,script')
      .forEach(element=>element.remove());

    copyComputedStyles(card,clone);

    clone.style.position='static';
    clone.style.inset='auto';
    clone.style.left='auto';
    clone.style.top='auto';
    clone.style.width=`${width}px`;
    clone.style.height=`${height}px`;
    clone.style.minWidth=`${width}px`;
    clone.style.maxWidth=`${width}px`;
    clone.style.margin='0';
    clone.style.transform='none';
    clone.style.zoom='1';
    clone.style.background='#ffffff';
    clone.style.overflow='hidden';

    const staging=document.createElement('div');

    staging.setAttribute(
      'data-atlas-png-staging',
      'true'
    );

    staging.style.position='fixed';
    staging.style.left='-100000px';
    staging.style.top='0';
    staging.style.width=`${width}px`;
    staging.style.height=`${height}px`;
    staging.style.background='#ffffff';
    staging.style.pointerEvents='none';
    staging.style.zIndex='-99999';

    staging.appendChild(clone);
    document.body.appendChild(staging);

    try{
      await document.fonts?.ready;

      await new Promise(resolve=>
        requestAnimationFrame(()=>
          requestAnimationFrame(resolve)
        )
      );

      const blob=await window.htmlToImage.toBlob(clone,{
        backgroundColor:'#ffffff',
        cacheBust:true,
        pixelRatio:3,
        width,
        height,
        canvasWidth:width*3,
        canvasHeight:height*3,
        skipAutoScale:true,
        filter:node=>
          !node.classList?.contains('executiveCardActions')
      });

      if(!blob){
        throw new Error('No PNG data was generated.');
      }

      return blob;
    }finally{
      staging.remove();
    }
  }

  async function downloadCardAsPng(button){
    const card=getExportCard(button);
    if(!card)return;

    const blob=await createCardPngBlob(card);
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');

    link.href=url;
    link.download=
      `${safePngFilename(getExportTitle(card))}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(()=>{
      URL.revokeObjectURL(url);
    },1500);

    showExportSuccess(button);
  }

  async function copyCardAsPng(button){
    const card=getExportCard(button);
    if(!card)return;

    if(
      !navigator.clipboard?.write
      || typeof ClipboardItem==='undefined'
    ){
      throw new Error(
        'PNG clipboard copying is not supported by this browser.'
      );
    }

    const blob=await createCardPngBlob(card);

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png':blob
      })
    ]);

    showExportSuccess(button);
  }

  /*
   * Capture phase ensures older click listeners cannot run first.
   */
  document.addEventListener('click',async event=>{
    const copyButton=event.target.closest(
      '.executiveCardAction-copy'
    );

    const downloadButton=event.target.closest(
      '.executiveCardAction-download'
    );

    if(!copyButton && !downloadButton){
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const button=copyButton || downloadButton;
    button.disabled=true;

    try{
      if(copyButton){
        await copyCardAsPng(copyButton);
      }else{
        await downloadCardAsPng(downloadButton);
      }
    }catch(error){
      console.error(
        'ATLAS Executive Report PNG export failed:',
        error
      );

      alert(
        copyButton
          ? 'The report section could not be copied as a PNG.'
          : 'The report section could not be downloaded as a PNG.'
      );
    }finally{
      button.disabled=false;
    }
  },true);

})();


/* =========================================================
   Dashboard card PNG copy/download actions
   ========================================================= */

(function installDashboardPngActions(){

  function dashboardRoot(){
    const selectors=[
      '#dashboardView',
      'section#dashboardView',
      '#dashboard',
      '#viewDashboard',
      '[data-view-panel="dashboard"]',
      '.dashboardView',
      '.dashboard-page'
    ];

    for(const selector of selectors){
      const element=document.querySelector(selector);

      if(element){
        return element;
      }
    }

    /*
     * ATLAS views commonly use an ID ending in "View".
     * This fallback identifies the visible Dashboard section.
     */
    return [...document.querySelectorAll('main section, main > div')]
      .find(element=>{
        const text=String(element.textContent||'')
          .replace(/\s+/g,' ')
          .trim()
          .toLowerCase();

        return (
          text.includes('dashboard')
          && (
            text.includes('initiatives')
            || text.includes('development')
            || text.includes('portfolio')
          )
        );
      }) || null;
  }

  function actionButton(type){
    const button=document.createElement('button');

    button.type='button';
    button.className=
      `executiveCardAction executiveCardAction-${type}`;

    if(type==='copy'){
      button.setAttribute(
        'aria-label',
        'Copy dashboard card as PNG'
      );

      button.setAttribute(
        'title',
        'Copy as PNG'
      );

      button.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="8"
            y="8"
            width="11"
            height="12"
            rx="2"
          ></rect>
          <path
            d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"
          ></path>
        </svg>
      `;
    }else{
      button.setAttribute(
        'aria-label',
        'Download dashboard card as PNG'
      );

      button.setAttribute(
        'title',
        'Download PNG'
      );

      button.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11"></path>
          <path d="m8 10 4 4 4-4"></path>
          <path d="M5 17v3h14v-3"></path>
        </svg>
      `;
    }

    return button;
  }

  function isUsefulDashboardCard(card,root){
    if(!card || !root.contains(card)){
      return false;
    }

    if(
      card.matches(
        '.modal, .drawer, .sheet, .dialog, ' +
        '.executiveCardActions, nav, header'
      )
    ){
      return false;
    }

    if(
      card.closest(
        '.modal, .drawer, .sheet, dialog'
      )
    ){
      return false;
    }

    const rect=card.getBoundingClientRect();

    /*
     * Avoid adding controls to tiny labels, buttons,
     * individual table cells, or empty containers.
     */
    if(rect.width<220 || rect.height<90){
      return false;
    }

    const content=String(card.textContent||'').trim();

    return content.length>0;
  }

  function dashboardCards(root){
    /*
     * Export only complete top-level panels.
     * Never treat individual quarter columns, chart internals,
     * legends, tables, or nested cards as standalone exports.
     */
    const candidates=[
      ...root.querySelectorAll(':scope > section.panel'),
      ...root.querySelectorAll(':scope > article.panel'),
      ...root.querySelectorAll(':scope > div.panel'),
      ...root.querySelectorAll(':scope > .dashboardGrid > section.panel'),
      ...root.querySelectorAll(':scope > .dashboard-grid > section.panel'),
      ...root.querySelectorAll(':scope > .executiveDashboardGrid > section.panel'),
      ...root.querySelectorAll(':scope > .operationalDashboardGrid > section.panel')
    ];

    const unique=[...new Set(candidates)];

    return unique.filter(panel=>{
      if(!isUsefulDashboardCard(panel,root)){
        return false;
      }

      /*
       * Do not export structural wrappers that contain several
       * separate top-level panels.
       */
      const nestedTopPanels=[
        ...panel.querySelectorAll(':scope > section.panel, :scope > article.panel')
      ];

      if(nestedTopPanels.length>1){
        return false;
      }

      /*
       * Explicitly reject quarter/chart internals.
       */
      if(
        panel.matches(
          '.quarterCard, .quarter-card, .quarterColumn, .quarter-column, ' +
          '.mixQuarter, .mix-quarter, .chartSegment, .chart-segment'
        )
      ){
        return false;
      }

      return true;
    });
  }

  function enhanceDashboardCards(){
    const root=dashboardRoot();

    if(!root){
      return;
    }

    /*
     * Remove controls previously injected into nested elements.
     */
    root.querySelectorAll(
      '.dashboardPngExportable'
    ).forEach(element=>{
      element
        .querySelectorAll(':scope > .dashboardCardActions')
        .forEach(actions=>actions.remove());

      element.classList.remove(
        'dashboardPngExportable',
        'executiveCardExportable'
      );
    });

    dashboardCards(root).forEach(card=>{
      if(
        card.querySelector(
          ':scope > .executiveCardActions'
        )
      ){
        return;
      }

      /*
       * The existing PNG handler searches for this class.
       * Reusing it means Dashboard and Executive Report
       * cards share the exact same export pipeline.
       */
      card.classList.add(
        'executiveCardExportable',
        'dashboardPngExportable'
      );

      const actions=document.createElement('div');
      actions.className='executiveCardActions dashboardCardActions';

      actions.append(
        actionButton('copy'),
        actionButton('download')
      );

      card.appendChild(actions);
    });
  }

  window.enhanceDashboardCards=
    enhanceDashboardCards;

  document.addEventListener('DOMContentLoaded',()=>{
    enhanceDashboardCards();

    setTimeout(enhanceDashboardCards,300);
    setTimeout(enhanceDashboardCards,1000);
  });

  document.addEventListener('click',event=>{
    const dashboardButton=event.target.closest(
      '[data-view="dashboard"]'
    );

    if(!dashboardButton){
      return;
    }

    setTimeout(enhanceDashboardCards,50);
    setTimeout(enhanceDashboardCards,400);
  });

  /*
   * Dashboard data can rerender cards after Supabase refreshes.
   */
  const observer=new MutationObserver(()=>{
    if(document.body.classList.contains('atlasPngEnhancing')){
      return;
    }

    document.body.classList.add('atlasPngEnhancing');

    requestAnimationFrame(()=>{
      enhanceDashboardCards();
      document.body.classList.remove('atlasPngEnhancing');
    });
  });

  document.addEventListener('DOMContentLoaded',()=>{
    const root=dashboardRoot();

    if(root){
      observer.observe(root,{
        childList:true,
        subtree:true
      });
    }
  });

})();













/* =========================================================
   Initiative Mix PNG controls — direct markup integration
   ========================================================= */

(function installInitiativeMixPngActions(){

  function createMixActionButton(type){
    const button=document.createElement('button');

    button.type='button';
    button.className=
      `executiveCardAction executiveCardAction-${type}`;

    if(type==='copy'){
      button.title='Copy Initiative Mix as PNG';
      button.setAttribute('aria-label','Copy Initiative Mix as PNG');

      button.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="8" y="8" width="11" height="12" rx="2"></rect>
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"></path>
        </svg>
      `;
    }else{
      button.title='Download Initiative Mix as PNG';
      button.setAttribute('aria-label','Download Initiative Mix as PNG');

      button.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11"></path>
          <path d="m8 10 4 4 4-4"></path>
          <path d="M5 17v3h14v-3"></path>
        </svg>
      `;
    }

    return button;
  }

  function enhanceInitiativeMixPanel(){
    const panel=document.querySelector(
      '#dashboardView .projectMixPanel'
    );

    const header=panel?.querySelector('.projectMixHead');
    const yearControl=panel?.querySelector('.projectMixYearControl');

    if(!panel || !header || !yearControl){
      return;
    }

    panel.classList.add(
      'executiveCardExportable',
      'initiativeMixPngExportable'
    );

    header.classList.add('initiativeMixExportHeader');
    yearControl.classList.add('initiativeMixYearControl');

    let actions=header.querySelector(
      ':scope > .initiativeMixCardActions'
    );

    if(!actions){
      actions=document.createElement('div');

      actions.className=
        'executiveCardActions ' +
        'dashboardCardActions ' +
        'initiativeMixCardActions';

      actions.append(
        createMixActionButton('copy'),
        createMixActionButton('download')
      );

      header.appendChild(actions);
    }
  }

  window.enhanceInitiativeMixPanel=
    enhanceInitiativeMixPanel;

  document.addEventListener('DOMContentLoaded',()=>{
    enhanceInitiativeMixPanel();
    setTimeout(enhanceInitiativeMixPanel,250);
    setTimeout(enhanceInitiativeMixPanel,750);
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-view="dashboard"]')){
      setTimeout(enhanceInitiativeMixPanel,100);
      setTimeout(enhanceInitiativeMixPanel,400);
    }
  });

})();
