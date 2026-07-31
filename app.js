const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const monthKey = d => d ? d.slice(0,7) : '';
const addMonths = (yyyyMm, n) => { const [y,m]=yyyyMm.split('-').map(Number); const d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const monthLabel = yyyyMm => { if(!yyyyMm) return 'Unscheduled'; const [y,m]=yyyyMm.split('-'); return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'}); };

const starterDefaults={loadedRate:120,externalCost:0,capex:0,uncertainty:1,year2Revenue:0,year3Revenue:0,annualSavings:0,grossMargin:.35,fte:1,allocation:.6,projectType:'A',costAmount:1,quadrantScore:4,technicalRisk:1,productionRisk:1};
const starterProjects=[
{id:uid(),name:'Receiving Quality Products',description:'Starter project imported from the Project Base workbook.',division:'IDS',category:'DPT',champion:'Unassigned',sponsor:'',status:'Proposed',startDate:'2027-01',input:{...starterDefaults,hours:134,year1Revenue:1563536,year2Revenue:1719889.6,year3Revenue:1891878.56,quadrantScore:4},assignments:[]},
{id:uid(),name:'Provisioning Staff',description:'Starter project imported from the Project Base workbook.',division:'IDS',category:'DPT',champion:'Unassigned',sponsor:'',status:'Proposed',startDate:'2027-01',input:{...starterDefaults,hours:134,year1Revenue:526190,year2Revenue:578809,year3Revenue:636689.9,quadrantScore:4},assignments:[]},
{id:uid(),name:'Shared Engineering Toolset',description:'Starter project imported from the Project Base workbook.',division:'FENG',category:'CI',champion:'Unassigned',sponsor:'',status:'Proposed',startDate:'2027-04',input:{...starterDefaults,hours:134,uncertainty:2,allocation:.5,year1Revenue:684047,year2Revenue:752451.7,year3Revenue:827696.87,quadrantScore:2,customer:2,confidence:3},assignments:[]}
];
const starterResources=[
{id:uid(),name:'Mechanical Engineering',role:'Engineer',department:'FENG',loadedRate:115,hoursPerMonth:140},
{id:uid(),name:'Electrical Engineering',role:'Engineer',department:'FENG',loadedRate:120,hoursPerMonth:140},
{id:uid(),name:'Software Engineering',role:'Developer',department:'Software',loadedRate:125,hoursPerMonth:140},
{id:uid(),name:'Project Management',role:'Project Manager',department:'Corporate',loadedRate:105,hoursPerMonth:140}
];
let settings=JSON.parse(localStorage.getItem('ppp-settings')||'null')||{productiveHours:140,defaultMargin:35,contingency:{1:10,2:20,3:35}};
let projects=[]; // v7.0.3: Supabase is the project system of record.
const locallyStoredResources=JSON.parse(localStorage.getItem('ppp-resources')||'null');
let resources=Array.isArray(locallyStoredResources)?locallyStoredResources:starterResources;
let db=null, editingId=null, editingResourceId=null;
window.getProductInitiatives=()=>projects;


function legacyQuadrantScore(impact,lift){
 const highImpact=Number(impact)>=3.5, lowLift=Number(lift)<3.5;
 return highImpact?(lowLift?4:3):(lowLift?2:1);
}
function quadrantLabel(score){return ({4:'Quick Win',3:'Long-Term Win',2:'Slow Burn',1:'Needs Justification'})[Number(score)]||'Slow Burn';}

function calculate(p){
 const i=p.input||p;
 const assigned=(p.assignments||[]).filter(a=>a.resourceId && a.hours>0);
 const internal=assigned.length?assigned.reduce((s,a)=>{const r=resources.find(x=>x.id===a.resourceId);return s+a.hours*(r?.loadedRate||i.loadedRate||0)},0):(i.hours||0)*(i.loadedRate||0);
 const base=internal+(i.externalCost||0)+(i.capex||0);
 const contingency=base*((settings.contingency[i.uncertainty]||20)/100);
 const totalSpend=base+contingency;
 const assignedMonthly=assigned.reduce((s,a)=>{const r=resources.find(x=>x.id===a.resourceId);return s+(r?.hoursPerMonth||settings.productiveHours)*(a.allocation||.5)},0);
 const capacity=assignedMonthly || Math.max(1,(i.fte||1)*settings.productiveHours*(i.allocation||.6));
 const months=Math.max(1,Math.ceil((i.hours||0)/capacity));
 const benefit1=(i.year1Revenue||0)*(i.grossMargin||0)+(i.annualSavings||0);
 const roi=totalSpend?(benefit1-totalSpend)/totalSpend:0;
 const threeYear=((i.year1Revenue||0)+(i.year2Revenue||0)+(i.year3Revenue||0))*(i.grossMargin||0)+(i.annualSavings||0)*3-totalSpend;
 const quadrantScore=Number(i.quadrantScore)||legacyQuadrantScore(i.impact,i.lift);
 const projectTypePoints={A:3,B:2,C:1}[i.projectType]||2;
 const costEfficiencyPoints={1:3,2:2,3:1}[Number(i.costAmount)]||2;
 const quadrantPoints={4:4,3:3,2:2,1:1}[quadrantScore]||2;
 const techRiskPoints=4-Math.min(3,Math.max(1,Number(i.technicalRisk)||1));
 const productionRiskPoints=4-Math.min(3,Math.max(1,Number(i.productionRisk)||1));
 // Design/Production score: Impact/Lift 40%, Project Type 20%, Cost Amount 15%, Tech Risk 12.5%, Production Risk 12.5%. CapEx is financial only.
 const priority=Math.max(0,Math.min(100,
   (quadrantPoints/4)*40 + (projectTypePoints/3)*20 + (costEfficiencyPoints/3)*15 +
   (techRiskPoints/3)*12.5 + (productionRiskPoints/3)*12.5
 ));
 const quadrant=quadrantLabel(quadrantScore);
 const payback=benefit1>0?totalSpend/(benefit1/12):null;
 const start=p.startDate||'';
 const finish=start?addMonths(start,months-1):'';
 return{internal,base,contingency,totalSpend,capacity,months,benefit1,roi,threeYear,priority,quadrant,payback,start,finish};
}
function persist(){localStorage.setItem('ppp-resources',JSON.stringify(resources));localStorage.setItem('ppp-settings',JSON.stringify(settings));}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function categoryLabel(value){const key=String(value||'').trim().toUpperCase();return ({NPD:'NPD',CI:'CI',DPT:'Skunkworks',SUSTAINED:'Sustained - Bugs and Defects'})[key]||String(value||'');}

function safeRenderSection(name,fn){
 try{if(typeof fn==='function')fn();}
 catch(error){console.error(`Render section failed: ${name}`,error);}
}
function render(){
 safeRenderSection('KPIs',renderKpis);
 safeRenderSection('initiative mix',renderProjectMix);
 safeRenderSection('product initiatives',renderProjects);
 safeRenderSection('resources',renderResources);
 safeRenderSection('charts',renderCharts);
 safeRenderSection('executive dashboard',renderExecutiveDashboard);
 safeRenderSection('connection badge',updateConnectionBadge);
 safeRenderSection('development support',window.renderDevelopment);
 safeRenderSection('development initiative options',window.refreshDevelopmentInitiativeOptions);
}
function renderKpis(){const el=$('#kpis');if(!el)return;const m=projects.map(p=>calculate(p));const spend=m.reduce((s,c)=>s+c.totalSpend,0),value=m.reduce((s,c)=>s+c.threeYear,0),avg=m.reduce((s,c)=>s+c.priority,0)/Math.max(1,m.length),active=projects.filter(p=>p.status==='Active'||p.status==='Approved').length;el.innerHTML=[['Product Initiatives',projects.length],['Approved / Active',active],['Initiative Spend',money(spend)],['3-Year Net Benefit',money(value)],['Average Priority',avg.toFixed(0)+'/100']].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');}
function normalizeMixCategory(p){
 const value=String(p?.category||'').trim().toUpperCase();
 if(value==='SKUNKWORKS'||value==='SKUNK WORKS')return 'DPT';
 if(['SUSTAINED - BUGS AND DEFECTS','SUSTAINED – BUGS AND DEFECTS','BUGS AND DEFECTS'].includes(value))return 'SUSTAINED';
 return value;
}
function fiscalYearForStart(startDate){
 if(!startDate)return null;
 const [year,month]=String(startDate).slice(0,7).split('-').map(Number);
 if(!year||!month)return null;
 return month>=10?year+1:year;
}
function fiscalQuarterForStart(startDate,fiscalYear){
 if(!startDate)return null;
 const [year,month]=String(startDate).slice(0,7).split('-').map(Number);
 if(year===fiscalYear-1&&month>=10)return 1;
 if(year!==fiscalYear)return null;
 if(month<=3)return 2;
 if(month<=6)return 3;
 if(month<=9)return 4;
 return null;
}
function fiscalQuarterDateRange(fiscalYear,quarter){
 const starts={1:[fiscalYear-1,9,1],2:[fiscalYear,0,1],3:[fiscalYear,3,1],4:[fiscalYear,6,1]};
 const ends={1:[fiscalYear-1,11,31],2:[fiscalYear,2,31],3:[fiscalYear,5,30],4:[fiscalYear,8,30]};
 const startParts=starts[quarter],endParts=ends[quarter];
 if(!startParts||!endParts)return null;
 return{start:new Date(...startParts),end:new Date(endParts[0],endParts[1],endParts[2],23,59,59,999)};
}
function dateRangeOverlapsQuarter(startValue,endValue,fiscalYear,quarter){
 const range=fiscalQuarterDateRange(fiscalYear,quarter);
 const itemStart=monthStartDate(startValue);
 const itemEnd=monthEndDate(endValue||startValue);
 return !!(range&&itemStart&&itemEnd&&itemStart<=range.end&&itemEnd>=range.start);
}
function projectOverlapsFiscalQuarter(project,fiscalYear,quarter){
 const calculated=calculate(project);
 return dateRangeOverlapsQuarter(calculated.start,calculated.finish||calculated.start,fiscalYear,quarter);
}
function developmentOverlapsFiscalQuarter(item,fiscalYear,quarter){
 return dateRangeOverlapsQuarter(item.start_date,item.end_date||item.start_date,fiscalYear,quarter);
}
function mixFiscalYears(){
 const developmentItems=Array.isArray(window.developmentItems)?window.developmentItems:[];
 const years=new Set([
  ...projects.map(p=>fiscalYearForStart(p.startDate)).filter(Boolean),
  ...developmentItems.map(i=>fiscalYearForStart(i.start_date)).filter(Boolean)
 ]);
 const now=new Date(), current=now.getMonth()+1>=10?now.getFullYear()+1:now.getFullYear();
 years.add(current);
 return [...years].sort((a,b)=>b-a);
}
function renderWorkItemsByArea(fiscalYear){
 const chart=$('#workItemsAreaChart');
 const totalLabel=$('#workItemsAreaTotal');
 const subtitle=$('#workItemsAreaSubtitle');
 if(!chart)return;
 const items=(Array.isArray(window.developmentItems)?window.developmentItems:[]).filter(item=>
  fiscalYearForStart(item.start_date)===Number(fiscalYear)
 );
 const counts=new Map();
 items.forEach(item=>{
  const area=String(item.area||'Other').trim()||'Other';
  counts.set(area,(counts.get(area)||0)+1);
 });
 const rows=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const max=Math.max(1,...rows.map(([,count])=>count));
 if(totalLabel)totalLabel.textContent=`${items.length} ${items.length===1?'item':'items'}`;
 if(subtitle)subtitle.textContent=`FY${fiscalYear} · All Development Support items grouped by Area using Start Date`;
 if(!rows.length){
  chart.innerHTML='<div class="workItemsAreaEmpty">No Development Support items have a start date in this fiscal year.</div>';
  return;
 }
 chart.innerHTML=rows.map(([area,count],index)=>{
  const pct=Math.max(2,count/max*100);
  return `<div class="workItemsAreaRow" title="${escapeHtml(area)}: ${count}"><span>${escapeHtml(area)}</span><div class="workItemsAreaTrack"><i style="width:${pct}%" data-rank="${index%6}"></i></div><b>${count}</b></div>`;
 }).join('');
}
window.renderWorkItemsByArea=renderWorkItemsByArea;

function renderProjectMix(){
 const definitions=[
  {key:'NPD',label:'NPD',description:'New Product Development',color:'#2f6fe4'},
  {key:'CI',label:'CI',description:'Continuous Improvement',color:'#4caf50'},
  {key:'DPT',label:'Skunkworks',description:'Experimental',color:'#8a43d7'},
  {key:'SUSTAINED_CLOUD',label:'Cloud Sustained',description:'Bugs and Enhancements',color:'#ff7a16'},
  {key:'SUSTAINED_EDGE',label:'Edge Sustained',description:'Bugs and Enhancements',color:'#f5b82e'}
 ];
 const select=$('#projectMixYear');
 if(!select||!$('#projectMix'))return;
 const years=mixFiscalYears();
 const currentValue=Number(select.value)||Number(localStorage.getItem('ppp-project-mix-fy'))||years[0];
 select.innerHTML=years.map(y=>`<option value="${y}">FY${y}</option>`).join('');
 const fiscalYear=years.includes(currentValue)?currentValue:years[0];
 select.value=String(fiscalYear);
 const ranges={1:`Oct 1 – Dec 31, ${fiscalYear-1}`,2:`Jan 1 – Mar 31, ${fiscalYear}`,3:`Apr 1 – Jun 30, ${fiscalYear}`,4:`Jul 1 – Sep 30, ${fiscalYear}`};
 const labels={1:'Q1 (Oct – Dec)',2:'Q2 (Jan – Mar)',3:'Q3 (Apr – Jun)',4:'Q4 (Jul – Sep)'};
 $('#projectMix').innerHTML=[1,2,3,4].map(q=>{
  const quarterProjects=projects.filter(p=>projectOverlapsFiscalQuarter(p,fiscalYear,q));
  const quarterDevelopment=(Array.isArray(window.developmentItems)?window.developmentItems:[]).filter(i=>{
   const category=String(i.combined_type||'').trim().toLowerCase();
   return developmentOverlapsFiscalQuarter(i,fiscalYear,q) && ['bug','enhancement'].includes(category);
  });
  const counts=Object.fromEntries(definitions.map(d=>[d.key,
   d.key==='SUSTAINED_CLOUD'
    ? quarterDevelopment.filter(i=>String(i.department||'Cloud').trim().toLowerCase()==='cloud').length
    : d.key==='SUSTAINED_EDGE'
      ? quarterDevelopment.filter(i=>String(i.department||'').trim().toLowerCase()==='edge').length
      : quarterProjects.filter(p=>normalizeMixCategory(p)===d.key).length
  ]));
  const total=definitions.reduce((sum,d)=>sum+counts[d.key],0);
  let running=0;
  const segments=definitions.map(d=>{const pct=total?counts[d.key]/total*100:0;const from=running;running+=pct;return `${d.color} ${from}% ${running}%`;}).filter((_,i)=>counts[definitions[i].key]>0);
  const gradient=segments.length?`conic-gradient(${segments.join(',')})`:'conic-gradient(#e5eaf2 0 100%)';
  const rows=definitions.map(d=>{const count=counts[d.key],pct=total?Math.round(count/total*100):0;return `<div class="quarterMixRow"><i style="background:${d.color}"></i><span title="${d.label} (${d.description})">${d.label} <small>(${d.description})</small></span><b>${count}</b><strong style="color:${d.color}">${pct}%</strong></div>`}).join('');
  return `<article class="quarterMixPanel"><h3>${labels[q]}</h3><p>${ranges[q]}</p><div class="quarterDonut" style="background:${gradient}" role="img" aria-label="${labels[q]} initiative category distribution"><div><b>${total}</b><span>${total===1?'Item':'Items'}</span></div></div><div class="quarterMixRows">${rows}</div><button class="quarterViewButton" type="button" data-quarter="${q}" data-year="${fiscalYear}">☷ &nbsp; View Q${q} Initiatives</button></article>`;
 }).join('');
 renderWorkItemsByArea(fiscalYear);
 $$('.quarterViewButton').forEach(button=>button.onclick=()=>showQuarterProjects(Number(button.dataset.quarter),Number(button.dataset.year)));
 if(!select.dataset.bound){select.addEventListener('change',()=>{localStorage.setItem('ppp-project-mix-fy',select.value);renderProjectMix();renderExecutiveDashboard();});select.dataset.bound='true';}
}
window.renderProjectMix=renderProjectMix;
function ensureQuarterDrilldown(){
 let overlay=$('#quarterDrilldownOverlay');
 if(overlay)return overlay;
 document.body.insertAdjacentHTML('beforeend',`<div id="quarterDrilldownOverlay" class="overlay hidden"><div class="drawer quarterDrilldownDrawer"><div class="drawerHead"><div><h2 id="quarterDrilldownTitle">Quarter Initiative Detail</h2><p id="quarterDrilldownSubtitle"></p></div><button type="button" class="icon" id="quarterDrilldownClose">×</button></div><div id="quarterDrilldownSummary" class="quarterDrilldownSummary"></div><div id="quarterDrilldownGroups" class="quarterDrilldownGroups"></div></div></div>`);
 overlay=$('#quarterDrilldownOverlay');
 $('#quarterDrilldownClose').onclick=()=>overlay.classList.add('hidden');
 overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.classList.add('hidden');});
 return overlay;
}
function quarterDrilldownProjectRow(project,typeLabel){
 const calculated=calculate(project);
 return `<button type="button" class="quarterDrilldownRow" data-quarter-project-id="${escapeHtml(project.id)}"><span><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.division||'Unassigned')} · ${escapeHtml(categoryLabel(project.category))}</small></span><span class="quarterTypeBadge">${escapeHtml(typeLabel)}</span><span>${escapeHtml(project.status||'—')}</span><span>${escapeHtml(monthLabel(calculated.start||project.startDate))}</span><span>${escapeHtml(monthLabel(calculated.finish||calculated.start||project.startDate))}</span></button>`;
}
function quarterDrilldownDevelopmentRow(item,typeLabel){
 const initiative=projects.find(project=>String(project.id)===String(item.project_id));
 return `<button type="button" class="quarterDrilldownRow" data-quarter-development-id="${escapeHtml(item.id)}"><span><b>${escapeHtml(item.title||'Untitled Development Support Item')}</b><small>${escapeHtml(item.department||'Unassigned')} · ${escapeHtml(item.area||'Other')}${initiative?` · ${escapeHtml(initiative.name)}`:''}</small></span><span class="quarterTypeBadge">${escapeHtml(typeLabel)}</span><span>${escapeHtml(item.status||'—')}</span><span>${escapeHtml(monthLabel(item.start_date))}</span><span>${escapeHtml(monthLabel(item.end_date||item.start_date))}</span></button>`;
}
function showQuarterProjects(quarter,fiscalYear){
 const productGroups=[
  {key:'NPD',label:'NPD',description:'New Product Development'},
  {key:'CI',label:'CI',description:'Continuous Improvement'},
  {key:'DPT',label:'Skunkworks',description:'Experimental'}
 ];
 const quarterProjects=projects.filter(project=>projectOverlapsFiscalQuarter(project,fiscalYear,quarter));
 const quarterDevelopment=(Array.isArray(window.developmentItems)?window.developmentItems:[]).filter(item=>{
  const category=String(item.combined_type||'').trim().toLowerCase();
  return developmentOverlapsFiscalQuarter(item,fiscalYear,quarter)&&['bug','enhancement'].includes(category);
 });
 const groups=productGroups.map(group=>({
  ...group,
  kind:'project',
  items:quarterProjects.filter(project=>normalizeMixCategory(project)===group.key)
 }));
 groups.push({key:'SUSTAINED_CLOUD',label:'Cloud Sustained',description:'Bugs and Enhancements',kind:'development',items:quarterDevelopment.filter(item=>String(item.department||'Cloud').trim().toLowerCase()==='cloud')});
 groups.push({key:'SUSTAINED_EDGE',label:'Edge Sustained',description:'Bugs and Enhancements',kind:'development',items:quarterDevelopment.filter(item=>String(item.department||'').trim().toLowerCase()==='edge')});
 const total=groups.reduce((sum,group)=>sum+group.items.length,0);
 const range=fiscalQuarterDateRange(fiscalYear,quarter);
 const overlay=ensureQuarterDrilldown();
 $('#quarterDrilldownTitle').textContent=`FY${fiscalYear} Q${quarter} — ${total} ${total===1?'Item':'Items'}`;
 $('#quarterDrilldownSubtitle').textContent=`${range.start.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} – ${range.end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · All records counted in the dashboard donut`;
 $('#quarterDrilldownSummary').innerHTML=groups.map(group=>`<div><span>${escapeHtml(group.label)}</span><b>${group.items.length}</b></div>`).join('');
 $('#quarterDrilldownGroups').innerHTML=groups.map(group=>`<section class="quarterDrilldownGroup"><header><div><h3>${escapeHtml(group.label)}</h3><p>${escapeHtml(group.description)}</p></div><strong>${group.items.length}</strong></header><div class="quarterDrilldownHeader"><span>Initiative / Support Item</span><span>Type</span><span>Status</span><span>Start</span><span>End</span></div>${group.items.length?group.items.map(item=>group.kind==='project'?quarterDrilldownProjectRow(item,group.label):quarterDrilldownDevelopmentRow(item,group.label)).join(''):'<div class="quarterDrilldownEmpty">No items in this category.</div>'}</section>`).join('');
 $$('#quarterDrilldownGroups [data-quarter-project-id]').forEach(row=>row.onclick=()=>{overlay.classList.add('hidden');showView('projects');openProject(row.dataset.quarterProjectId);});
 $$('#quarterDrilldownGroups [data-quarter-development-id]').forEach(row=>row.onclick=()=>{overlay.classList.add('hidden');showView('development');window.openDevelopmentItem?.(row.dataset.quarterDevelopmentId);});
 overlay.classList.remove('hidden');
}

function projectRow(p, dashboard=false){const c=calculate(p);return `<tr data-id="${p.id}" class="clickable"><td><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.status)} · ${escapeHtml(categoryLabel(p.category))}</small></td><td>${escapeHtml(p.division)}</td>${dashboard?'':`<td>${escapeHtml(p.champion||'Unassigned')}</td>`}<td><span class="pill ${c.quadrant.replaceAll(' ','').replace('-','').toLowerCase()}">${c.quadrant}</span></td><td><b>${c.priority.toFixed(0)}</b></td><td>${c.months} mo.</td><td>${money(c.totalSpend)}</td><td>${(c.roi*100).toFixed(0)}%</td><td>${monthLabel(p.startDate)}</td></tr>`;}
function currentFiscalQuarterRange(date=new Date()){
 const year=date.getFullYear(),month=date.getMonth()+1;
 let fiscalYear,quarter,start,end;
 if(month>=10){fiscalYear=year+1;quarter=1;start=new Date(year,9,1);end=new Date(year,11,31,23,59,59,999);}
 else if(month<=3){fiscalYear=year;quarter=2;start=new Date(year,0,1);end=new Date(year,2,31,23,59,59,999);}
 else if(month<=6){fiscalYear=year;quarter=3;start=new Date(year,3,1);end=new Date(year,5,30,23,59,59,999);}
 else{fiscalYear=year;quarter=4;start=new Date(year,6,1);end=new Date(year,8,30,23,59,59,999);}
 return{fiscalYear,quarter,start,end};
}
function monthStartDate(value){
 if(!value)return null;
 const [year,month]=String(value).slice(0,7).split('-').map(Number);
 return year&&month?new Date(year,month-1,1):null;
}
function monthEndDate(value){
 if(!value)return null;
 const [year,month]=String(value).slice(0,7).split('-').map(Number);
 return year&&month?new Date(year,month,0,23,59,59,999):null;
}
function projectsWorkedThisQuarter(){
 const range=currentFiscalQuarterRange();
 const includedStatuses=new Set(['approved','active']);
 const list=projects.filter(project=>{
  if(!includedStatuses.has(String(project.status||'').trim().toLowerCase()))return false;
  const calculated=calculate(project);
  const projectStart=monthStartDate(calculated.start);
  const projectFinish=monthEndDate(calculated.finish||calculated.start);
  return projectStart&&projectFinish&&projectStart<=range.end&&projectFinish>=range.start;
 }).sort((a,b)=>{
  const startCompare=String(a.startDate||'').localeCompare(String(b.startDate||''));
  return startCompare||calculate(b).priority-calculate(a).priority;
 });
 return{...range,list};
}
function renderProjects(){
 const q=($('#projectSearch')?.value||'').toLowerCase();
 const list=projects.filter(p=>[p.name,p.division,p.champion,p.status,p.category].join(' ').toLowerCase().includes(q));
 $('#projectRows').innerHTML=list.map(p=>projectRow(p)).join('')||'<tr><td colspan="9" class="empty">No projects found.</td></tr>';
 const current=projectsWorkedThisQuarter();
 const dashboardRows=$('#dashboardRows');
 if(dashboardRows)dashboardRows.innerHTML=current.list.map(p=>projectRow(p,true)).join('')||'<tr><td colspan="8" class="empty">No Approved or Active projects overlap the current fiscal quarter.</td></tr>';
 const subtitle=$('#currentQuarterProjectsSubtitle');
 if(subtitle)subtitle.textContent=`FY${current.fiscalYear} Q${current.quarter} · ${current.list.length} project${current.list.length===1?'':'s'} scheduled during this quarter`;
 $$('tbody tr[data-id]').forEach(r=>r.onclick=()=>openProject(r.dataset.id));
}
function renderCharts(){
 const counts={'Quick Win':0,'Long-Term Win':0,'Slow Burn':0,'Needs Justification':0};
 projects.forEach(p=>counts[calculate(p).quadrant]++);
 const max=Math.max(1,...Object.values(counts));
 const quadrantChart=$('#quadrantChart');
 if(quadrantChart){
  quadrantChart.innerHTML=Object.entries(counts).map(([k,v])=>`<div class="barRow"><span>${k}</span><div class="barTrack"><div class="barFill" style="width:${v/max*100}%"></div></div><b>${v}</b></div>`).join('');
 }
 const totalAvail=resources.reduce((sum,resource)=>sum+resource.hoursPerMonth,0);
 const assigned=projects.filter(project=>['Approved','Active'].includes(project.status)).reduce((sum,project)=>sum+calculate(project).capacity,0);
 const util=totalAvail?assigned/totalAvail*100:0;
 const capacityEl=$('#capacitySummary');
 if(capacityEl)capacityEl.innerHTML=`<strong>${util.toFixed(0)}%</strong><span>portfolio utilization</span><div class="progress"><i style="width:${Math.min(100,util)}%"></i></div><small>${assigned.toFixed(0)} assigned of ${totalAvail.toFixed(0)} available hours per month</small>`;
}

function developmentStatusProgress(status){
 const value=String(status||'').trim().toLowerCase();
 if(['closed','complete','completed','done','released'].includes(value))return 100;
 if(['review','qa','testing'].includes(value))return 75;
 if(['in progress','in process','active'].includes(value))return 50;
 if(value==='blocked')return 25;
 return 0;
}
function executiveBarRows(values,emptyText){
 const max=Math.max(1,...values.map(v=>v.value));
 return values.length?values.map(v=>`<div class="barRow executiveBarRow"${v.id?` data-id="${v.id}"`:''}><span title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</span><div class="barTrack"><div class="barFill" style="width:${v.value/max*100}%"></div></div><b>${v.display??v.value}</b></div>`).join(''):`<div class="empty executiveEmpty">${emptyText}</div>`;
}
function currentFiscalQuarterRange(){
 const now=new Date();
 const month=now.getMonth()+1;
 const year=now.getFullYear();
 const fiscalYear=month>=10?year+1:year;
 const quarter=month>=10?1:month<=3?2:month<=6?3:4;
 const starts={1:[fiscalYear-1,10,1],2:[fiscalYear,1,1],3:[fiscalYear,4,1],4:[fiscalYear,7,1]};
 const ends={1:[fiscalYear-1,12,31],2:[fiscalYear,3,31],3:[fiscalYear,6,30],4:[fiscalYear,9,30]};
 const [sy,sm,sd]=starts[quarter],[ey,em,ed]=ends[quarter];
 return {fiscalYear,quarter,start:new Date(sy,sm-1,sd),end:new Date(ey,em-1,ed,23,59,59,999)};
}
function normalizedInitiativePipelineStatus(status){
 const value=String(status||'').trim().toLowerCase();
 if(['completed','complete','closed','done'].includes(value))return 'Completed';
 if(['active','approved','in progress','in process'].includes(value))return 'In Progress';
 if(['on hold','hold','paused','blocked'].includes(value))return 'On Hold';
 if(['parking lot','cancelled','canceled'].includes(value))return null;
 return 'Planned';
}
function isDevelopmentCompleted(status){return developmentStatusProgress(status)===100;}
function renderExecutiveDashboard(){
 const pipelineEl=$('#initiativePipelineChart');
 const fiscalIssueEl=$('#fiscalIssueKpis');
 const skunkworksRowsEl=$('#skunkworksRows');
 if(!pipelineEl&&!fiscalIssueEl&&!skunkworksRowsEl)return;
 const items=Array.isArray(window.developmentItems)?window.developmentItems:[];
 const pipelineCounts={'Planned':0,'In Progress':0,'On Hold':0,'Completed':0};
 projects.forEach(project=>{const status=normalizedInitiativePipelineStatus(project.status);if(status)pipelineCounts[status]++;});
 if(pipelineEl)pipelineEl.innerHTML=executiveBarRows(Object.entries(pipelineCounts).map(([name,value])=>({name,value})), 'No Product Initiatives are available.');

 const selectedFiscalYear=Number($('#projectMixYear')?.value)||range.fiscalYear;
 const normalizeDepartment=value=>String(value||'').trim().toLowerCase();
 const fiscalItems=items.filter(item=>fiscalYearForStart(item.start_date)===selectedFiscalYear);
 const departmentItems=department=>fiscalItems.filter(item=>normalizeDepartment(item.department)===department);
 const cloudItems=departmentItems('cloud');
 const edgeItems=departmentItems('edge');
 const openItems=list=>list.filter(item=>!isDevelopmentCompleted(item.status));
 const fiscalIssueValues=[
  ['Cloud Total Issues',cloudItems.length],
  ['Cloud Open Issues',openItems(cloudItems).length],
  ['Edge Total Issues',edgeItems.length],
  ['Edge Open Issues',openItems(edgeItems).length]
 ];
 if(fiscalIssueEl)fiscalIssueEl.innerHTML=fiscalIssueValues.map(([label,value])=>`<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`).join('');
 const fiscalSubtitle=$('#fiscalIssuesSubtitle');
 if(fiscalSubtitle)fiscalSubtitle.textContent=`FY${selectedFiscalYear} Development Support totals by start date; Open excludes Complete, Completed, and Closed`;

 const skunkworks=projects.filter(project=>{
   const category=String(project.category||'').trim().toUpperCase();
   return category==='DPT'||category==='SKUNKWORKS'||category==='SKUNK WORKS';
 }).sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||''))||String(a.name||'').localeCompare(String(b.name||'')));
 const total=$('#skunkworksTotal');
 if(total)total.textContent=`${skunkworks.length} initiative${skunkworks.length===1?'':'s'}`;
 if(skunkworksRowsEl){
  skunkworksRowsEl.innerHTML=skunkworks.map(project=>`<tr data-id="${project.id}" class="clickable"><td><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.description||'Skunkworks initiative')}</small></td><td>${escapeHtml(project.status||'Planned')}</td><td>${escapeHtml(project.division||'—')}</td><td>${escapeHtml(project.champion||'Unassigned')}</td><td>${monthLabel(project.startDate)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No Skunkworks Product Initiatives are currently listed.</td></tr>';
  $$('#skunkworksRows tr[data-id]').forEach(row=>row.onclick=()=>openProject(row.dataset.id));
 }
}
window.renderExecutiveDashboard=renderExecutiveDashboard;

function renderResources(){const assignedFor=id=>projects.reduce((s,p)=>s+(p.assignments||[]).filter(a=>a.resourceId===id).reduce((x,a)=>x+(a.allocation||0),0),0);$('#resourceRows').innerHTML=resources.map(r=>{const alloc=assignedFor(r.id),hours=r.hoursPerMonth*alloc;return `<tr><td><b>${escapeHtml(r.name)}</b></td><td>${escapeHtml(r.role)}</td><td>${escapeHtml(r.department)}</td><td>${money(r.loadedRate)}/hr</td><td>${r.hoursPerMonth}</td><td>${hours.toFixed(0)} hrs/mo.</td><td>${(alloc*100).toFixed(0)}%</td><td><button class="link editResource" data-id="${r.id}">Edit</button></td></tr>`}).join('');$$('.editResource').forEach(b=>b.onclick=e=>{e.stopPropagation();openResource(b.dataset.id)});}

function populateProjectPeople(champion='Unassigned',sponsor=''){
 const people=[...resources].sort((a,b)=>a.name.localeCompare(b.name));
 const option=(r,selected)=>`<option value="${escapeHtml(r.name)}" ${r.name===selected?'selected':''}>${escapeHtml(r.name)}${r.role?` — ${escapeHtml(r.role)}`:''}${r.department?` (${escapeHtml(r.department)})`:''}</option>`;
 const knownNames=new Set(people.map(r=>r.name));
 let championOptions='<option value="Unassigned">Unassigned</option>'+people.map(r=>option(r,champion)).join('');
 if(champion && champion!=='Unassigned' && !knownNames.has(champion)) championOptions+=`<option value="${escapeHtml(champion)}" selected>${escapeHtml(champion)} — Legacy value</option>`;
 let sponsorOptions='<option value="">No sponsor selected</option>'+people.map(r=>option(r,sponsor)).join('');
 if(sponsor && !knownNames.has(sponsor)) sponsorOptions+=`<option value="${escapeHtml(sponsor)}" selected>${escapeHtml(sponsor)} — Legacy value</option>`;
 $('#champion').innerHTML=championOptions;
 $('#sponsor').innerHTML=sponsorOptions;
 $('#champion').value=champion||'Unassigned';
 $('#sponsor').value=sponsor||'';
}
function openProject(id=null){editingId=id;const p=id?projects.find(x=>x.id===id):{id:null,name:'',description:'',division:'IDS',category:'CI',status:'Proposed',champion:'Unassigned',sponsor:'',startDate:'',input:{...starterDefaults,grossMargin:settings.defaultMargin/100,hours:400,externalCost:25000,year1Revenue:250000,year2Revenue:275000,year3Revenue:302500},assignments:[]};populateProjectPeople(p.champion||'Unassigned',p.sponsor||'');$('#drawerTitle').textContent=id?'Edit Project':'New Product Initiative';$('#deleteProject').classList.toggle('hidden',!id);const map={name:p.name,description:p.description,division:p.division,category:p.category,status:p.status,champion:p.champion,sponsor:p.sponsor,startDate:p.startDate,hours:p.input.hours,loadedRate:p.input.loadedRate,externalCost:p.input.externalCost,capex:p.input.capex,year1Revenue:p.input.year1Revenue,year2Revenue:p.input.year2Revenue,year3Revenue:p.input.year3Revenue,annualSavings:p.input.annualSavings,grossMargin:(p.input.grossMargin||0)*100,uncertainty:p.input.uncertainty};Object.entries(map).forEach(([k,v])=>{const el=$('#'+k);if(el)el.value=v??''});$('#projectType').value=p.input.projectType||'A';$('#costAmount').value=p.input.costAmount||1;$('#quadrantScore').value=p.input.quadrantScore??legacyQuadrantScore(p.input.impact,p.input.lift);scoreFields.forEach(f=>$('#'+f.id).value=p.input[f.id]??f.default);$('#scoringCapex').value=p.input.capex||0;renderAssignments(p.assignments||[]);showTab('overview');$('#projectOverlay').classList.remove('hidden');if(window.renderLinkedDevelopmentForProject)window.renderLinkedDevelopmentForProject(id);estimate();}
const scoreFields=[{id:'technicalRisk',label:'Technical Risk',default:1},{id:'productionRisk',label:'Production Risk',default:1}];
$('.scoreGrid').innerHTML=`
<label>Project Type<select id="projectType"><option value="A">A — 1–3 Months</option><option value="B">B — 3 Months–1 Year</option><option value="C">C — 1–3 Years</option></select></label>
<label>Cost Amount<select id="costAmount"><option value="1">1 — $ | $50K–$250K</option><option value="2">2 — $$ | $250K–$500K</option><option value="3">3 — $$$ | $500K+</option></select></label>
<label class="quadrantField">Impact / Lift Classification<select id="quadrantScore"><option value="4">4 — High Impact / Low Lift — Quick Win</option><option value="3">3 — High Impact / High Lift — Long-Term</option><option value="2">2 — Low Impact / Low Lift — Slow Burn</option><option value="1">1 — Low Impact / High Lift — Needs Justification</option></select></label>
<label>Technical Risk<select id="technicalRisk"><option value="1">1 — Low Risk</option><option value="2">2 — Medium Risk</option><option value="3">3 — High Risk</option></select></label>
<label>Production Risk<select id="productionRisk"><option value="1">1 — Low Risk</option><option value="2">2 — Medium Risk</option><option value="3">3 — High Risk</option></select></label>
<label>CapEx (Financial Input)<input id="scoringCapex" type="number" min="0" step="1000" inputmode="decimal"></label>`;
function readProject(){const n=id=>Number($('#'+id)?.value)||0;const assignments=readAssignments();const totalFte=assignments.reduce((sum,a)=>sum+(a.allocation||0),0);const averageAllocation=assignments.length?totalFte/assignments.length:0;return{id:editingId||uid(),name:$('#name').value.trim(),description:$('#description').value.trim(),division:$('#division').value,category:$('#category').value,status:$('#status').value,champion:$('#champion').value||'Unassigned',sponsor:$('#sponsor').value||'',startDate:$('#startDate').value,input:{hours:n('hours'),loadedRate:n('loadedRate'),externalCost:n('externalCost'),capex:n('scoringCapex'),year1Revenue:n('year1Revenue'),year2Revenue:n('year2Revenue'),year3Revenue:n('year3Revenue'),annualSavings:n('annualSavings'),grossMargin:n('grossMargin')/100,uncertainty:n('uncertainty'),fte:totalFte||1,allocation:averageAllocation||0.6,projectType:$('#projectType').value,costAmount:n('costAmount'),quadrantScore:n('quadrantScore'),...Object.fromEntries(scoreFields.map(f=>[f.id,n(f.id)]))},assignments};}
function estimate(){const p=readProject(),c=calculate(p);$('#estimate').innerHTML=`<div><span>Quadrant</span><b>${c.quadrant}</b></div><div><span>Priority</span><b>${c.priority.toFixed(0)}/100</b></div><div><span>Duration</span><b>${c.months} months</b></div><div><span>Total spend</span><b>${money(c.totalSpend)}</b></div><div><span>ROI</span><b>${(c.roi*100).toFixed(0)}%</b></div>`;renderSchedule(c,p);}
function renderSchedule(c,p){if(!$('#schedulePreview'))return;const start=p.startDate;if(!start){$('#schedulePreview').innerHTML='<span>Select a start month to generate the monthly schedule.</span>';return}let cells='';for(let i=0;i<c.months;i++)cells+=`<div class="month"><b>${i===0?'S':i===c.months-1?'E':'X'}</b><span>${monthLabel(addMonths(start,i))}</span></div>`;$('#schedulePreview').innerHTML=cells;}
function renderAssignments(assignments){
 const rows=assignments.length?assignments:[{}];
 $('#assignmentRows').innerHTML=rows.map((a,i)=>assignmentHtml(a,i)).join('');
 bindAssignments();
}
function assignmentHtml(a={},i){
 const resource=resources.find(r=>r.id===a.resourceId);
 const department=a.department||resource?.department||'';
 const role=a.role||resource?.role||'';
 return `<div class="assignment" data-index="${i}">
  <select class="assignmentResource" aria-label="Resource"><option value="">Choose resource</option>${resources.map(r=>`<option value="${r.id}" ${a.resourceId===r.id?'selected':''}>${escapeHtml(r.name)}</option>`).join('')}</select>
  <input class="assignmentDepartment" aria-label="Department" value="${escapeHtml(department)}" placeholder="Department" readonly>
  <input class="assignmentRole" aria-label="Role" value="${escapeHtml(role)}" placeholder="Role">
  <input class="assignmentAllocation" aria-label="Allocation percent" type="number" min="1" max="100" step="1" value="${Math.round((a.allocation??.5)*100)}">
  <input class="assignmentStart" aria-label="Start month" type="month" value="${escapeHtml((a.startMonth||a.startDate||'').slice(0,7))}">
  <input class="assignmentFinish" aria-label="Finish month" type="month" value="${escapeHtml((a.finishMonth||a.finishDate||'').slice(0,7))}">
  <button type="button" class="icon removeAssignment" aria-label="Remove resource">×</button>
 </div>`;
}
function bindAssignments(){
 $$('.assignmentResource').forEach(select=>select.onchange=()=>{
   const row=select.closest('.assignment');
   const resource=resources.find(r=>r.id===select.value);
   row.querySelector('.assignmentDepartment').value=resource?.department||'';
   if(!row.querySelector('.assignmentRole').value) row.querySelector('.assignmentRole').value=resource?.role||'';
   estimate();
 });
 $$('.assignment input').forEach(x=>x.oninput=estimate);
 $$('.removeAssignment').forEach(b=>b.onclick=()=>{b.closest('.assignment').remove();estimate()});
}
function readAssignments(){
 return $$('.assignment').map(row=>{
   const resourceId=row.querySelector('.assignmentResource').value;
   const resource=resources.find(r=>r.id===resourceId);
   const allocation=Math.min(100,Math.max(0,Number(row.querySelector('.assignmentAllocation').value)||0))/100;
   const startMonth=row.querySelector('.assignmentStart').value||'';
   const finishMonth=row.querySelector('.assignmentFinish').value||'';
   return {resourceId,department:resource?.department||row.querySelector('.assignmentDepartment').value||'',role:row.querySelector('.assignmentRole').value.trim()||resource?.role||'',allocation,startMonth,finishMonth,hours:0};
 }).filter(a=>a.resourceId);
}

async function saveProject(){const p=readProject();if(!p.name){$('#name').focus();return}if(!db){alert('Supabase is not connected. Connect in Settings before saving projects.');return}try{await syncProject(p);await loadFromDb();close('projectOverlay');render();}catch(e){alert('Project save failed: '+formatDbError(e));}}
async function deleteProject(){if(!editingId||!confirm('Delete this project?'))return;if(!db){alert('Supabase is not connected.');return}try{await window.ProjectRepository.deleteProject(editingId);await loadFromDb();close('projectOverlay');render();}catch(e){alert('Project delete failed: '+formatDbError(e));}}
function openResource(id=null){editingResourceId=id;const r=id?resources.find(x=>x.id===id):{name:'',role:'',department:'',loadedRate:120,hoursPerMonth:140};$('#resourceName').value=r.name;$('#resourceRole').value=r.role;$('#resourceDepartment').value=r.department;$('#resourceRate').value=r.loadedRate;$('#resourceHours').value=r.hoursPerMonth;$('#deleteResource').classList.toggle('hidden',!id);$('#resourceOverlay').classList.remove('hidden');}
async function saveResource(){
 const r={id:editingResourceId||null,name:$('#resourceName').value.trim(),role:$('#resourceRole').value.trim(),department:$('#resourceDepartment').value.trim(),loadedRate:Number($('#resourceRate').value)||0,hoursPerMonth:Number($('#resourceHours').value)||0,active:true};
 if(!r.name){$('#resourceName').focus();return;}
 if(!db){alert('Supabase is not connected. Resource changes cannot be saved.');return;}
 try{
   const saved=await window.ProjectRepository.saveResource(r);
   const idx=resources.findIndex(x=>x.id===saved.id||x.id===editingResourceId);
   if(idx>=0)resources[idx]=saved;else resources.push(saved);
   persist();editingResourceId=saved.id;close('resourceOverlay');render();
 }catch(e){alert('Resource save failed: '+formatDbError(e));}
}
async function deleteResource(){
 if(!editingResourceId)return;
 const resource=resources.find(r=>r.id===editingResourceId);
 if(!resource)return;
 const assignmentCount=projects.reduce((n,p)=>n+(p.assignments||[]).filter(a=>a.resourceId===resource.id).length,0);
 const championCount=projects.filter(p=>p.champion===resource.name).length;
 const sponsorCount=projects.filter(p=>p.sponsor===resource.name).length;
 const impacts=[];
 if(assignmentCount)impacts.push(`${assignmentCount} project assignment${assignmentCount===1?'':'s'}`);
 if(championCount)impacts.push(`${championCount} champion reference${championCount===1?'':'s'}`);
 if(sponsorCount)impacts.push(`${sponsorCount} sponsor reference${sponsorCount===1?'':'s'}`);
 const detail=impacts.length?` This will also clear ${impacts.join(', ')}.`:'';
 if(!confirm(`Delete ${resource.name}?${detail}`))return;
 projects=projects.map(p=>({
   ...p,
   champion:p.champion===resource.name?'Unassigned':p.champion,
   sponsor:p.sponsor===resource.name?'':p.sponsor,
   assignments:(p.assignments||[]).filter(a=>a.resourceId!==resource.id)
 }));
 resources=resources.filter(r=>r.id!==resource.id);
 persist();
 if(db){
   try{
     await db.from('project_assignments').delete().eq('resource_id',resource.id);
     await window.ProjectRepository.deleteResource(resource.id);
     for(const p of projects.filter(p=>p.champion==='Unassigned'||!p.sponsor)) await syncProject(p);
   }catch(e){alert('Deleted locally, but Supabase cleanup failed: '+e.message);}
 }
 editingResourceId=null;
 close('resourceOverlay');
 render();
}
function close(id){$('#'+id).classList.add('hidden');}
function showTab(tab){$$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.tabPane').forEach(p=>p.classList.add('hidden'));$('#tab-'+tab).classList.remove('hidden');}
function showView(v){$$('.view').forEach(x=>x.classList.add('hidden'));$('#'+v+'View').classList.remove('hidden');$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));const labels={dashboard:['Fiscal Year Product Initiatives','Evaluate, cost, prioritize, and schedule engineering initiatives.'],projects:['Product Initiatives','Review and edit the complete project pipeline.'],roadmap:['Initiative Roadmap','Review calculated project timing, milestones, and dependencies.'],development:['Development Support','Track bugs, enhancements, tasks, releases, and product support work.'],resources:['Resource Capacity','Manage labor rates, monthly capacity, and project allocations.'],reports:['Portfolio Reports','Review performance by fiscal year and quarter.'],settings:['Settings','Configure persistence and formula defaults.']};$('#pageTitle').textContent=labels[v][0];$('#pageSubtitle').textContent=labels[v][1];$('#newProject').classList.toggle('hidden',['settings','resources','development'].includes(v));window.currentPortfolioView=v;window.refreshAllData?.({reason:`view:${v}`});}

async function connectDb(){
 const c=window.PPP_SUPABASE_CONFIG;
 if(!c||!c.url||!c.key){message('Built-in Supabase configuration is missing.',true);return}
 if(!window.supabase||typeof window.supabase.createClient!=='function'){message('Connection failed: the bundled Supabase client did not initialize. Hard refresh the page and try again.',true);return}
 try{
   message('Connecting to Supabase and loading the portfolio...');
   db=window.supabase.createClient(c.url,c.key);
   window.ProjectRepository.initialize(db);
   await window.ProjectRepository.testConnection();
   await loadFromDb();
   message(`Connected. ${projects.length} product initiatives loaded from Supabase.`);
   render();
 }catch(e){db=null;projects=[];message(`Connection failed: ${formatDbError(e)}`,true);updateConnectionBadge();render();}
}
async function loadFromDb(){
 if(!db){projects=[];render();return}
 const portfolio=await window.ProjectRepository.getPortfolio();
 projects=portfolio.projects;window.projects=projects;
 if(portfolio.resources.length){
   resources=portfolio.resources;
 }else if(Array.isArray(locallyStoredResources)&&locallyStoredResources.length){
   try{
     resources=await window.ProjectRepository.bulkSaveResources(locallyStoredResources);
     message(`Supabase connected. ${resources.length} local resources were migrated to Supabase.`);
   }catch(resourceError){
     resources=locallyStoredResources;
     console.error('Resource migration failed:',resourceError);
     message(`Supabase connected, but local resources could not be migrated: ${formatDbError(resourceError)}`,true);
   }
 }else{
   resources=[];
 }
 persist();
}

let refreshAllDataPromise=null;
async function refreshAllData(options={}){
 if(refreshAllDataPromise)return refreshAllDataPromise;
 refreshAllDataPromise=(async()=>{
   try{
     if(!db){
       const c=window.PPP_SUPABASE_CONFIG;
       if(!c?.url||!c?.key)throw new Error('Built-in Supabase configuration is missing.');
       if(!window.supabase?.createClient)throw new Error('The bundled Supabase client did not initialize.');
       db=window.supabase.createClient(c.url,c.key);
       window.ProjectRepository.initialize(db);
       await window.ProjectRepository.testConnection();
     }
     await loadFromDb();
     if(typeof window.loadDevelopmentItems==='function')await window.loadDevelopmentItems();
     render();
     window.renderRoadmap?.();
     window.renderDevelopmentRoadmap?.();
     updateConnectionBadge();
     message(`Supabase refreshed. ${projects.length} initiatives loaded.`);
     return true;
   }catch(e){
     console.error('Supabase refresh failed:',e);
     message('Supabase refresh failed: '+formatDbError(e),true);
     updateConnectionBadge();
     render();
     return false;
   }finally{
     refreshAllDataPromise=null;
   }
 })();
 return refreshAllDataPromise;
}
window.refreshAllData=refreshAllData;
async function syncProject(p){
 if(!db)throw new Error('Supabase is not connected.');
 return window.ProjectRepository.saveProject(p);
}
function updateConnectionBadge(){const online=!!db;$('#connectionBadge').textContent=online?`Supabase · ${projects.length} initiatives`:'Supabase disconnected';$('#connectionBadge').className='connection '+(online?'online':'offline');}
function message(t,error=false){const el=$('#settingsMessage');if(!el)return;el.textContent=t;el.className='message '+(error?'error':'success');}
function formatDbError(error){if(!error)return 'Unknown Supabase error.';const text=error.message||String(error);if(error.status===404||/Could not find the table|relation .* does not exist/i.test(text))return `${text} Run supabase/schema.sql in the Supabase SQL Editor, then reconnect.`;if(error.status===401||error.status===403)return `${text} Check the publishable key and Row Level Security policies.`;if(error.code==='NETWORK_ERROR'||/Failed to fetch|Network/i.test(text))return `${text} Confirm this device can reach the Supabase URL.`;return text;}
async function bootstrapDb(){
 const badge=$('#connectionBadge');if(badge){badge.textContent='Loading Supabase…';badge.className='connection';}
 await refreshAllData({reason:'bootstrap'});
}

$$('nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#newProject').onclick=()=>openProject();$('#projectSearch').oninput=renderProjects;$('#addResource').onclick=()=>openResource();$('#saveResource').onclick=saveResource;$('#deleteResource').onclick=deleteResource;$('#saveProject').onclick=saveProject;$('#deleteProject').onclick=deleteProject;$('#addAssignment').onclick=()=>{$('#assignmentRows').insertAdjacentHTML('beforeend',assignmentHtml({},$$('.assignment').length));bindAssignments();estimate()};$$('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));$$('.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));$('#projectForm').addEventListener('input',estimate);$('#saveFormulaSettings').onclick=()=>{settings={productiveHours:Number($('#productiveHours').value)||140,defaultMargin:Number($('#defaultMargin').value)||35,contingency:{1:Number($('#cont1').value)||10,2:Number($('#cont2').value)||20,3:Number($('#cont3').value)||35}};persist();message('Formula defaults saved.');render()};$('#productiveHours').value=settings.productiveHours;$('#defaultMargin').value=settings.defaultMargin;$('#cont1').value=settings.contingency[1];$('#cont2').value=settings.contingency[2];$('#cont3').value=settings.contingency[3];
window.addEventListener('pageshow',()=>window.refreshAllData?.({reason:'pageshow'}));
window.addEventListener('focus',()=>window.refreshAllData?.({reason:'focus'}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')window.refreshAllData?.({reason:'visible'});});
bootstrapDb();
