(() => {
  // v0.4 execution management extension

  const govTab = document.querySelector('[data-tab="governance"]');
  govTab.insertAdjacentHTML('afterend','<button data-tab="execution">Execution</button>');
  document.querySelector('#tab-governance').insertAdjacentHTML('afterend', `
    <div id="tab-execution" class="tabPane hidden">
      <div class="grid">
        <label>Current phase<select id="currentPhase"><option>Discovery</option><option>Business Case</option><option>Design</option><option>Development</option><option>Validation</option><option>Launch</option><option>Benefits Realization</option><option>Closed</option></select></label>
        <label>Phase gate<select id="phaseGate"><option>Not Submitted</option><option>Pending Review</option><option>Passed</option><option>Passed with Conditions</option><option>Failed</option></select></label>
        <label>Percent complete<input id="percentComplete" type="number" min="0" max="100" value="0"></label>
        <label>Health<select id="projectHealth"><option>Green</option><option>Yellow</option><option>Red</option><option>On Hold</option></select></label>
        <label>Actual internal cost<input id="actualInternal" type="number" min="0" value="0"></label>
        <label>Actual external cost<input id="actualExternal" type="number" min="0" value="0"></label>
        <label>Actual capital cost<input id="actualCapex" type="number" min="0" value="0"></label>
        <label>Forecast completion<input id="forecastDate" type="month"></label>
      </div>
      <label>Current status summary<textarea id="statusSummary" rows="3" placeholder="What changed, what is next, and where help is needed"></textarea></label>
      <h3>Action items</h3><div id="actionRows"></div><button id="addAction" type="button" class="secondary">＋ Add Action</button>
      <h3>Status report history</h3><div id="statusReportRows"></div><button id="addStatusReport" type="button" class="secondary">＋ Add Status Report</button>
      <div id="variancePreview" class="variancePreview"></div>
    </div>`);

  const oldPersist = persist, oldRender = render, oldOpenProject = openProject, oldReadProject = readProject, oldShowView = showView, oldSyncProject = syncProject;
  const today = () => new Date().toISOString().slice(0,10);
  const ensureExecution = p => {
    p.execution ||= {currentPhase:'Discovery',phaseGate:'Not Submitted',percentComplete:0,health:'Green',actualInternal:0,actualExternal:0,actualCapex:0,forecastDate:'',statusSummary:'',actions:[],statusReports:[]};
    p.execution.actions ||= [];
    p.execution.statusReports ||= [];
    return p;
  };
  projects.forEach(ensureExecution); oldPersist();
  persist = () => { projects.forEach(ensureExecution); oldPersist(); };

  function actionHtml(a={description:'',owner:'',dueDate:'',status:'Open'}) {
    return `<div class="actionInput"><input class="actionDescription" placeholder="Action or decision required" value="${escapeHtml(a.description||'')}"><input class="actionOwner" placeholder="Owner" value="${escapeHtml(a.owner||'')}"><input class="actionDue" type="date" value="${a.dueDate||''}"><select class="actionStatus"><option ${a.status==='Open'?'selected':''}>Open</option><option ${a.status==='In Progress'?'selected':''}>In Progress</option><option ${a.status==='Blocked'?'selected':''}>Blocked</option><option ${a.status==='Complete'?'selected':''}>Complete</option></select><button type="button" class="icon removeExecutionRow">×</button></div>`;
  }
  function reportHtml(r={date:today(),summary:'',health:'Green'}) {
    return `<div class="statusReportInput"><input class="reportDate" type="date" value="${r.date||today()}"><select class="reportHealth"><option>Green</option><option ${r.health==='Yellow'?'selected':''}>Yellow</option><option ${r.health==='Red'?'selected':''}>Red</option><option ${r.health==='On Hold'?'selected':''}>On Hold</option></select><input class="reportSummary" placeholder="Status update" value="${escapeHtml(r.summary||'')}"><button type="button" class="icon removeExecutionRow">×</button></div>`;
  }
  function bindExecutionRows(){ document.querySelectorAll('.removeExecutionRow').forEach(b=>b.onclick=()=>b.parentElement.remove()); }
  function renderExecutionEditor(e){
    $('#currentPhase').value=e.currentPhase||'Discovery'; $('#phaseGate').value=e.phaseGate||'Not Submitted'; $('#percentComplete').value=e.percentComplete||0; $('#projectHealth').value=e.health||'Green';
    $('#actualInternal').value=e.actualInternal||0; $('#actualExternal').value=e.actualExternal||0; $('#actualCapex').value=e.actualCapex||0; $('#forecastDate').value=e.forecastDate||''; $('#statusSummary').value=e.statusSummary||'';
    $('#actionRows').innerHTML=(e.actions||[]).map(actionHtml).join(''); $('#statusReportRows').innerHTML=(e.statusReports||[]).map(reportHtml).join(''); bindExecutionRows(); renderVariancePreview();
  }
  function readExecution(){
    return {currentPhase:$('#currentPhase').value,phaseGate:$('#phaseGate').value,percentComplete:Math.max(0,Math.min(100,Number($('#percentComplete').value)||0)),health:$('#projectHealth').value,actualInternal:Number($('#actualInternal').value)||0,actualExternal:Number($('#actualExternal').value)||0,actualCapex:Number($('#actualCapex').value)||0,forecastDate:$('#forecastDate').value,statusSummary:$('#statusSummary').value.trim(),actions:[...document.querySelectorAll('.actionInput')].map(x=>({description:x.querySelector('.actionDescription').value.trim(),owner:x.querySelector('.actionOwner').value.trim(),dueDate:x.querySelector('.actionDue').value,status:x.querySelector('.actionStatus').value})).filter(x=>x.description),statusReports:[...document.querySelectorAll('.statusReportInput')].map(x=>({date:x.querySelector('.reportDate').value,health:x.querySelector('.reportHealth').value,summary:x.querySelector('.reportSummary').value.trim()})).filter(x=>x.summary)};
  }
  function plannedFinish(p){ const c=calculate(p); return p.startDate ? addMonths(p.startDate,Math.max(0,c.months-1)) : ''; }
  function monthDiff(a,b){ if(!a||!b)return null; const [ay,am]=a.split('-').map(Number),[by,bm]=b.split('-').map(Number); return (by-ay)*12+(bm-am); }
  function executionMetrics(p){ const e=ensureExecution(p).execution,c=calculate(p),actual=e.actualInternal+e.actualExternal+e.actualCapex,planFinish=plannedFinish(p),forecast=e.forecastDate||planFinish,scheduleVariance=monthDiff(planFinish,forecast); return {...c,actual,costVariance:actual-c.totalSpend,planFinish,forecast,scheduleVariance}; }
  function renderVariancePreview(){ if(!editingId && !$('#name').value)return; const draft=oldReadProject(); draft.execution=readExecution(); const m=executionMetrics(draft); $('#variancePreview').innerHTML=`<div><span>Approved budget</span><b>${money(m.totalSpend)}</b></div><div><span>Actual spend</span><b>${money(m.actual)}</b></div><div><span>Cost variance</span><b class="${m.costVariance>0?'bad':'good'}">${money(m.costVariance)}</b></div><div><span>Schedule variance</span><b class="${(m.scheduleVariance||0)>0?'bad':'good'}">${m.scheduleVariance===null?'—':`${m.scheduleVariance} mo.`}</b></div>`; }

  openProject = id => { oldOpenProject(id); const p=ensureExecution(id?projects.find(x=>x.id===id):{execution:{}}); renderExecutionEditor(p.execution); };
  readProject = () => { const p=oldReadProject(); p.execution=readExecution(); return p; };

  function healthClass(h){ return String(h||'Green').toLowerCase().replace(' ','-'); }
  function executionRow(p){ const m=executionMetrics(p),e=p.execution,sv=m.scheduleVariance; return `<tr data-project="${p.id}"><td><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.division)}</small></td><td>${escapeHtml(e.currentPhase)}</td><td><span class="healthBadge ${healthClass(e.health)}">${escapeHtml(e.health)}</span></td><td><div class="progressTrack"><i style="width:${e.percentComplete}%"></i></div><small>${e.percentComplete}%</small></td><td>${money(m.totalSpend)}</td><td>${money(m.actual)}</td><td class="${m.costVariance>0?'negative':'positive'}">${money(m.costVariance)}</td><td>${monthLabel(m.planFinish)}</td><td>${monthLabel(m.forecast)}</td><td class="${(sv||0)>0?'negative':'positive'}">${sv===null?'—':`${sv} mo.`}</td></tr>`; }
  function renderExecution(){
    if(!$('#executionKpis'))return;
    const ms=projects.map(p=>({p,m:executionMetrics(p)})), active=ms.filter(x=>!['Completed','Parking Lot'].includes(x.p.status)), red=active.filter(x=>x.p.execution.health==='Red'), overdueActions=projects.flatMap(p=>p.execution.actions.map(a=>({p,a}))).filter(x=>x.a.status!=='Complete'&&x.a.dueDate&&x.a.dueDate<today()), actual=ms.reduce((s,x)=>s+x.m.actual,0), budget=ms.reduce((s,x)=>s+x.m.totalSpend,0);
    $('#executionKpis').innerHTML=[['Active Projects',active.length],['Red Health',red.length],['Overdue Actions',overdueActions.length],['Portfolio Actual',money(actual)],['Budget Variance',money(actual-budget)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    const health=['Green','Yellow','Red','On Hold'].map(h=>[h,active.filter(x=>x.p.execution.health===h).length]); const max=Math.max(1,...health.map(x=>x[1])); $('#healthSummary').innerHTML=health.map(([h,n])=>`<div class="healthLine"><span class="healthBadge ${healthClass(h)}">${h}</span><div><i style="width:${n/max*100}%"></i></div><b>${n}</b></div>`).join('');
    const actions=projects.flatMap(p=>p.execution.actions.filter(a=>a.status!=='Complete').map(a=>({p,a}))).sort((a,b)=>(a.a.dueDate||'9999').localeCompare(b.a.dueDate||'9999')).slice(0,12); $('#actionQueue').innerHTML=actions.map(({p,a})=>`<div class="actionCard ${a.dueDate&&a.dueDate<today()?'overdue':''}"><header><b>${escapeHtml(a.description)}</b><span>${escapeHtml(a.status)}</span></header><small>${escapeHtml(p.name)} · ${escapeHtml(a.owner||'Unassigned')} · ${a.dueDate||'No due date'}</small></div>`).join('')||'<div class="empty">No open actions.</div>';
    $('#executionRows').innerHTML=ms.sort((a,b)=>a.p.name.localeCompare(b.p.name)).map(x=>executionRow(x.p)).join(''); document.querySelectorAll('#executionRows tr').forEach(r=>r.onclick=()=>openProject(r.dataset.project));
  }
  function csvCell(v){ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
  function exportPortfolio(){ const rows=[['Project','Division','Champion','Status','Phase','Phase Gate','Health','Percent Complete','Budget','Actual Internal','Actual External','Actual Capital','Actual Total','Cost Variance','Start','Planned Finish','Forecast Finish','Schedule Variance Months','Open Actions','Status Summary']]; projects.forEach(p=>{const m=executionMetrics(p),e=p.execution;rows.push([p.name,p.division,p.champion,p.status,e.currentPhase,e.phaseGate,e.health,e.percentComplete,m.totalSpend,e.actualInternal,e.actualExternal,e.actualCapex,m.actual,m.costVariance,p.startDate,m.planFinish,m.forecast,m.scheduleVariance??'',e.actions.filter(a=>a.status!=='Complete').length,e.statusSummary])}); const blob=new Blob([rows.map(r=>r.map(csvCell).join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`project-portfolio-execution-${today()}.csv`;a.click();URL.revokeObjectURL(a.href); }

  render = () => { oldRender(); renderExecution(); };
  showView = v => { oldShowView(v); if(v==='execution'){ $('#pageTitle').textContent='Portfolio Execution'; $('#pageSubtitle').textContent='Track phase gates, actions, actual costs, progress, and delivery variance.'; $('#newProject').classList.remove('hidden'); } };
  syncProject = async p => { await oldSyncProject(p); if(!db)return; const e=p.execution||{}; await Promise.all([db.from('project_execution').upsert({project_id:p.id,current_phase:e.currentPhase,phase_gate:e.phaseGate,percent_complete:e.percentComplete,health:e.health,actual_internal:e.actualInternal,actual_external:e.actualExternal,actual_capex:e.actualCapex,forecast_date:e.forecastDate?`${e.forecastDate}-01`:null,status_summary:e.statusSummary||null}),db.from('project_actions').delete().eq('project_id',p.id),db.from('project_status_reports').delete().eq('project_id',p.id)]); if(e.actions?.length)await db.from('project_actions').insert(e.actions.map(a=>({project_id:p.id,description:a.description,owner:a.owner||null,due_date:a.dueDate||null,status:a.status}))); if(e.statusReports?.length)await db.from('project_status_reports').insert(e.statusReports.map(r=>({project_id:p.id,report_date:r.date||today(),health:r.health,summary:r.summary}))); };

  document.querySelector('[data-view="execution"]')?.addEventListener('click',()=>showView('execution'));
  document.querySelector('[data-tab="execution"]').onclick=()=>showTab('execution');
  $('#addAction').onclick=()=>{$('#actionRows').insertAdjacentHTML('beforeend',actionHtml());bindExecutionRows();};
  $('#addStatusReport').onclick=()=>{$('#statusReportRows').insertAdjacentHTML('beforeend',reportHtml());bindExecutionRows();};
  ['percentComplete','actualInternal','actualExternal','actualCapex','forecastDate'].forEach(id=>$('#'+id).addEventListener('input',renderVariancePreview));
  if ($('#exportPortfolio')) $('#exportPortfolio').onclick=exportPortfolio;
  render();
})();
