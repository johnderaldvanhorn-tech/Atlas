(() => {
  // v0.5 Sales/Marketing value levers
  const oldCalculate = calculate, oldPersist = persist, oldRender = render, oldOpenProject = openProject, oldReadProject = readProject, oldShowView = showView;
  const salesDefaults = {
    unitSalesScore: 1, projectedUnits: 30, averageSellingPrice: 0,
    recurringRevenueScore: 1, connectedRate: .10, monthlyRecurringBase: 68,
    speedToMarketScore: 3, monthsToMarket: 2, priceLift: 0,
    improvesConversion: false, unlocksKits: false, extendsProductLife: false,
    increasesConnectRate: false, unlocksRecurring: false, stabilizesBilling: false,
    deployableCurrentPlatform: false, salesCanActEarly: false,
    salesEvidence: '', recurringEvidence: '', speedEvidence: '',
    useCalculatedSales: false
  };
  const ensureSales = p => {
    p.input ||= {};
    // Price / Lift is stored canonically as averageSellingPrice. Migrate older
    // records that stored the visible value in priceLift, then clear the legacy
    // flat-lift field so revenue is not counted twice.
    if ((p.input.averageSellingPrice === undefined || Number(p.input.averageSellingPrice) === 0) && Number(p.input.priceLift) > 0) {
      p.input.averageSellingPrice = Number(p.input.priceLift);
    }
    p.input.priceLift = 0;
    Object.entries(salesDefaults).forEach(([k,v]) => { if (p.input[k] === undefined) p.input[k] = v; });
    return p;
  };
  projects.forEach(ensureSales); oldPersist();
  persist = () => { projects.forEach(ensureSales); oldPersist(); };

  const baseCalculate = oldCalculate;
  calculate = p => {
    ensureSales(p);
    const i=p.input, connectedUnits=(Number(i.projectedUnits)||0)*(Number(i.connectedRate)||0);
    const mrr=connectedUnits*(Number(i.monthlyRecurringBase)||68), arr=mrr*12;
    const unitRevenue=(Number(i.projectedUnits)||0)*(Number(i.averageSellingPrice)||0);
    const salesYear1=unitRevenue+arr;
    const salesYear2=arr;
    const salesYear3=arr;
    let target=p;
    if(i.useCalculatedSales){ target={...p,input:{...i,year1Revenue:salesYear1,year2Revenue:salesYear2,year3Revenue:salesYear3}}; }
    const c=baseCalculate(target);
    const salesOpportunity=((Number(i.unitSalesScore)||1)*.4+(Number(i.recurringRevenueScore)||1)*.4+(Number(i.speedToMarketScore)||1)*.2)/3*100;
    return {...c,connectedUnits,mrr,arr,unitRevenue,salesYear1,salesYear2,salesYear3,salesOpportunity};
  };


  const overviewTab=document.querySelector('[data-tab="overview"]');
  overviewTab.insertAdjacentHTML('afterend','<button data-tab="salesMarketing">Sales / Marketing</button>');
  document.querySelector('#tab-financials').insertAdjacentHTML('afterend', `
    <div id="tab-salesMarketing" class="tabPane hidden">
      <div class="compactSalesPanel">
        <div class="compactSalesHeader">
          <div><h3>Sales / Marketing Inputs</h3><p>Select the four Project Base values. Revenue updates automatically.</p></div>
        </div>
        <div class="grid compactSalesGrid">
          <label>Unit Sales
            <select id="unitSalesScore">
              <option value="3">3 — High: 300–500 units</option>
              <option value="2">2 — Mid: 50–299 units</option>
              <option value="1">1 — Low: 10–49 units</option>
            </select>
          </label>
          <label>Recurring Revenue
            <select id="recurringRevenueScore">
              <option value="3">3 — High: 60–80% connected</option>
              <option value="2">2 — Mid: 20–60% connected</option>
              <option value="1">1 — Low: 0–20% connected</option>
            </select>
          </label>
          <label>Speed to Market
            <select id="speedToMarketScore">
              <option value="3">3 — Quick: 1–3 months</option>
              <option value="2">2 — Mid: 3 months–1 year</option>
              <option value="1">1 — Slow: 1–2 years</option>
            </select>
          </label>
          <label>Price / Lift
            <input id="averageSellingPrice" type="number" min="0" step="0.01" placeholder="0">
          </label>
        </div>
        <div class="salesHiddenFields" aria-hidden="true">
          <input id="projectedUnits" type="number" tabindex="-1">
          <input id="connectedRate" type="number" tabindex="-1">
          <input id="monthlyRecurringBase" type="number" value="68" tabindex="-1">
          <input id="monthsToMarket" type="number" tabindex="-1">
          <input id="priceLift" type="number" value="0" tabindex="-1">
          <input id="improvesConversion" type="checkbox" tabindex="-1">
          <input id="unlocksKits" type="checkbox" tabindex="-1">
          <input id="extendsProductLife" type="checkbox" tabindex="-1">
          <input id="increasesConnectRate" type="checkbox" tabindex="-1">
          <input id="unlocksRecurring" type="checkbox" tabindex="-1">
          <input id="stabilizesBilling" type="checkbox" tabindex="-1">
          <input id="deployableCurrentPlatform" type="checkbox" tabindex="-1">
          <input id="salesCanActEarly" type="checkbox" tabindex="-1">
          <input id="useCalculatedSales" type="checkbox" checked tabindex="-1">
          <textarea id="salesEvidence" tabindex="-1"></textarea>
          <textarea id="recurringEvidence" tabindex="-1"></textarea>
          <textarea id="speedEvidence" tabindex="-1"></textarea>
        </div>
        <h3 class="evaluationTitle">Calculated Sales Evaluation</h3>
        <p class="hint">Read-only values follow the Project Base formula using $68 per connected unit.</p>
        <div id="salesPreview" class="salesPreview compactSalesPreview"></div>
      </div>
    </div>`);

  const val=id=>Number(document.querySelector('#'+id)?.value)||0;
  const checked=id=>!!document.querySelector('#'+id)?.checked;
  function setSalesEditor(i){
    ensureSales({input:i});
    ['unitSalesScore','projectedUnits','averageSellingPrice','recurringRevenueScore','monthlyRecurringBase','speedToMarketScore','monthsToMarket','priceLift'].forEach(id=>$('#'+id).value=i[id]);
    $('#connectedRate').value=(i.connectedRate||0)*100;
    ['improvesConversion','unlocksKits','extendsProductLife','increasesConnectRate','unlocksRecurring','stabilizesBilling','deployableCurrentPlatform','salesCanActEarly','useCalculatedSales'].forEach(id=>$('#'+id).checked=!!i[id]);
    ['salesEvidence','recurringEvidence','speedEvidence'].forEach(id=>$('#'+id).value=i[id]||'');
    renderSalesPreview();
  }
  function readSales(){ return {
    unitSalesScore:val('unitSalesScore'),projectedUnits:val('projectedUnits'),averageSellingPrice:val('averageSellingPrice'),
    recurringRevenueScore:val('recurringRevenueScore'),connectedRate:val('connectedRate')/100,monthlyRecurringBase:val('monthlyRecurringBase'),
    speedToMarketScore:val('speedToMarketScore'),monthsToMarket:val('monthsToMarket'),priceLift:0,
    improvesConversion:checked('improvesConversion'),unlocksKits:checked('unlocksKits'),extendsProductLife:checked('extendsProductLife'),
    increasesConnectRate:checked('increasesConnectRate'),unlocksRecurring:checked('unlocksRecurring'),stabilizesBilling:checked('stabilizesBilling'),
    deployableCurrentPlatform:checked('deployableCurrentPlatform'),salesCanActEarly:checked('salesCanActEarly'),useCalculatedSales:checked('useCalculatedSales'),
    salesEvidence:$('#salesEvidence').value.trim(),recurringEvidence:$('#recurringEvidence').value.trim(),speedEvidence:$('#speedEvidence').value.trim()
  }; }
  function renderSalesPreview(){
    if(!$('#salesPreview')) return;
    const i=readSales();
    const unitRating=Math.max(1,Math.min(3,Number(i.unitSalesScore)||1));
    const recurRating=Math.max(1,Math.min(3,Number(i.recurringRevenueScore)||1));
    const speedRating=Math.max(1,Math.min(3,Number(i.speedToMarketScore)||1));
    const choices=(score,values)=>values[score-1];
    const units=choices(unitRating,[30,175,400]);
    const pctConnected=choices(recurRating,[.10,.40,.70]);
    const speedMultiplier=choices(speedRating,[.60,1,1.30]);
    const adjustedUnits=units*speedMultiplier;
    const unitPrice=Number(i.averageSellingPrice)||0;
    const recurPerUnit=68;
    const hardwareRevenue=adjustedUnits*unitPrice;
    const recurringRevenue=adjustedUnits*pctConnected*recurPerUnit;
    const year1Revenue=hardwareRevenue+recurringRevenue;
    $('#projectedUnits').value=units;
    $('#connectedRate').value=pctConnected*100;
    $('#monthlyRecurringBase').value=recurPerUnit;
    $('#monthsToMarket').value=choices(speedRating,[18,8,2]);
    $('#salesPreview').innerHTML=`
      <div><span>Base units</span><b>${units.toLocaleString()}</b></div>
      <div><span>Connected rate</span><b>${(pctConnected*100).toFixed(0)}%</b></div>
      <div><span>Speed multiplier</span><b>${speedMultiplier.toFixed(1)}×</b></div>
      <div><span>Adjusted units</span><b>${adjustedUnits.toFixed(0)}</b></div>
      <div><span>Hardware revenue</span><b>${money(hardwareRevenue)}</b></div>
      <div><span>Recurring revenue</span><b>${money(recurringRevenue)}</b></div>
      <div class="salesResultPrimary"><span>Calculated Y1 Revenue</span><b>${money(year1Revenue)}</b></div>`;
  }
  openProject=id=>{ oldOpenProject(id); const p=id?projects.find(x=>x.id===id):{input:{...salesDefaults,useCalculatedSales:true}}; setSalesEditor(ensureSales(p).input); };
  readProject=()=>{ const p=oldReadProject(); Object.assign(p.input,readSales()); return p; };

  function renderSales(){
    if(!$('#salesKpis')) return;
    const rows=projects.map(p=>({p,c:calculate(p)}));
    const units=rows.reduce((s,x)=>s+x.c.connectedUnits/(x.p.input.connectedRate||1)*(x.p.input.connectedRate||1),0); // preserves decimal expected units
    const connected=rows.reduce((s,x)=>s+x.c.connectedUnits,0),mrr=rows.reduce((s,x)=>s+x.c.mrr,0),arr=rows.reduce((s,x)=>s+x.c.arr,0);
    $('#salesKpis').innerHTML=[['Projected Units',Math.round(projects.reduce((s,p)=>s+(Number(p.input.projectedUnits)||0),0)).toLocaleString()],['Connected Units',Math.round(connected).toLocaleString()],['Portfolio MRR',money(mrr)],['Portfolio ARR',money(arr)],['Average Opportunity',(rows.reduce((s,x)=>s+x.c.salesOpportunity,0)/Math.max(1,rows.length)).toFixed(0)+'/100']].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    $('#salesRows').innerHTML=[...rows].sort((a,b)=>b.c.salesOpportunity-a.c.salesOpportunity).map(({p,c})=>`<tr data-sales-id="${p.id}"><td><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.division)}</small></td><td>${p.input.unitSalesScore}</td><td>${Math.round(p.input.projectedUnits||0).toLocaleString()}</td><td>${p.input.recurringRevenueScore}</td><td>${((p.input.connectedRate||0)*100).toFixed(0)}%</td><td>${c.connectedUnits.toFixed(0)}</td><td>${money(c.mrr)}</td><td>${money(c.arr)}</td><td>${p.input.speedToMarketScore} · ${p.input.monthsToMarket} mo.</td><td><b>${c.salesOpportunity.toFixed(0)}</b></td></tr>`).join('');
    document.querySelectorAll('[data-sales-id]').forEach(r=>r.onclick=()=>openProject(r.dataset.salesId));
    $('#salesRanking').innerHTML=[...rows].sort((a,b)=>b.c.salesOpportunity-a.c.salesOpportunity).slice(0,6).map(({p,c})=>`<div class="salesRank"><div><b>${escapeHtml(p.name)}</b><small>Unit ${p.input.unitSalesScore} · Recurring ${p.input.recurringRevenueScore} · Speed ${p.input.speedToMarketScore}</small></div><strong>${c.salesOpportunity.toFixed(0)}</strong></div>`).join('')||'<p class="empty">No projects.</p>';
    const max=Math.max(1,...rows.map(x=>x.c.arr));
    $('#recurringOutlook').innerHTML=[...rows].sort((a,b)=>b.c.arr-a.c.arr).slice(0,6).map(({p,c})=>`<div class="barRow"><span>${escapeHtml(p.name)}</span><div class="barTrack"><div class="barFill" style="width:${c.arr/max*100}%"></div></div><b>${money(c.arr)}</b></div>`).join('');
  }
  render=()=>{ oldRender(); renderSales(); };
  showView=name=>{
    if(name==='sales'){
      document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
      document.querySelector('#salesView').classList.remove('hidden');
      document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view==='sales'));
      document.querySelector('#pageTitle').textContent='Sales / Marketing Portfolio';
      document.querySelector('#pageSubtitle').textContent='Evaluate unit-sales potential, recurring revenue, and speed to market.';
      document.querySelector('#newProject').classList.remove('hidden');
      renderSales();
      return;
    }
    oldShowView(name);
  };
  document.querySelector('[data-view="sales"]')?.addEventListener('click',()=>showView('sales'));
  document.querySelector('[data-tab="salesMarketing"]').onclick=()=>showTab('salesMarketing');
  document.querySelectorAll('#tab-salesMarketing input,#tab-salesMarketing select,#tab-salesMarketing textarea').forEach(el=>el.addEventListener('input',renderSalesPreview));
  render();
})();
