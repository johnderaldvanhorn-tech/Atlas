(() => {
  // v0.6.21 — Executive project portfolio filters and fiscal-quarter scheduling.
  const projectTable = document.querySelector('#projectsView table');
  if (projectTable) {
    const header = projectTable.querySelector('thead tr');
    if (header) {
      header.innerHTML = `
        <th class="projectCol">Project</th>
        <th>Division</th>
        <th>Champion</th>
        <th>Quadrant</th>
        <th class="numeric">Alignment Score</th>
        <th class="numeric">Duration</th>
        <th>Fiscal Quarter</th>
        <th class="numeric">Total Spend</th>
        <th class="numeric">Y1 Revenue</th>
        <th class="numeric">ROI</th>
        <th class="numeric">Total Initiative Score</th>`;
    }
    projectTable.classList.add('executivePortfolioTable');
  }

  const pct = value => `${(Number(value || 0) * 100).toFixed(0)}%`;
  const scoreClass = value => {
    const score = Number(value || 0) * 100;
    return score >= 80 ? 'metricGood' : score >= 60 ? 'metricWarn' : 'metricBad';
  };

  function fiscalPeriodFromMonthIndex(index) {
    const calendarYear = Math.floor(index / 12);
    const month = index % 12; // Jan = 0
    const fiscalYear = month >= 9 ? calendarYear + 1 : calendarYear;
    const quarter = month >= 9 ? 1 : month <= 2 ? 2 : month <= 5 ? 3 : 4;
    return { fiscalYear, quarter, label: `FY${fiscalYear} Q${quarter}` };
  }

  function projectFiscalRange(project, months) {
    const value = String(project.startDate || '');
    if (!/^\d{4}-\d{2}$/.test(value)) return { start: '', end: '', label: 'Unscheduled' };
    const [year, month] = value.split('-').map(Number);
    const startIndex = year * 12 + month - 1;
    const endIndex = startIndex + Math.max(1, Number(months) || 1) - 1;
    const start = fiscalPeriodFromMonthIndex(startIndex);
    const end = fiscalPeriodFromMonthIndex(endIndex);
    return {
      start: start.label,
      end: end.label,
      label: start.label === end.label ? start.label : `${start.label} → ${end.label}`
    };
  }

  function executiveProjectRow(p) {
    const c = calculate(p);
    return `<tr data-id="${p.id}" class="clickable">
      <td class="projectCell"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.status)} · ${escapeHtml(typeof categoryLabel==='function'?categoryLabel(p.category):p.category||'')}</small></td>
      <td>${escapeHtml(p.division || '')}</td>
      <td>${escapeHtml(p.champion || 'Unassigned')}</td>
      <td><span class="pill ${c.quadrant.replaceAll(' ','').replace('-','').toLowerCase()}">${escapeHtml(c.quadrant)}</span></td>
      <td class="numeric"><span class="metricBadge ${scoreClass(c.alignmentScore)}">${pct(c.alignmentScore)}</span></td>
      <td class="numeric">${Number(c.months || 0).toFixed(0)} mo.</td>
      <td><span class="fiscalQuarterBadge">${escapeHtml(projectFiscalRange(p, c.months).label)}</span></td>
      <td class="numeric">${money(c.totalSpend)}</td>
      <td class="numeric">${money(c.year1Revenue)}</td>
      <td class="numeric"><span class="metricBadge ${scoreClass(c.roi)}">${pct(c.roi)}</span></td>
      <td class="numeric"><span class="metricBadge ${scoreClass(c.totalProjectScore)}">${pct(c.totalProjectScore)}</span></td>
    </tr>`;
  }

  function refreshPortfolioFilterOptions() {
    const configs = [
      ['portfolioDivisionFilter', 'Divisions', projects.map(p => p.division)],
      ['portfolioChampionFilter', 'Champions', projects.map(p => p.champion || 'Unassigned')],
      ['portfolioQuadrantFilter', 'Quadrants', projects.map(p => calculate(p).quadrant)],
      ['portfolioCategoryFilter', 'Categories', projects.map(p => p.category)],
      ['portfolioStatusFilter', 'Statuses', projects.map(p => p.status)]
    ];

    configs.forEach(([id, label, values]) => {
      const select = document.querySelector(`#${id}`);
      if (!select) return;
      const previous = select.value || 'all';
      const options = uniqueSorted(values);
      select.innerHTML = `<option value="all">All ${escapeHtml(String(label).toLowerCase())}</option>` +
        options.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(id==='portfolioCategoryFilter'&&typeof categoryLabel==='function'?categoryLabel(value):value)}</option>`).join('');
      select.value = options.includes(previous) ? previous : 'all';
    });

    const fiscal = document.querySelector('#fiscalQuarterFilter');
    if (fiscal) {
      const previous = fiscal.value || 'all';
      const years = new Set();
      projects.forEach(project => {
        const range = projectFiscalRange(project, calculate(project).months);
        [range.start, range.end].forEach(label => {
          const match = /^FY(\d{4}) Q[1-4]$/.exec(label);
          if (match) years.add(Number(match[1]));
        });
      });
      const values = [...years].sort((a,b) => a-b)
        .flatMap(year => [1,2,3,4].map(quarter => `FY${year} Q${quarter}`));
      fiscal.innerHTML = '<option value="all">All fiscal quarters</option>' +
        values.map(value => `<option value="${value}">${value}</option>`).join('');
      fiscal.value = values.includes(previous) ? previous : 'all';
    }
  }

  renderProjects = function() {
    refreshPortfolioFilterOptions();
    const q = ($('#projectSearch')?.value || '').toLowerCase();
    const fiscalFilter = $('#fiscalQuarterFilter')?.value || 'all';
    const divisionFilter = $('#portfolioDivisionFilter')?.value || 'all';
    const championFilter = $('#portfolioChampionFilter')?.value || 'all';
    const quadrantFilter = $('#portfolioQuadrantFilter')?.value || 'all';
    const categoryFilter = $('#portfolioCategoryFilter')?.value || 'all';
    const statusFilter = $('#portfolioStatusFilter')?.value || 'all';
    const list = projects.filter(p => {
      const c = calculate(p);
      const range = projectFiscalRange(p, c.months);
      const matchesText = [p.name, p.division, p.champion, p.status, p.category, c.quadrant, range.label]
        .join(' ').toLowerCase().includes(q);
      const matchesFiscal = fiscalFilter === 'all' || range.start === fiscalFilter || range.end === fiscalFilter || range.label.includes(fiscalFilter);
      const matchesDivision = divisionFilter === 'all' || String(p.division || '') === divisionFilter;
      const matchesChampion = championFilter === 'all' || String(p.champion || 'Unassigned') === championFilter;
      const matchesQuadrant = quadrantFilter === 'all' || String(c.quadrant || '') === quadrantFilter;
      const matchesCategory = categoryFilter === 'all' || String(p.category || '') === categoryFilter;
      const matchesStatus = statusFilter === 'all' || String(p.status || '') === statusFilter;
      return matchesText && matchesFiscal && matchesDivision && matchesChampion && matchesQuadrant && matchesCategory && matchesStatus;
    });
    $('#projectRows').innerHTML = list.map(executiveProjectRow).join('') ||
      '<tr><td colspan="11" class="empty">No projects found.</td></tr>';

    // Preserve the compact dashboard table and its existing column layout.
    const dashboardRows = $('#dashboardRows');
    if (dashboardRows) {
      dashboardRows.innerHTML = [...projects]
        .sort((a,b) => calculate(b).priority - calculate(a).priority)
        .slice(0,5)
        .map(p => projectRow(p, true)).join('');
    }

    $$('tbody tr[data-id]').forEach(r => r.onclick = () => openProject(r.dataset.id));
  };

  const toolbar = document.querySelector('#projectsView .panelHead.toolbar');
  if (toolbar && !document.querySelector('#fiscalQuarterFilter')) {
    const search = document.querySelector('#projectSearch');
    const filter = document.createElement('select');
    filter.id = 'fiscalQuarterFilter';
    filter.setAttribute('aria-label', 'Filter by fiscal quarter');
    const years = new Set();
    projects.forEach(p => {
      const range = projectFiscalRange(p, calculate(p).months);
      [range.start, range.end].forEach(label => {
        const match = /^FY(\d{4}) Q[1-4]$/.exec(label);
        if (match) years.add(Number(match[1]));
      });
    });
    const sortedYears = [...years].sort((a,b) => a-b);
    filter.innerHTML = '<option value="all">All fiscal quarters</option>' + sortedYears.flatMap(year => [1,2,3,4].map(q => `<option value="FY${year} Q${q}">FY${year} Q${q}</option>`)).join('');
    filter.onchange = renderProjects;
    const controls = toolbar.querySelector('.portfolioControls');
    if (search && controls && search.parentNode === controls) controls.insertBefore(filter, search);
    else if (search && search.parentNode === toolbar) toolbar.insertBefore(filter, search);
    else (controls || toolbar).appendChild(filter);
  }


  function uniqueSorted(values) {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function makePortfolioFilter(id, label, values) {
    const select = document.createElement('select');
    select.id = id;
    select.className = 'portfolioHeaderFilter';
    select.setAttribute('aria-label', `Filter by ${label.toLowerCase()}`);
    select.innerHTML = `<option value="all">All ${escapeHtml(label.toLowerCase())}</option>` +
      uniqueSorted(values).map(value => `<option value="${escapeHtml(value)}">${escapeHtml(id==='portfolioCategoryFilter'&&typeof categoryLabel==='function'?categoryLabel(value):value)}</option>`).join('');
    select.onchange = renderProjects;
    return select;
  }

  const projectPanel = document.querySelector('#projectsView .panel');
  const projectToolbar = document.querySelector('#projectsView .panelHead.toolbar');
  if (projectPanel && projectToolbar && !document.querySelector('#portfolioFilterBar')) {
    const filterBar = document.createElement('div');
    filterBar.id = 'portfolioFilterBar';
    filterBar.className = 'portfolioFilterBar';
    filterBar.append(
      makePortfolioFilter('portfolioDivisionFilter', 'Divisions', projects.map(p => p.division)),
      makePortfolioFilter('portfolioChampionFilter', 'Champions', projects.map(p => p.champion || 'Unassigned')),
      makePortfolioFilter('portfolioQuadrantFilter', 'Quadrants', projects.map(p => calculate(p).quadrant)),
      makePortfolioFilter('portfolioCategoryFilter', 'Categories', projects.map(p => p.category)),
      makePortfolioFilter('portfolioStatusFilter', 'Statuses', projects.map(p => p.status))
    );
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.id = 'clearPortfolioFilters';
    clear.className = 'secondary clearPortfolioFilters';
    clear.textContent = 'Clear Filters';
    clear.onclick = () => {
      filterBar.querySelectorAll('select').forEach(select => { select.value = 'all'; });
      const fiscal = document.querySelector('#fiscalQuarterFilter');
      const search = document.querySelector('#projectSearch');
      if (fiscal) fiscal.value = 'all';
      if (search) search.value = '';
      renderProjects();
    };
    filterBar.appendChild(clear);
    projectToolbar.insertAdjacentElement('afterend', filterBar);
  }

  renderProjects();
})();
