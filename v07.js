(() => {
  // v0.6.3 — Smart short-form CSV import/export plus full reporting export.
  const SHORT_COLUMNS = [
    ['Project Name', p => p.name],
    ['Description', p => p.description],
    ['Division', p => p.division],
    ['Category', p => p.category],
    ['Status', p => p.status],
    ['Champion', p => p.champion === 'Unassigned' ? '' : p.champion],
    ['Executive Sponsor', p => p.sponsor],
    ['Start Month', p => p.startDate],
    ['Project Type', p => p.input?.projectType],
    ['Cost Amount', p => p.input?.costAmount],
    ['Impact Lift', p => p.input?.quadrantScore],
    ['Technical Risk', p => p.input?.technicalRisk],
    ['Production Risk', p => p.input?.productionRisk],
    ['CapEx', p => p.input?.capex],
    ['Unit Sales Score', p => p.input?.unitSalesScore],
    ['Recurring Revenue Score', p => p.input?.recurringRevenueScore],
    ['Speed to Market Score', p => p.input?.speedToMarketScore],
    ['Price / Lift', p => p.input?.averageSellingPrice ?? 0]
  ];

  const FULL_COLUMNS = [
    ...SHORT_COLUMNS,
    ['Project ID', p => p.id],
    ['Loaded Rate', p => p.input?.loadedRate],
    ['External Cost', p => p.input?.externalCost],
    ['Calculated Type Score', p => calculate(p).typeScore],
    ['Calculated Alignment Score', p => calculate(p).alignmentScore],
    ['Calculated Hours', p => calculate(p).hours],
    ['Calculated Months', p => calculate(p).months],
    ['Calculated Cost', p => calculate(p).cost],
    ['Calculated Total Spend', p => calculate(p).totalSpend],
    ['Calculated Year 1 Revenue', p => calculate(p).year1Revenue],
    ['Calculated ROI', p => calculate(p).roi],
    ['Calculated Total Initiative Score', p => calculate(p).totalProjectScore],
    ['Approval Stage', p => p.governance?.approvalStage],
    ['Current Phase', p => p.execution?.currentPhase],
    ['Percent Complete', p => p.execution?.percentComplete],
    ['Health', p => p.execution?.health]
  ];

  const REQUIRED_HEADERS = SHORT_COLUMNS.map(([name]) => normalize(name));
  const CATEGORIES = ['NPD', 'CI', 'DPT', 'SUSTAINED'];
  const STATUSES = ['Proposed', 'Approved', 'Active', 'On Hold', 'Completed', 'Parking Lot'];

  const csvEscape = value => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
  }

  function normalize(name) {
    return String(name || '').replace(/^\ufeff/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  const numeric = value => {
    if (String(value ?? '').trim() === '') return null;
    const cleaned = String(value).replace(/[$,%\s,]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  function download(columns, filename) {
    const lines = [columns.map(([name]) => csvEscape(name)).join(',')];
    projects.forEach(project => lines.push(columns.map(([, getter]) => csvEscape(getter(project))).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function downloadImportCsv() {
    download(SHORT_COLUMNS, `project-import-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function downloadFullCsv() {
    download(FULL_COLUMNS, `project-portfolio-full-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function resourceMatch(name) {
    const value = String(name || '').trim();
    if (!value) return null;
    return resources.find(r => r.name.trim().toLowerCase() === value.toLowerCase()) || null;
  }

  function validateRow(row, rowNumber) {
    const errors = [], warnings = [];
    const text = key => String(row[key] ?? '').trim();
    const projectName = text('projectname');
    if (!projectName) errors.push('Project Name is required');

    const category = text('category').toUpperCase();
    if (!CATEGORIES.includes(category)) errors.push('Category must be NPD, CI, DPT, or SUSTAINED');

    const statusRaw = text('status');
    const status = STATUSES.find(s => s.toLowerCase() === statusRaw.toLowerCase());
    if (!status) errors.push(`Status must be one of: ${STATUSES.join(', ')}`);

    const startMonth = text('startmonth');
    if (startMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) errors.push('Start Month must use YYYY-MM');

    const projectType = text('projecttype').toUpperCase();
    if (!['A','B','C'].includes(projectType)) errors.push('Project Type must be A, B, or C');

    const ranges = [
      ['costamount', 'Cost Amount', 1, 3],
      ['impactlift', 'Impact Lift', 1, 4],
      ['technicalrisk', 'Technical Risk', 1, 3],
      ['productionrisk', 'Production Risk', 1, 3],
      ['unitsalesscore', 'Unit Sales Score', 1, 3],
      ['recurringrevenuescore', 'Recurring Revenue Score', 1, 3],
      ['speedtomarketscore', 'Speed to Market Score', 1, 3]
    ];
    const scores = {};
    ranges.forEach(([key, label, min, max]) => {
      const n = numeric(row[key]); scores[key] = n;
      if (!Number.isInteger(n) || n < min || n > max) errors.push(`${label} must be a whole number from ${min} to ${max}`);
    });

    const capex = numeric(row.capex);
    if (!Number.isFinite(capex) || capex < 0) errors.push('CapEx must be a non-negative number');

    const priceLift = numeric(row.pricelift);
    if (!Number.isFinite(priceLift) || priceLift < 0) errors.push('Price / Lift must be a non-negative number');

    const championText = text('champion');
    const sponsorText = text('executivesponsor');
    const championResource = resourceMatch(championText);
    const sponsorResource = resourceMatch(sponsorText);
    if (championText && !championResource) warnings.push(`Champion “${championText}” was not found in Resources and will be left Unassigned`);
    if (sponsorText && !sponsorResource) warnings.push(`Executive Sponsor “${sponsorText}” was not found in Resources and will be left blank`);

    return {
      rowNumber, errors, warnings,
      values: {
        projectName, description:text('description'), division:text('division') || 'IDS', category, status,
        champion:championResource?.name || 'Unassigned', sponsor:sponsorResource?.name || '', startMonth,
        projectType, costAmount:scores.costamount, quadrantScore:scores.impactlift,
        technicalRisk:scores.technicalrisk, productionRisk:scores.productionrisk, capex,
        unitSalesScore:scores.unitsalesscore, recurringRevenueScore:scores.recurringrevenuescore,
        speedToMarketScore:scores.speedtomarketscore, priceLift
      }
    };
  }

  function projectFromValues(values) {
    const existing = projects.find(p => p.name.trim().toLowerCase() === values.projectName.toLowerCase());
    const base = existing ? structuredClone(existing) : {
      id: uid(), name:'', description:'', division:'IDS', category:'CI', status:'Proposed', champion:'Unassigned', sponsor:'', startDate:'',
      input:{...starterDefaults}, assignments:[],
      governance:{approvalStage:'Draft',decisionOwner:'',decisionDate:'',targetDate:'',milestones:[],dependencies:[],risks:[]},
      execution:{currentPhase:'Discovery',phaseGate:'Not Submitted',percentComplete:0,health:'Green',actualInternal:0,actualExternal:0,actualCapex:0,forecastDate:'',statusSummary:'',actions:[],statusReports:[]}
    };
    base.input ||= {...starterDefaults};
    Object.assign(base, {
      name: values.projectName, description: values.description, division: values.division, category: values.category,
      status: values.status, champion: values.champion, sponsor: values.sponsor, startDate: values.startMonth
    });
    Object.assign(base.input, {
      projectType: values.projectType, costAmount: values.costAmount, quadrantScore: values.quadrantScore,
      technicalRisk: values.technicalRisk, productionRisk: values.productionRisk, capex: values.capex,
      unitSalesScore: values.unitSalesScore, recurringRevenueScore: values.recurringRevenueScore,
      speedToMarketScore: values.speedToMarketScore, averageSellingPrice: values.priceLift, priceLift: 0
    });
    return {project:base, updated:!!existing};
  }

  async function importCsv(file) {
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) throw new Error('The CSV does not contain any project rows.');
    const headers = parsed[0].map(normalize);
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length) {
      const names = SHORT_COLUMNS.filter(([name]) => missing.includes(normalize(name))).map(([name]) => name);
      throw new Error(`Missing required column${names.length === 1 ? '' : 's'}: ${names.join(', ')}`);
    }

    const results = [];
    for (let r = 1; r < parsed.length; r++) {
      const source = Object.fromEntries(headers.map((h,c) => [h, parsed[r][c] ?? '']));
      results.push(validateRow(source, r + 1));
    }

    const valid = results.filter(r => !r.errors.length);
    const invalid = results.filter(r => r.errors.length);
    let created = 0, updated = 0;
    const staged = valid.map(result => {
      const mapped = projectFromValues(result.values);
      mapped.updated ? updated++ : created++;
      return mapped.project;
    });

    if (!db) throw new Error('Supabase is not connected. Connect in Settings before importing projects.');
    for (const project of staged) await syncProject(project);
    await loadFromDb();
    render();

    showImportSummary({created, updated, skipped:invalid.length, rows:results});
  }

  function showImportSummary(summary) {
    let overlay = document.querySelector('#csvSummaryOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'csvSummaryOverlay'; overlay.className = 'overlay hidden';
      overlay.innerHTML = `<div class="modal csvSummaryModal"><div class="modalHead"><div><h2>CSV Import Summary</h2><p>Projects were validated and recalculated using the current formulas.</p></div><button class="icon" id="closeCsvSummary">×</button></div><div id="csvSummaryBody"></div><div class="modalActions"><button id="closeCsvSummaryBottom">Close</button></div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#closeCsvSummary').onclick = overlay.querySelector('#closeCsvSummaryBottom').onclick = () => overlay.classList.add('hidden');
      overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
    }
    const warnings = summary.rows.flatMap(r => r.warnings.map(w => `Row ${r.rowNumber}: ${w}`));
    const errors = summary.rows.flatMap(r => r.errors.map(e => `Row ${r.rowNumber}: ${e}`));
    overlay.querySelector('#csvSummaryBody').innerHTML = `
      <div class="summaryCards">
        <div class="summaryCard"><span>Created</span><strong>${summary.created}</strong></div>
        <div class="summaryCard"><span>Updated</span><strong>${summary.updated}</strong></div>
        <div class="summaryCard"><span>Skipped</span><strong>${summary.skipped}</strong></div>
        <div class="summaryCard"><span>Warnings</span><strong>${warnings.length}</strong></div>
      </div>
      ${errors.length ? `<section class="importIssues error"><h3>Skipped rows</h3><ul>${errors.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></section>` : ''}
      ${warnings.length ? `<section class="importIssues warning"><h3>Warnings</h3><ul>${warnings.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></section>` : ''}
      ${!errors.length && !warnings.length ? '<div class="importClean">All rows passed validation.</div>' : ''}
    `;
    overlay.classList.remove('hidden');
  }

  function showImportMessage(text, error) {
    let el = document.querySelector('#csvImportMessage');
    if (!el) { el = document.createElement('div'); el.id = 'csvImportMessage'; document.body.appendChild(el); }
    el.textContent = text; el.className = `csvToast show ${error ? 'error' : 'success'}`;
    clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove('show'), 7000);
  }

  const toolbar = document.querySelector('#projectsView .panelHead.toolbar');
  if (toolbar && !document.querySelector('#downloadImportCsv')) {
    const search = document.querySelector('#projectSearch');
    const controls = document.createElement('div'); controls.className = 'portfolioControls';
    controls.innerHTML = `
      <button id="downloadImportCsv" class="secondary" type="button">↓ Download Import CSV</button>
      <button id="downloadFullCsv" class="secondary" type="button">↓ Full Export</button>
      <button id="uploadProjectsCsv" class="secondary" type="button">↑ Upload CSV</button>
      <input id="projectCsvFile" type="file" accept=".csv,text/csv" hidden>
    `;
    toolbar.insertBefore(controls, search); controls.appendChild(search);
    document.querySelector('#downloadImportCsv').onclick = downloadImportCsv;
    document.querySelector('#downloadFullCsv').onclick = downloadFullCsv;
    document.querySelector('#uploadProjectsCsv').onclick = () => document.querySelector('#projectCsvFile').click();
    document.querySelector('#projectCsvFile').onchange = async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { await importCsv(file); }
      catch (error) { showImportMessage(error.message || 'CSV import failed.', true); }
      finally { event.target.value = ''; }
    };
  }

  // The visible revision is managed centrally by version.js.
})();
