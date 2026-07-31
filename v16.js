(() => {
  const MONTHS=['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
  const CAL_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const LEFT_WIDTH=390;
  const MONTH_WIDTH=96;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const normalize=v=>String(v||'').trim();
  const dateValue=v=>{if(!v)return null;const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?null:d;};
  const monthKey=d=>d?d.getFullYear()*12+d.getMonth():null;
  const fiscalYear=d=>d?(d.getMonth()>=9?d.getFullYear()+1:d.getFullYear()):null;
  const unique=(items,field)=>[...new Set(items.map(i=>normalize(i[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  function selectedMode(){return $('#developmentRoadmapCalendarMode')?.classList.contains('active')?'calendar':'fiscal';}
  function firstMonthIndex(mode){return mode==='fiscal'?9:0;}
  function displayMonths(mode){return mode==='fiscal'?MONTHS:CAL_MONTHS;}
  function currentItems(){return Array.isArray(window.developmentItems)?window.developmentItems:[];}
  function startYearForDate(d,mode){return mode==='fiscal'?fiscalYear(d):d?.getFullYear();}
  function baseStartDate(year,mode){return new Date(mode==='fiscal'?year-1:year,firstMonthIndex(mode),1,12);}

  function statusClass(status){
    const s=normalize(status).toLowerCase();
    if(['closed','complete','completed','done','released'].some(v=>s.includes(v)))return 'status-complete';
    if(s.includes('block'))return 'status-blocked';
    if(s.includes('hold'))return 'status-hold';
    if(['active','in progress','review','testing','ready for test'].some(v=>s.includes(v)))return 'status-active';
    return 'status-open';
  }

  function fillSelect(id,values,label){
    const el=$(id);if(!el)return;
    const old=el.value||'all';
    el.innerHTML=`<option value="all">All ${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    el.value=[...el.options].some(o=>o.value===old)?old:'all';
  }

  function initializeYearOptions(){
    const select=$('#developmentRoadmapYear');if(!select)return;
    const mode=selectedMode();
    const years=new Set();
    currentItems().forEach(i=>{
      const d=dateValue(i.start_date)||dateValue(i.end_date);
      const y=startYearForDate(d,mode);if(y)years.add(y);
    });
    const today=new Date();years.add(mode==='fiscal'?fiscalYear(today):today.getFullYear());
    const sorted=[...years].sort((a,b)=>b-a);
    const stored=Number(localStorage.getItem(`developmentRoadmapYear-${mode}`));
    const current=Number(select.value)||stored||sorted[0];
    select.innerHTML=sorted.map(y=>`<option value="${y}">${mode==='fiscal'?'FY':'CY'}${y}</option>`).join('');
    select.value=String(sorted.includes(current)?current:sorted[0]);
  }

  function visibleRange(year,span,mode){
    const start=baseStartDate(year,mode);
    const end=new Date(start.getFullYear(),start.getMonth()+span*12,0,23,59,59,999);
    return {start,end,startKey:monthKey(start),endKey:monthKey(end)};
  }

  function overlapsVisibleRange(item,range){
    const start=dateValue(item.start_date)||dateValue(item.end_date);
    const end=dateValue(item.end_date)||start;
    if(!start||!end)return Boolean($('#developmentRoadmapShowUnscheduled')?.checked);
    const itemStart=Math.min(monthKey(start),monthKey(end));
    const itemEnd=Math.max(monthKey(start),monthKey(end));
    return itemStart<=range.endKey&&itemEnd>=range.startKey;
  }

  function filteredItems(year,span,mode){
    const checks=[
      ['department','#devRoadmapDepartment'],['release','#devRoadmapRelease'],['area','#devRoadmapArea'],
      ['combined_type','#devRoadmapCategory'],['status','#devRoadmapStatus'],['priority','#devRoadmapPriority']
    ];
    const range=visibleRange(year,span,mode);
    return currentItems().filter(item=>
      overlapsVisibleRange(item,range)&&
      checks.every(([field,id])=>{const v=$(id)?.value||'all';return v==='all'||normalize(item[field])===v;})
    );
  }

  function buildHeader(year,span,mode){
    const monthCount=span*12,total=LEFT_WIDTH+monthCount*MONTH_WIDTH,months=displayMonths(mode);
    const yearCells=Array.from({length:span},(_,i)=>`<div style="grid-column:span 12">${mode==='fiscal'?'FY':'CY'}${year+i}</div>`).join('');
    const quarters=Array.from({length:span*4},(_,i)=>`<div style="grid-column:span 3">${mode==='fiscal'?'FY':'CY'}${year+Math.floor(i/4)} Q${i%4+1}</div>`).join('');
    const monthCells=Array.from({length:monthCount},(_,i)=>`<div>${months[i%12]}</div>`).join('');
    return `<div class="devRoadmapHeader" style="width:${total}px">
      <div class="devRoadmapHeaderRow devRoadmapYearRow" style="grid-template-columns:${LEFT_WIDTH}px repeat(${monthCount},${MONTH_WIDTH}px)"><div></div>${yearCells}</div>
      <div class="devRoadmapHeaderRow devRoadmapQuarterRow" style="grid-template-columns:${LEFT_WIDTH}px repeat(${monthCount},${MONTH_WIDTH}px)"><div>${mode==='fiscal'?'Fiscal Period':'Calendar Period'}</div>${quarters}</div>
      <div class="devRoadmapHeaderRow devRoadmapMonthRow" style="grid-template-columns:${LEFT_WIDTH}px repeat(${monthCount},${MONTH_WIDTH}px)"><div>Development Support Item</div>${monthCells}</div>
    </div>`;
  }

  function durationLabel(start,end){
    if(!start&&!end)return '';
    if(start&&end){const months=Math.max(1,monthKey(end)-monthKey(start)+1);return `${months} mo.`;}
    return '1 mo.';
  }

  function buildRow(item,index,year,span,mode){
    const monthCount=span*12,totalTimeline=monthCount*MONTH_WIDTH;
    const start=dateValue(item.start_date)||dateValue(item.end_date);
    const end=dateValue(item.end_date)||start;
    const base=baseStartDate(year,mode),baseKey=monthKey(base);
    let bar='';
    if(start){
      const rawStart=monthKey(start)-baseKey,rawEnd=monthKey(end)-baseKey;
      if(rawEnd>=0&&rawStart<monthCount){
        const from=Math.max(0,rawStart),to=Math.min(monthCount-1,Math.max(rawStart,rawEnd));
        const left=from*MONTH_WIDTH+8,width=Math.max(34,(to-from+1)*MONTH_WIDTH-14);
        bar=`<div class="devRoadmapBar ${statusClass(item.status)}" data-dev-roadmap-id="${esc(item.id)}" style="left:${left}px;width:${width}px"><span class="devRoadmapStart">●</span><span>${esc(durationLabel(start,end))}</span><span class="devRoadmapFinish">★</span></div>`;
      } else bar='<span class="devRoadmapUnscheduled">Outside selected period</span>';
    } else bar='<span class="devRoadmapUnscheduled">Unscheduled — add a start and end date in Development Support</span>';
    const initiative=(window.projects||[]).find(p=>p.id===item.project_id)?.name||'';
    const meta=[item.department,item.area,item.combined_type,item.release,item.status].filter(Boolean).join(' · ');
    return `<div class="devRoadmapRow" style="grid-template-columns:${LEFT_WIDTH}px ${totalTimeline}px">
      <div class="devRoadmapLeft" data-dev-roadmap-id="${esc(item.id)}" tabindex="0" role="button"><strong>${esc(item.title||'Untitled Development Support item')}</strong><small>${esc(meta)}${initiative?` · ${esc(initiative)}`:''}</small></div>
      <div class="devRoadmapTimeline" style="--dev-month-width:${MONTH_WIDTH}px;grid-template-columns:repeat(${monthCount},${MONTH_WIDTH}px)">${bar}</div>
    </div>`;
  }

  function syncScroll(){
    const grid=$('#developmentRoadmapGrid'),top=$('#developmentRoadmapTopScroll'),inner=$('#developmentRoadmapTopScrollInner');
    if(!grid||!top||!inner)return;
    const table=grid.querySelector('.devRoadmapTable');inner.style.width=`${Math.max(table?.scrollWidth||0,grid.clientWidth)}px`;
    top.scrollLeft=grid.scrollLeft;
    const left=$('#developmentRoadmapScrollLeft'),right=$('#developmentRoadmapScrollRight');
    if(left)left.disabled=grid.scrollLeft<=1;
    if(right)right.disabled=grid.scrollLeft+grid.clientWidth>=grid.scrollWidth-1;
  }

  function render(){
    const grid=$('#developmentRoadmapGrid');if(!grid)return;
    const all=currentItems();
    fillSelect('#devRoadmapDepartment',unique(all,'department'),'departments');fillSelect('#devRoadmapRelease',unique(all,'release'),'releases');
    fillSelect('#devRoadmapArea',unique(all,'area'),'areas');fillSelect('#devRoadmapCategory',unique(all,'combined_type'),'categories');
    fillSelect('#devRoadmapStatus',unique(all,'status'),'statuses');fillSelect('#devRoadmapPriority',unique(all,'priority'),'priorities');
    initializeYearOptions();
    const year=Number($('#developmentRoadmapYear')?.value)||new Date().getFullYear();
    const span=Number($('#developmentRoadmapYearSpan')?.value)||1,mode=selectedMode();
    const items=filteredItems(year,span,mode).slice().sort((a,b)=>{
      const ad=dateValue(a.start_date)?.getTime()||Number.MAX_SAFE_INTEGER,bd=dateValue(b.start_date)?.getTime()||Number.MAX_SAFE_INTEGER;
      return ad-bd||normalize(a.department).localeCompare(normalize(b.department))||normalize(a.title).localeCompare(normalize(b.title));
    });
    const monthCount=span*12,total=LEFT_WIDTH+monthCount*MONTH_WIDTH;
    grid.innerHTML=`<div class="devRoadmapTable" style="width:${total}px">${buildHeader(year,span,mode)}<div class="devRoadmapBody">${items.length?items.map((item,i)=>buildRow(item,i,year,span,mode)).join(''):'<div class="emptyState" style="padding:30px">No Development Support items match the selected filters.</div>'}</div></div>`;
    grid.querySelectorAll('[data-dev-roadmap-id]').forEach(el=>{
      const open=()=>window.openDevelopmentItem?.(el.dataset.devRoadmapId);
      el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    });
    requestAnimationFrame(syncScroll);
  }

  function setMode(mode){
    const fiscal=$('#developmentRoadmapFiscalMode'),calendar=$('#developmentRoadmapCalendarMode');
    fiscal?.classList.toggle('active',mode==='fiscal');calendar?.classList.toggle('active',mode==='calendar');
    fiscal?.setAttribute('aria-pressed',String(mode==='fiscal'));calendar?.setAttribute('aria-pressed',String(mode==='calendar'));
    localStorage.setItem('developmentRoadmapMode',mode);initializeYearOptions();render();
  }

  const previousShowView=window.showView;
  window.showView=function(view){
    if(view==='developmentRoadmap'){
      document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
      $('#developmentRoadmapView')?.classList.remove('hidden');
      document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
      if($('#pageTitle'))$('#pageTitle').textContent='Development Roadmap';
      if($('#pageSubtitle'))$('#pageSubtitle').textContent='Visualize existing Development Support work across fiscal or calendar periods.';
      $('#newProject')?.classList.add('hidden');
      if(window.refreshAllData)window.refreshAllData({reason:'view:developmentRoadmap'});else if(window.loadDevelopmentItems)window.loadDevelopmentItems();else render();
      return;
    }
    previousShowView(view);
  };

  document.addEventListener('DOMContentLoaded',()=>{
    const saved=localStorage.getItem('developmentRoadmapMode')||'fiscal';setMode(saved);
    $('#developmentRoadmapFiscalMode')?.addEventListener('click',()=>setMode('fiscal'));
    $('#developmentRoadmapCalendarMode')?.addEventListener('click',()=>setMode('calendar'));
    $('#developmentRoadmapYear')?.addEventListener('change',e=>{localStorage.setItem(`developmentRoadmapYear-${selectedMode()}`,e.target.value);render();});
    $('#developmentRoadmapYearSpan')?.addEventListener('change',render);
    ['devRoadmapDepartment','devRoadmapRelease','devRoadmapArea','devRoadmapCategory','devRoadmapStatus','devRoadmapPriority'].forEach(id=>$('#'+id)?.addEventListener('change',render));
    $('#developmentRoadmapShowUnscheduled')?.addEventListener('change',render);
    $('#clearDevelopmentRoadmapFilters')?.addEventListener('click',()=>{['devRoadmapDepartment','devRoadmapRelease','devRoadmapArea','devRoadmapCategory','devRoadmapStatus','devRoadmapPriority'].forEach(id=>{if($('#'+id))$('#'+id).value='all';});render();});
    const grid=$('#developmentRoadmapGrid'),top=$('#developmentRoadmapTopScroll');let syncing=false;
    grid?.addEventListener('scroll',()=>{if(syncing)return;syncing=true;if(top)top.scrollLeft=grid.scrollLeft;syncScroll();requestAnimationFrame(()=>syncing=false);});
    top?.addEventListener('scroll',()=>{if(syncing)return;syncing=true;if(grid)grid.scrollLeft=top.scrollLeft;syncScroll();requestAnimationFrame(()=>syncing=false);});
    $('#developmentRoadmapScrollLeft')?.addEventListener('click',()=>grid?.scrollBy({left:-500,behavior:'smooth'}));
    $('#developmentRoadmapScrollRight')?.addEventListener('click',()=>grid?.scrollBy({left:500,behavior:'smooth'}));
    window.addEventListener('resize',syncScroll);
    window.renderDevelopmentRoadmap=render;
    render();
  });
})();
