(() => {
  let items=[];
  let editingId=null;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid=()=>crypto.randomUUID?.()||`dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const normalize=v=>String(v||'').trim();
  const fmtDate=v=>{if(!v)return '';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});};
  const when=i=>i.start_date||i.end_date?`${fmtDate(i.start_date)}${i.start_date&&i.end_date?' – ':''}${fmtDate(i.end_date)}`:'';
  const currentDb=()=>typeof db!=='undefined'?db:null;
  const initiatives=()=>typeof window.getProductInitiatives==='function'?(window.getProductInitiatives()||[]):(window.projects||[]);
  const initiativeName=id=>initiatives().find(p=>p.id===id)?.name||'';
  function refreshInitiativeOptions(selected=''){const el=$('#devProjectId');if(!el)return;const current=selected||el.value||'';el.innerHTML='<option value="">No linked initiative</option>'+initiatives().slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');el.value=[...el.options].some(o=>o.value===current)?current:'';}
  function renderLinkedDevelopmentForProject(projectId){const el=$('#linkedDevelopmentItems');if(!el)return;if(!projectId){el.innerHTML='<div class="linkedDevelopmentEmpty">Save the product initiative before linking Development Support items.</div>';return;}const linked=items.filter(i=>i.project_id===projectId);el.innerHTML=linked.length?linked.map(i=>`<div class="linkedDevelopmentItem" data-linked-development-id="${esc(i.id)}"><strong>${esc(i.title||'Untitled item')}</strong><small>${esc(i.department||'')} · ${esc(i.combined_type||'')}</small><span class="devStatus">${esc(i.status||'')}</span></div>`).join(''):'<div class="linkedDevelopmentEmpty">No Development Support items are linked to this initiative.</div>';$$('[data-linked-development-id]').forEach(row=>row.onclick=()=>open(row.dataset.linkedDevelopmentId));}

  async function load(){
    const client=currentDb();
    if(!client){items=[];window.developmentItems=items;render();if(typeof window.renderDevelopmentRoadmap==='function')window.renderDevelopmentRoadmap();if(typeof window.renderProjectMix==='function')window.renderProjectMix();if(typeof window.renderExecutiveDashboard==='function')window.renderExecutiveDashboard();return;}
    const {data,error}=await client.from('development_items').select('*').order('start_date',{ascending:false,nullsFirst:false}).order('department',{ascending:true,nullsFirst:false}).order('source_line',{ascending:false,nullsFirst:false});
    if(error){console.warn('Development items unavailable:',error.message);items=[];window.developmentItems=items;render();if(typeof window.renderDevelopmentRoadmap==='function')window.renderDevelopmentRoadmap();if(typeof window.renderProjectMix==='function')window.renderProjectMix();if(typeof window.renderExecutiveDashboard==='function')window.renderExecutiveDashboard();return;}
    items=data||[];window.developmentItems=items;render();refreshInitiativeOptions();if(typeof window.renderDevelopmentRoadmap==='function')window.renderDevelopmentRoadmap();if(typeof window.renderProjectMix==='function')window.renderProjectMix();if(typeof window.renderExecutiveDashboard==='function')window.renderExecutiveDashboard();
  }
  async function save(item){
    const client=currentDb();
    if(!client)throw new Error('Supabase is not connected.');
    const payload={...item,updated_at:new Date().toISOString()};
    let query;
    if(payload.source_line!=null&&payload.department){delete payload.id;query=client.from('development_items').upsert(payload,{onConflict:'source_line,department'});}
    else{query=client.from('development_items').upsert(payload);}
    const {error}=await query;
    if(error)throw error;
  }
  function unique(field){return [...new Set(items.map(i=>normalize(i[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function fillFilter(id,field,label){const el=$(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="all">All ${label}</option>`+unique(field).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');el.value=[...el.options].some(o=>o.value===old)?old:'all';}
  function filtered(){
    const q=normalize($('#developmentSearch')?.value).toLowerCase();
    const checks=[['release','#developmentReleaseFilter'],['area','#developmentAreaFilter'],['department','#developmentDepartmentFilter'],['combined_type','#developmentTypeFilter'],['status','#developmentStatusFilter'],['priority','#developmentPriorityFilter']];
    return items.filter(i=>{
      if(q&&!['title','area','release','department','labels','assignees','combined_type'].some(k=>normalize(i[k]).toLowerCase().includes(q)))return false;
      return checks.every(([field,id])=>{const v=$(id)?.value||'all';return v==='all'||normalize(i[field])===v;});
    });
  }
  function renderKpis(){
    const el=$('#developmentKpis');if(!el)return;
    const open=items.filter(i=>!['closed','done','completed'].includes(normalize(i.status).toLowerCase())).length;
    const bugs=items.filter(i=>normalize(i.combined_type).toLowerCase()==='bug').length;
    const enhancements=items.filter(i=>normalize(i.combined_type).toLowerCase()==='enhancement').length;
    const critical=items.filter(i=>normalize(i.priority).toLowerCase().includes('critical')).length;
    el.innerHTML=[['Development Items',items.length],['Open Work',open],['Bugs',bugs],['Enhancements',enhancements],['Critical Priority',critical]].map(([l,v])=>`<div class="kpi"><span>${l}</span><strong>${v}</strong></div>`).join('');
  }
  function render(){
    renderKpis();
    fillFilter('#developmentReleaseFilter','release','releases');fillFilter('#developmentAreaFilter','area','areas');fillFilter('#developmentDepartmentFilter','department','departments');fillFilter('#developmentTypeFilter','combined_type','categories');fillFilter('#developmentStatusFilter','status','statuses');fillFilter('#developmentPriorityFilter','priority','priorities');
    const rows=$('#developmentRows');if(!rows)return;
    const list=filtered();
    rows.innerHTML=list.length?list.map(i=>`<tr data-development-id="${esc(i.id)}" tabindex="0"><td>${esc(i.source_line||'')}</td><td><span class="devDepartment dev-${normalize(i.department||'Cloud').toLowerCase()}">${esc(i.department||'Cloud')}</span></td><td>${esc(i.release||'')}</td><td>${esc(when(i))}</td><td>${esc(i.area||'')}</td><td><span class="devType dev-${normalize(i.combined_type).toLowerCase()}">${esc(i.combined_type||'')}</span></td><td class="developmentInitiative">${esc(initiativeName(i.project_id)||'—')}</td><td class="developmentTitle">${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(i.title)}</a>`:esc(i.title)}</td><td>${esc(i.assignees||'')}</td><td><span class="devStatus">${esc(i.status||'')}</span></td><td>${esc(i.size||'')}</td><td>${esc(i.labels||'')}</td><td><span class="devPriority">${esc(i.priority||'')}</span></td></tr>`).join(''):`<tr><td colspan="13" class="emptyState">No development items match the current filters.</td></tr>`;
    $$('[data-development-id]').forEach(r=>{r.onclick=()=>open(r.dataset.developmentId);r.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(r.dataset.developmentId);}};});
    requestAnimationFrame(()=>{const scroll=$('#developmentTableScroll'),inner=$('#developmentTopScrollInner');const table=scroll?.querySelector('.developmentTable');if(scroll&&inner)inner.style.width=`${Math.max(table?.scrollWidth||0,scroll.clientWidth)}px`;});
  }
  function open(id=null){
    editingId=id;const i=id?items.find(x=>x.id===id):{};
    $('#developmentDrawerTitle').textContent=id?'Edit Development Item':'New Development Support Item';
    refreshInitiativeOptions(i?.project_id||'');
    const map={devSourceLine:'source_line',devDepartment:'department',devRelease:'release',devStartDate:'start_date',devEndDate:'end_date',devArea:'area',devCombinedType:'combined_type',devStatus:'status',devSize:'size',devPriority:'priority',devTitle:'title',devUrl:'url',devPullRequests:'linked_pull_requests',devAssignees:'assignees',devLabels:'labels',devProjectId:'project_id'};
    Object.entries(map).forEach(([el,k])=>{$(`#${el}`).value=i?.[k]??(el==='devDepartment'?'Cloud':'');});
    $('#deleteDevelopmentItem').classList.toggle('hidden',!id);$('#developmentOverlay').classList.remove('hidden');
  }
  function read(){return {id:editingId||uid(),source_line:Number($('#devSourceLine').value)||null,department:$('#devDepartment').value||'Cloud',release:normalize($('#devRelease').value),start_date:$('#devStartDate').value||null,end_date:$('#devEndDate').value||null,area:normalize($('#devArea').value),combined_type:$('#devCombinedType').value,project_id:$('#devProjectId').value||null,title:normalize($('#devTitle').value),url:normalize($('#devUrl').value)||null,assignees:normalize($('#devAssignees').value),status:$('#devStatus').value,size:$('#devSize').value,linked_pull_requests:normalize($('#devPullRequests').value),labels:normalize($('#devLabels').value),priority:$('#devPriority').value};}
  async function saveCurrent(){const item=read();if(item.source_line==null){$('#devSourceLine').focus();alert('Source line is required. Source Line plus Department uniquely identifies a Development item.');return;}if(!item.title){$('#devTitle').focus();return;}try{await save(item);$('#developmentOverlay').classList.add('hidden');await load();}catch(e){alert(`Development item save failed: ${e.message}`);}}
  async function remove(){if(!editingId||!confirm('Delete this development item?'))return;const client=currentDb();if(!client)return;const {error}=await client.from('development_items').delete().eq('id',editingId);if(error){alert(error.message);return;}$('#developmentOverlay').classList.add('hidden');await load();}
  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let n=0;n<text.length;n++){const c=text[n],next=text[n+1];if(c==='"'&&quoted&&next==='"'){cell+='"';n++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')n++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
    row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
  }
  const parseDate=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);};
  async function importCsv(file){
    const rows=parseCsv(await file.text());if(rows.length<2)throw new Error('CSV does not contain data rows.');
    const headers=rows[0].map(h=>h.trim().toLowerCase());const col=n=>headers.indexOf(n.toLowerCase());
    const mapped=rows.slice(1).map(r=>({source_line:Number(r[col('Source Line')])||null,department:normalize(r[col('Department')])||'Cloud',release:normalize(r[col('Release')]),start_date:parseDate(r[col('Start Date')]),end_date:parseDate(r[col('End Date')]),area:normalize(r[col('Area')]),combined_type:normalize(r[col('Combined Type')])||'Other',title:normalize(r[col('Title')]),url:normalize(r[col('URL')])||null,assignees:normalize(r[col('Assignees')]),status:normalize(r[col('Status')])||'Open',size:normalize(r[col('Size')]),linked_pull_requests:normalize(r[col('Linked pull requests')]),labels:normalize(r[col('Labels')]),priority:normalize(r[col('Priority')])||'Medium Priority',project_id:(()=>{const idx=col('Linked Product Initiative');const name=idx>=0?normalize(r[idx]):'';return initiatives().find(p=>normalize(p.name).toLowerCase()===name.toLowerCase())?.id||null;})(),updated_at:new Date().toISOString()})).filter(i=>i.title&&i.source_line!=null);
    const bySourceDepartment=new Map();mapped.forEach(item=>bySourceDepartment.set(`${item.source_line}::${item.department.toLowerCase()}`,item));
    const uniqueItems=[...bySourceDepartment.values()];
    const client=currentDb();if(!client)throw new Error('Supabase is not connected.');const {error}=await client.from('development_items').upsert(uniqueItems,{onConflict:'source_line,department'});if(error)throw error;await load();return uniqueItems.length;
  }
  function downloadCsv(){
    const headers=['Source Line','Department','Release','Start Date','End Date','When','Area','Combined Type','Linked Product Initiative','Title','URL','Assignees','Status','Size','Linked pull requests','Labels','Priority'];
    const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const body=items.map(i=>[i.source_line,i.department||'Cloud',i.release,i.start_date,i.end_date,when(i),i.area,i.combined_type,initiativeName(i.project_id),i.title,i.url,i.assignees,i.status,i.size,i.linked_pull_requests,i.labels,i.priority].map(quote).join(','));
    const blob=new Blob([[headers.map(quote).join(','),...body].join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`development-items-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#newDevelopmentItem')?.addEventListener('click',()=>open());$('#saveDevelopmentItem')?.addEventListener('click',saveCurrent);$('#deleteDevelopmentItem')?.addEventListener('click',remove);$('#uploadDevelopmentCsv')?.addEventListener('click',()=>$('#developmentCsvFile').click());$('#downloadDevelopmentCsv')?.addEventListener('click',downloadCsv);$('#developmentCsvFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const count=await importCsv(f);alert(`${count} development items imported.`);}catch(err){alert(`Import failed: ${err.message}`);}e.target.value='';});
    ['developmentSearch','developmentReleaseFilter','developmentAreaFilter','developmentTypeFilter','developmentStatusFilter','developmentPriorityFilter'].forEach(id=>$('#'+id)?.addEventListener(id==='developmentSearch'?'input':'change',render));$('#clearDevelopmentFilters')?.addEventListener('click',()=>{['developmentSearch'].forEach(id=>$('#'+id).value='');['developmentReleaseFilter','developmentAreaFilter','developmentTypeFilter','developmentStatusFilter','developmentPriorityFilter'].forEach(id=>$('#'+id).value='all');render();});
    const tableScroll=$('#developmentTableScroll');
    const topScroll=$('#developmentTopScroll');
    const topInner=$('#developmentTopScrollInner');
    let syncingScroll=false;
    const syncScrollWidth=()=>{if(!tableScroll||!topInner)return;const table=tableScroll.querySelector('.developmentTable');topInner.style.width=`${Math.max(table?.scrollWidth||0,tableScroll.clientWidth)}px`;};
    const updateScrollButtons=()=>{if(!tableScroll)return;const left=$('#developmentScrollLeft'),right=$('#developmentScrollRight');if(left)left.disabled=tableScroll.scrollLeft<=1;if(right)right.disabled=tableScroll.scrollLeft+tableScroll.clientWidth>=tableScroll.scrollWidth-1;};
    tableScroll?.addEventListener('scroll',()=>{if(syncingScroll)return;syncingScroll=true;if(topScroll)topScroll.scrollLeft=tableScroll.scrollLeft;updateScrollButtons();requestAnimationFrame(()=>syncingScroll=false);});
    topScroll?.addEventListener('scroll',()=>{if(syncingScroll)return;syncingScroll=true;if(tableScroll)tableScroll.scrollLeft=topScroll.scrollLeft;updateScrollButtons();requestAnimationFrame(()=>syncingScroll=false);});
    $('#developmentScrollLeft')?.addEventListener('click',()=>tableScroll?.scrollBy({left:-500,behavior:'smooth'}));
    $('#developmentScrollRight')?.addEventListener('click',()=>tableScroll?.scrollBy({left:500,behavior:'smooth'}));
    if(typeof ResizeObserver!=='undefined'&&tableScroll)new ResizeObserver(()=>{syncScrollWidth();updateScrollButtons();}).observe(tableScroll);
    window.addEventListener('resize',()=>{syncScrollWidth();updateScrollButtons();});
    window.developmentItems=items;window.loadDevelopmentItems=load;window.renderDevelopment=render;window.refreshDevelopmentInitiativeOptions=refreshInitiativeOptions;window.renderLinkedDevelopmentForProject=renderLinkedDevelopmentForProject;window.openDevelopmentItem=open;render();load();
    requestAnimationFrame(()=>{syncScrollWidth();updateScrollButtons();});
  });
})();
