(() => {
  // v0.6.1 — Category-driven one-line roadmap. Only NPD receives testing.
  const CATEGORY_OPTIONS = ['NPD','CI','DPT','SUSTAINED'];
  const CATEGORY_LABELS = {
    NPD: 'NPD — New Product Development',
    CI: 'CI — Continuous Improvement',
    DPT: 'Skunkworks — Experimental / rapid development',
    SUSTAINED: 'Sustained — Bugs and Defects'
  };

  function normalizeCategory(project) {
    const current = String(project.category || '').trim();
    if (CATEGORY_OPTIONS.includes(current)) return current;
    const legacyClass = String(project.productClassification || '').toLowerCase();
    if (legacyClass === 'new product') return 'NPD';
    if (current.toLowerCase().includes('department') || current.toLowerCase().includes('skunk')) return 'DPT';
    if (current.toLowerCase().includes('sustain') || current.toLowerCase().includes('bug') || current.toLowerCase().includes('defect')) return 'SUSTAINED';
    return 'CI';
  }

  projects.forEach(project => {
    project.category = normalizeCategory(project);
    delete project.productClassification;
  });
  if (typeof persist === 'function') persist();

  const previousOpenProject = openProject;
  const previousReadProject = readProject;

  openProject = id => {
    previousOpenProject(id);
    const project = id ? projects.find(item => item.id === id) : null;
    const field = document.querySelector('#category');
    if (field) field.value = project ? normalizeCategory(project) : 'CI';
  };

  readProject = () => {
    const project = previousReadProject();
    const field = document.querySelector('#category');
    project.category = CATEGORY_OPTIONS.includes(field?.value) ? field.value : 'CI';
    delete project.productClassification;
    return project;
  };

  function monthIndex(value) {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
    const [year, month] = value.split('-').map(Number);
    return year * 12 + month - 1;
  }

  function phasePlan(project) {
    const calculated = calculate(project);
    const totalMonths = Math.max(1, calculated.months || 1);
    const isNpd = normalizeCategory(project) === 'NPD';
    // Testing occupies the end of the same one-line schedule.
    // Standard NPD testing is three months, limited to half of short schedules.
    const testingMonths = isNpd ? Math.min(3, Math.max(1, Math.ceil(totalMonths / 2))) : 0;
    const developmentMonths = totalMonths - testingMonths;
    return {calculated, totalMonths, testingMonths, developmentMonths, isNpd};
  }

  renderRoadmap = () => {
    const selector = document.querySelector('#roadmapYear');
    const grid = document.querySelector('#roadmapGrid');
    if (!selector || !grid) return;

    const projectYears = projects.map(project => (project.startDate || '').slice(0,4)).filter(Boolean);
    const currentYear = String(new Date().getFullYear());
    const years = [...new Set([...projectYears, currentYear])].sort();
    const existing = selector.value;
    selector.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
    selector.value = years.includes(existing) ? existing : (years[0] || currentYear);

    const year = Number(selector.value);
    const firstMonth = year * 12;
    const lastMonth = firstMonth + 11;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const visible = projects
      .filter(project => {
        const start = monthIndex(project.startDate);
        if (start === null) return false;
        const {totalMonths} = phasePlan(project);
        const finish = start + totalMonths - 1;
        return start <= lastMonth && finish >= firstMonth;
      })
      .sort((a,b) => (a.startDate || '').localeCompare(b.startDate || ''));

    let html = `<div class="roadmapHeader executiveRoadmapHeader"><div>Project</div>${monthNames.map(month => `<div>${month}</div>`).join('')}</div>`;

    visible.forEach(project => {
      const start = monthIndex(project.startDate);
      const plan = phasePlan(project);
      const finish = start + plan.totalMonths - 1;
      const testingStart = finish - plan.testingMonths + 1;
      const blocked = typeof dependencyBlocked === 'function' && dependencyBlocked(project);
      const startLabel = project.startDate || '';
      const finishDate = `${Math.floor(finish / 12)}-${String((finish % 12) + 1).padStart(2,'0')}`;
      const category = normalizeCategory(project);
      const tooltip = [
        project.name,
        `Champion: ${project.champion || 'Unassigned'}`,
        `Category: ${CATEGORY_LABELS[category]}`,
        `Start: ${startLabel}`,
        `Finish: ${finishDate}`,
        `Duration: ${plan.totalMonths} months`,
        `Testing: ${plan.testingMonths} months`,
        `ROI: ${(plan.calculated.roi * 100).toFixed(0)}%`,
        `Score: ${(plan.calculated.totalProjectScore * 100).toFixed(0)}%`
      ].join('\n');

      let cells = '';
      for (let month = firstMonth; month <= lastMonth; month++) {
        const active = month >= start && month <= finish;
        const testing = active && plan.isNpd && month >= testingStart;
        const phase = testing ? 'roadmapTesting' : active ? 'roadmapDevelopment' : '';
        const startMarker = month === start ? '<span class="roadmapStart">●</span>' : '';
        const finishMarker = month === finish ? '<span class="roadmapFinish">★</span>' : '';
        cells += `<div class="roadmapCell executiveRoadmapCell ${phase}" ${active ? `title="${escapeHtml(tooltip)}"` : ''}>${startMarker}${finishMarker}</div>`;
      }

      html += `<div class="roadmapRow executiveRoadmapRow"><div class="roadmapName"><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.division)} · ${escapeHtml(category)}</small>${blocked ? '<span class="blockedNote">Waiting on dependency</span>' : ''}</div>${cells}</div>`;
    });

    grid.innerHTML = visible.length ? html : `${html}<div class="empty roadmapEmpty">No scheduled projects overlap ${year}.</div>`;
    selector.onchange = renderRoadmap;
  };

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = () => {
      previousRender();
      renderRoadmap();
    };
  }

  const categoryField = document.querySelector('#category');
  if (categoryField) categoryField.addEventListener('change', () => {
    if (typeof estimate === 'function') estimate();
  });

  if (typeof render === 'function') render();
  else renderRoadmap();
})();
