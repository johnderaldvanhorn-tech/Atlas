(() => {
  // v0.5.4 — Initiative Evaluation formulas aligned to the Project Base workbook.
  const previousOpenProject = openProject;
  const previousReadProject = readProject;
  const previousRender = render;

  const number = value => Number(value) || 0;
  const typeScoreFor = type => ({ A: 3, B: 2, C: 1 }[type] || 0);
  const selected = (score, values) => values[Math.max(1, Math.min(values.length, number(score))) - 1];

  function evaluationHours(type, lift) {
    const baseHours = 134;
    const multipliers = {
      A: [3, 2, 1.5, 1],
      B: [12, 9, 6, 3],
      C: [36, 24, 18, 12]
    };
    const row = multipliers[type];
    return row ? baseHours * selected(lift, row) : 0;
  }

  calculate = p => {
    const i = p.input || p;
    const projectType = i.projectType || 'A';
    const costAmount = Math.max(1, Math.min(3, number(i.costAmount) || 1));
    const impactLift = Math.max(1, Math.min(4, number(i.quadrantScore) || 1));
    const technicalRisk = Math.max(1, Math.min(3, number(i.technicalRisk) || 1));
    const productionRisk = Math.max(1, Math.min(3, number(i.productionRisk) || 1));
    const typeScore = typeScoreFor(projectType);

    // Excel: ((4-N)+O+(4-P)+(4-Q)+S)/16
    const alignmentScore = ((4 - costAmount) + impactLift + (4 - technicalRisk) + (4 - productionRisk) + typeScore) / 16;

    // Excel LET/CHOOSE model with 134 base hours.
    const hours = evaluationHours(projectType, impactLift);
    const months = Math.max(1, Math.ceil(hours / 156));
    const loadedRate = number(i.loadedRate) || 120;
    const cost = hours * loadedRate;
    const capex = number(i.capex);
    const totalSpend = cost + capex;

    // Excel Sales/Marketing formula.
    const unitRating = Math.max(1, Math.min(3, number(i.unitSalesScore) || 1));
    const recurRating = Math.max(1, Math.min(3, number(i.recurringRevenueScore) || 1));
    const speedRating = Math.max(1, Math.min(3, number(i.speedToMarketScore) || 1));
    const unitPrice = number(i.averageSellingPrice);
    const recurPerUnit = number(i.monthlyRecurringBase) || 68;
    const units = selected(unitRating, [30, 175, 400]);
    const pctConnected = selected(recurRating, [0.1, 0.4, 0.7]);
    const speedMultiplier = selected(speedRating, [0.6, 1, 1.3]);
    const adjustedUnits = units * speedMultiplier;
    const hardwareRevenue = adjustedUnits * unitPrice;
    const recurringRevenue = adjustedUnits * pctConnected * recurPerUnit;
    const year1Revenue = hardwareRevenue + recurringRevenue;

    // Excel: (Y1 Revenue - Cost) / Y1 Revenue
    const roi = year1Revenue ? (year1Revenue - cost) / year1Revenue : 0;
    // Excel: (Alignment Score + ROI) / 2
    const totalProjectScore = (alignmentScore + roi) / 2;
    const priority = totalProjectScore * 100;

    const quadrant = quadrantLabel(impactLift);
    const start = p.startDate || '';
    const finish = start ? addMonths(start, months - 1) : '';
    const connectedUnits = adjustedUnits * pctConnected;
    const mrr = connectedUnits * recurPerUnit;
    const arr = mrr * 12;
    const salesOpportunity = (unitRating * .4 + recurRating * .4 + speedRating * .2) / 3 * 100;
    const year2Revenue = number(i.year2Revenue);
    const year3Revenue = number(i.year3Revenue);
    const threeYear = year1Revenue + year2Revenue + year3Revenue - totalSpend;

    return {
      internal: cost,
      base: totalSpend,
      contingency: 0,
      cost,
      capex,
      totalSpend,
      capacity: 156,
      hours,
      months,
      typeScore,
      alignmentScore,
      year1Revenue,
      benefit1: year1Revenue,
      roi,
      totalProjectScore,
      priority,
      threeYear,
      quadrant,
      payback: year1Revenue > 0 ? totalSpend / (year1Revenue / 12) : null,
      start,
      finish,
      adjustedUnits,
      connectedUnits,
      mrr,
      arr,
      unitRevenue: hardwareRevenue,
      recurringRevenue,
      salesYear1: year1Revenue,
      salesYear2: year2Revenue,
      salesYear3: year3Revenue,
      salesOpportunity
    };
  };

  function syncCalculatedFields() {
    if (!document.querySelector('#projectOverlay') || document.querySelector('#projectOverlay').classList.contains('hidden')) return;
    const p = previousReadProject();
    const c = calculate(p);
    const set = (id, value) => { const el = document.querySelector('#' + id); if (el) el.value = value; };
    set('hours', c.hours);
    set('year1Revenue', c.year1Revenue.toFixed(2));
    const panel = document.querySelector('#projectEvaluationPreview');
    if (panel) panel.innerHTML = `
      <div><span>Type Score</span><b>${c.typeScore}</b></div>
      <div><span>Alignment Score</span><b>${(c.alignmentScore * 100).toFixed(0)}%</b></div>
      <div><span>Hours</span><b>${c.hours.toLocaleString()}</b></div>
      <div><span>Months</span><b>${c.months}</b></div>
      <div><span>Cost</span><b>${money(c.cost)}</b></div>
      <div><span>Total Spend</span><b>${money(c.totalSpend)}</b></div>
      <div><span>Y1 Revenue</span><b>${money(c.year1Revenue)}</b></div>
      <div><span>ROI</span><b>${(c.roi * 100).toFixed(0)}%</b></div>
      <div><span>Total Initiative Score</span><b>${(c.totalProjectScore * 100).toFixed(0)}%</b></div>`;
    estimate();
  }

  openProject = id => {
    previousOpenProject(id);
    const hours = document.querySelector('#hours');
    const y1 = document.querySelector('#year1Revenue');
    if (hours) { hours.readOnly = true; hours.title = 'Calculated from Project Type and Impact/Lift'; }
    if (y1) { y1.readOnly = true; y1.title = 'Calculated from Unit Sales, Recurring Revenue, Speed to Market, and Unit Price'; }
    syncCalculatedFields();
  };

  readProject = () => {
    const p = previousReadProject();
    const c = calculate(p);
    p.input.hours = c.hours;
    p.input.year1Revenue = c.year1Revenue;
    p.input.projectTypeScore = c.typeScore;
    p.input.alignmentScore = c.alignmentScore;
    p.input.calculatedMonths = c.months;
    p.input.calculatedCost = c.cost;
    p.input.calculatedTotalSpend = c.totalSpend;
    p.input.calculatedRoi = c.roi;
    p.input.totalProjectScore = c.totalProjectScore;
    return p;
  };

  const financialPane = document.querySelector('#tab-financials');
  if (financialPane && !document.querySelector('#projectEvaluationPreview')) {
    financialPane.insertAdjacentHTML('beforeend', `
      <h3 class="evaluationTitle">Calculated Initiative Evaluation</h3>
      <p class="hint">These values follow the Project Base formulas and update from the Design/Production and Sales/Marketing selections.</p>
      <div id="projectEvaluationPreview" class="salesPreview evaluationPreview"></div>`);
  }

  const fields = [
    '#projectType','#costAmount','#quadrantScore','#technicalRisk','#productionRisk',
    '#loadedRate','#capex','#unitSalesScore','#recurringRevenueScore','#speedToMarketScore',
    '#averageSellingPrice','#monthlyRecurringBase'
  ];
  fields.forEach(selector => document.addEventListener('input', event => {
    if (event.target.matches(selector)) syncCalculatedFields();
  }));
  document.addEventListener('change', event => {
    if (fields.some(selector => event.target.matches(selector))) syncCalculatedFields();
  });

  // Replace the estimate footer with the spreadsheet evaluation outputs.
  estimate = () => {
    const p = previousReadProject();
    const c = calculate(p);
    const estimateEl = document.querySelector('#estimate');
    if (estimateEl) estimateEl.innerHTML = `
      <div><span>Quadrant</span><b>${c.quadrant}</b></div>
      <div><span>Alignment</span><b>${(c.alignmentScore * 100).toFixed(0)}%</b></div>
      <div><span>Duration</span><b>${c.months} months</b></div>
      <div><span>Total spend</span><b>${money(c.totalSpend)}</b></div>
      <div><span>ROI</span><b>${(c.roi * 100).toFixed(0)}%</b></div>
      <div><span>Total score</span><b>${(c.totalProjectScore * 100).toFixed(0)}%</b></div>`;
    if (typeof renderSchedule === 'function') renderSchedule(c, p);
  };

  render = () => previousRender();
  render();
})();
