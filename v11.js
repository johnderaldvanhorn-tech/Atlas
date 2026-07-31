(() => {
  // v7.0.8 — Four portfolio categories with roadmap editing support.
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const CATEGORY_LABELS = {
    NPD: 'NPD - New Product Development',
    CI: 'CI - Continuous Improvement',
    DPT: 'Skunkworks - Experimental / rapid development',
    SUSTAINED: 'Sustained - Bugs and Defects'
  };

  const safeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[char]));

  function normalizeCategory(project) {
    const value = String(project.category || '').trim().toUpperCase();
    return ['NPD','CI','DPT','SUSTAINED'].includes(value) ? value : 'CI';
  }

  function monthIndex(value) {
    if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month] = String(value).split('-').map(Number);
    return year * 12 + month - 1;
  }

  function planFor(project) {
    const result = calculate(project);
    const calculatedMonths = Math.max(1, Number(result.months) || 1);
    const isNpd = normalizeCategory(project) === 'NPD';

    // NPD schedules must always start and end with development (green).
    // If the calculated schedule is shorter than three months, expand the
    // roadmap to three months so it can show green / orange / green.
    const totalMonths = isNpd && calculatedMonths < 3 ? 3 : calculatedMonths;
    const testingMonths = isNpd
      ? Math.min(3, Math.max(1, totalMonths - 2))
      : 0;

    return { result, calculatedMonths, totalMonths, testingMonths, isNpd };
  }

  function periodStartIndex(startYear, mode) {
    return mode === 'fiscal' ? (startYear - 1) * 12 + 9 : startYear * 12;
  }

  function periodYearForIndex(index, mode) {
    const year = Math.floor(index / 12);
    const month = index % 12;
    return mode === 'fiscal' && month >= 9 ? year + 1 : year;
  }

  function roadmapStatus(project) {
    return String(project.status || '').trim().toLowerCase();
  }

  function roadmapColor(project) {
    const status = roadmapStatus(project);
    if (status === 'completed') return '#16a34a';
    if (status === 'active') return '#1E3A8A';
    if (status === 'on hold') return '#fca5a5';
    if (status === 'approved') return '#60a5fa';
    return '#94a3b8';
  }

  function visibleProjects(startYear, span, mode = 'fiscal') {
    const first = periodStartIndex(startYear, mode);
    const last = first + span * 12 - 1;
    return projects.filter(project => {
      if (roadmapStatus(project) === 'parking lot') return false;
      const start = monthIndex(project.startDate);
      if (start === null) return false;
      const finish = start + planFor(project).totalMonths - 1;
      return start <= last && finish >= first;
    }).sort((a,b) => (a.startDate || '').localeCompare(b.startDate || '') || String(a.name || '').localeCompare(String(b.name || '')));
  }

  function wrapText(value, maxChars = 40, maxLines = 2) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return ['Untitled Project'];
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars || !line) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const retained = lines.slice(0, maxLines);
      retained[maxLines - 1] = `${retained[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`;
      return retained;
    }
    return lines;
  }

  function starPoints(cx, cy, outer = 9, inner = 4.2, points = 5) {
    const result = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + i * Math.PI / points;
      result.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
    }
    return result.join(' ');
  }

  function buildRoadmapSvg(startYear, span = 1, mode = 'fiscal', screenOnly = false) {
    span = Math.min(3, Math.max(1, Number(span) || 1));
    const items = visibleProjects(startYear, span, mode);
    const projectWidth = 390;
    const monthWidth = 96;
    const left = 16;
    const right = 16;
    const titleHeight = screenOnly ? 0 : 92;
    const yearHeaderHeight = screenOnly ? 0 : (span > 1 ? 30 : 0);
    const fiscalHeaderHeight = screenOnly ? 0 : 30;
    const monthHeaderHeight = screenOnly ? 0 : 42;
    const rowHeight = 68;
    const footerHeight = 34;
    const monthCount = span * 12;
    const width = left + projectWidth + monthCount * monthWidth + right;
    const headerY = titleHeight;
    const rowsY = headerY + yearHeaderHeight + fiscalHeaderHeight + monthHeaderHeight;
    const height = rowsY + Math.max(1, items.length) * rowHeight + footerHeight;
    const firstMonth = periodStartIndex(startYear, mode);

    let svg = `<svg class="portfolioRoadmapSvg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Initiative Roadmap ${mode === 'fiscal' ? 'Fiscal Year' : 'Calendar Year'} ${startYear}${span > 1 ? ` through ${startYear + span - 1}` : ''}">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
    svg += `<style>
      text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#172033}
      .muted{fill:#64748b}.title{font-size:17px;font-weight:700}.legend{font-size:12px}
      .heading{font-size:12px;font-weight:700}.year{font-size:12px;font-weight:700;fill:#334155}
      .project{font-size:13px;font-weight:700}.meta{font-size:12px}.barLabel{font-size:11px;font-weight:700;fill:#ffffff}.roadmapProject{cursor:pointer}.roadmapProject:focus .roadmapRowOutline,.roadmapProject:hover .roadmapRowOutline{stroke:#1E3A8A;stroke-width:2;fill:#eff6ff}
    </style>`;
    const yearPrefix = mode === 'fiscal' ? 'FY' : 'CY';
    const titleRange = span > 1 ? `${yearPrefix}${startYear}-${yearPrefix}${startYear + span - 1}` : `${yearPrefix}${startYear}`;
    if (!screenOnly) {
      svg += `<text x="24" y="36" class="title">Initiative Roadmap - ${titleRange}</text>`;
      svg += `<text x="24" y="64" class="legend muted">Completed</text><rect x="102" y="53" width="22" height="10" rx="5" fill="#16a34a"/>`;
      svg += `<text x="145" y="64" class="legend muted">Active</text><rect x="195" y="53" width="22" height="10" rx="5" fill="#1E3A8A"/>`;
      svg += `<text x="238" y="64" class="legend muted">On Hold</text><rect x="302" y="53" width="22" height="10" rx="5" fill="#fca5a5"/>`;
      svg += `<circle cx="357" cy="59" r="4.5" fill="#64748b"/><text x="369" y="64" class="legend muted">Start</text>`;
      svg += `<polygon points="${starPoints(439,59,7,3.2)}" fill="#64748b"/><text x="451" y="64" class="legend muted">Finish</text>`;
    }

    if (!screenOnly) {
    if (span > 1) {
        svg += `<rect x="${left}" y="${headerY}" width="${width-left-right}" height="${yearHeaderHeight}" fill="#eef3f9" stroke="#dbe3f1"/>`;
        for (let y = 0; y < span; y++) {
          const x = left + projectWidth + y * 12 * monthWidth;
          svg += `<rect x="${x}" y="${headerY}" width="${12 * monthWidth}" height="${yearHeaderHeight}" fill="${y % 2 ? '#f7f9fc' : '#eef3f9'}" stroke="#dbe3f1"/>`;
          svg += `<text x="${x + 6 * monthWidth}" y="${headerY + 21}" class="year" text-anchor="middle">${mode === 'fiscal' ? 'FY' : 'CY'}${startYear + y}</text>`;
        }
      }

      const fiscalHeaderY = headerY + yearHeaderHeight;
      const periodHeading = mode === 'fiscal' ? 'Fiscal Period' : 'Calendar Period';
      svg += `<rect x="${left}" y="${fiscalHeaderY}" width="${width-left-right}" height="${fiscalHeaderHeight}" fill="#f1f5f9" stroke="#dbe3f1"/>`;
      svg += `<text x="${left + 13}" y="${fiscalHeaderY + 21}" class="heading">${periodHeading}</text>`;
      for (let i = 0; i < monthCount; i += 3) {
        const absolute = firstMonth + i;
        const calendarYear = Math.floor(absolute / 12);
        const month = absolute % 12;
        const labelYear = mode === 'fiscal' ? (month >= 9 ? calendarYear + 1 : calendarYear) : calendarYear;
        const quarter = mode === 'fiscal'
          ? (month >= 9 ? 1 : month <= 2 ? 2 : month <= 5 ? 3 : 4)
          : Math.floor(month / 3) + 1;
        const x = left + projectWidth + i * monthWidth;
        const blockWidth = Math.min(3, monthCount - i) * monthWidth;
        svg += `<rect x="${x}" y="${fiscalHeaderY}" width="${blockWidth}" height="${fiscalHeaderHeight}" fill="${(i/3)%2 ? '#f8fafc' : '#eef2f7'}" stroke="#dbe3f1"/>`;
        svg += `<text x="${x + blockWidth/2}" y="${fiscalHeaderY + 21}" class="year" text-anchor="middle">${mode === 'fiscal' ? 'FY' : 'CY'}${labelYear} Q${quarter}</text>`;
      }

      const monthHeaderY = fiscalHeaderY + fiscalHeaderHeight;
      svg += `<rect x="${left}" y="${monthHeaderY}" width="${width-left-right}" height="${monthHeaderHeight}" fill="#f8fafc" stroke="#dbe3f1"/>`;
      svg += `<text x="${left + 13}" y="${monthHeaderY + 27}" class="heading">Project</text>`;
      for (let i = 0; i < monthCount; i++) {
        const x = left + projectWidth + i * monthWidth;
        svg += `<line x1="${x}" y1="${monthHeaderY}" x2="${x}" y2="${height-footerHeight}" stroke="#e5e7eb"/>`;
        svg += `<text x="${x + monthWidth / 2}" y="${monthHeaderY + 27}" class="heading" text-anchor="middle">${MONTHS[(firstMonth + i) % 12]}</text>`;
      }
      svg += `<line x1="${width-right}" y1="${monthHeaderY}" x2="${width-right}" y2="${height-footerHeight}" stroke="#e5e7eb"/>`;

    } else {
      for (let i = 0; i <= monthCount; i++) {
        const x = left + projectWidth + i * monthWidth;
        svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height-footerHeight}" stroke="#e5e7eb"/>`;
      }
    }

    if (!items.length) {
      svg += `<text x="${width/2}" y="${rowsY + 40}" class="meta muted" text-anchor="middle">No scheduled projects overlap this range.</text>`;
    }

    items.forEach((project, row) => {
      const y = rowsY + row * rowHeight;
      const plan = planFor(project);
      const start = monthIndex(project.startDate);
      const finish = start + plan.totalMonths - 1;
      const category = normalizeCategory(project);
      const categoryText = CATEGORY_LABELS[category] || category;
      const nameLines = wrapText(project.name, 42, 2);
      const bg = row % 2 ? '#fbfcfe' : '#ffffff';
      const projectId = safeText(project.id);
      const projectLabel = safeText(`Edit ${project.name || 'project'}`);
      svg += `<g class="roadmapProject" data-project-id="${projectId}" tabindex="0" role="button" aria-label="${projectLabel}">`;
      svg += `<rect class="roadmapRowOutline" x="${left}" y="${y}" width="${width-left-right}" height="${rowHeight}" fill="${bg}" stroke="#e5e7eb"/>`;
      svg += `<title>Click to edit ${safeText(project.name || 'project')}</title>`;
      nameLines.forEach((line, idx) => {
        svg += `<text x="${left + 13}" y="${y + 23 + idx * 18}" class="project">${safeText(line)}</text>`;
      });
      const metaY = y + (nameLines.length === 1 ? 44 : 57);
      const meta = `${project.division || 'Unassigned'} · ${CATEGORY_LABELS[category]} · ${project.status || 'Proposed'}`;
      svg += `<text x="${left + 13}" y="${metaY}" class="meta muted">${safeText(meta.length > 52 ? `${meta.slice(0,51)}…` : meta)}</text>`;

      for (let i = 0; i < monthCount; i++) {
        const absolute = firstMonth + i;
        if (absolute < start || absolute > finish) continue;
        const x = left + projectWidth + i * monthWidth + 3;
        const barY = y + 22;
        const barW = monthWidth - 6;
        const fill = roadmapColor(project);
        const rx = absolute === start || absolute === finish ? 7 : 1;
        svg += `<rect x="${x}" y="${barY}" width="${barW}" height="28" rx="${rx}" fill="${fill}"/>`;
        if (absolute === start) {
          svg += `<circle cx="${x + 13}" cy="${barY + 14}" r="5" fill="#ffffff"/>`;
          svg += `<text x="${x + 26}" y="${barY + 19}" class="barLabel">${plan.totalMonths} mo.</text>`;
        }
        if (absolute === finish) svg += `<polygon points="${starPoints(x + barW - 13, barY + 14, 9, 4.2)}" fill="#172033"/>`;
      }
      svg += `</g>`;
    });

    svg += `<text x="24" y="${height - 12}" class="meta muted">Generated ${new Date().toLocaleDateString()}</text>`;
    svg += `</svg>`;
    return { svg, width, height, items, startYear, span, mode };
  }

  function ensureSpanSelector() {
    const year = document.querySelector('#roadmapYear');
    if (!year) return null;
    let span = document.querySelector('#roadmapYearSpan');
    if (!span) {
      span = document.createElement('select');
      span.id = 'roadmapYearSpan';
      span.setAttribute('aria-label', 'Years to display');
      span.innerHTML = '<option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option>';
      year.insertAdjacentElement('afterend', span);
    }
    return span;
  }

  function selectedRoadmapMode() {
    return document.querySelector('#roadmapCalendarMode')?.classList.contains('active') ? 'calendar' : 'fiscal';
  }

  function setRoadmapMode(mode) {
    const fiscal = document.querySelector('#roadmapFiscalMode');
    const calendar = document.querySelector('#roadmapCalendarMode');
    const isFiscal = mode !== 'calendar';
    fiscal?.classList.toggle('active', isFiscal);
    calendar?.classList.toggle('active', !isFiscal);
    fiscal?.setAttribute('aria-pressed', String(isFiscal));
    calendar?.setAttribute('aria-pressed', String(!isFiscal));
    localStorage.setItem('roadmapYearMode', isFiscal ? 'fiscal' : 'calendar');
    renderUnifiedRoadmap();
  }

  function populateYearSelector() {
    const selector = document.querySelector('#roadmapYear');
    if (!selector) return;
    const mode = selectedRoadmapMode();
    const projectYears = projects.map(p => monthIndex(p.startDate)).filter(Number.isFinite).map(index => periodYearForIndex(index, mode));
    const now = new Date();
    const current = periodYearForIndex(now.getFullYear() * 12 + now.getMonth(), mode);
    const min = projectYears.length ? Math.min(current, ...projectYears) : current;
    const max = projectYears.length ? Math.max(current + 3, ...projectYears) : current + 3;
    const existing = Number(selector.value);
    selector.innerHTML = Array.from({length: max-min+1}, (_,i) => min+i).map(y => `<option value="${y}">${y}</option>`).join('');
    selector.value = existing >= min && existing <= max ? String(existing) : String(min);
  }

  function bindRoadmapProjectEditors(grid) {
    grid.querySelectorAll('.roadmapProject[data-project-id]').forEach(row => {
      const edit = () => {
        const projectId = row.getAttribute('data-project-id');
        if (projectId && typeof openProject === 'function') openProject(projectId);
      };
      row.addEventListener('click', edit);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          edit();
        }
      });
    });
  }

  function buildRoadmapScreenHeader(startYear, span = 1, mode = 'fiscal') {
    span = Math.min(3, Math.max(1, Number(span) || 1));
    const projectWidth = 390;
    const monthWidth = 96;
    const monthCount = span * 12;
    const firstMonth = periodStartIndex(startYear, mode);
    const totalWidth = 16 + projectWidth + monthCount * monthWidth + 16;
    let yearRow = '';
    if (span > 1) {
      yearRow = `<div class="roadmapScreenYearRow" style="grid-template-columns:${projectWidth}px repeat(${span}, ${12 * monthWidth}px)"><div></div>${Array.from({length:span},(_,index)=>`<div>${mode === 'fiscal' ? 'FY' : 'CY'}${startYear + index}</div>`).join('')}</div>`;
    }
    const quarterCells = [];
    for (let i = 0; i < monthCount; i += 3) {
      const absolute = firstMonth + i;
      const calendarYear = Math.floor(absolute / 12);
      const month = absolute % 12;
      const labelYear = mode === 'fiscal' ? (month >= 9 ? calendarYear + 1 : calendarYear) : calendarYear;
      const quarter = mode === 'fiscal' ? (month >= 9 ? 1 : month <= 2 ? 2 : month <= 5 ? 3 : 4) : Math.floor(month / 3) + 1;
      quarterCells.push(`<div>${mode === 'fiscal' ? 'FY' : 'CY'}${labelYear} Q${quarter}</div>`);
    }
    const quarterRow = `<div class="roadmapScreenQuarterRow" style="grid-template-columns:${projectWidth}px repeat(${quarterCells.length}, ${3 * monthWidth}px)"><div>${mode === 'fiscal' ? 'Fiscal Period' : 'Calendar Period'}</div>${quarterCells.join('')}</div>`;
    const monthRow = `<div class="roadmapScreenMonthRow" style="grid-template-columns:${projectWidth}px repeat(${monthCount}, ${monthWidth}px)"><div>Project</div>${Array.from({length:monthCount},(_,index)=>`<div>${MONTHS[(firstMonth + index) % 12]}</div>`).join('')}</div>`;
    return `<div class="roadmapScreenHeader" style="width:${totalWidth}px">${yearRow}${quarterRow}${monthRow}</div>`;
  }

  function renderUnifiedRoadmap() {
    const grid = document.querySelector('#roadmapGrid');
    const selector = document.querySelector('#roadmapYear');
    const spanSelector = ensureSpanSelector();
    if (!grid || !selector || !spanSelector) return;
    populateYearSelector();
    const startYear = Number(selector.value);
    const span = Number(spanSelector.value);
    const mode = selectedRoadmapMode();
    const output = buildRoadmapSvg(startYear, span, mode, true);
    grid.innerHTML = `${buildRoadmapScreenHeader(startYear, span, mode)}<div class="roadmapSvgShell">${output.svg}</div>`;
    bindRoadmapProjectEditors(grid);
    selector.onchange = renderUnifiedRoadmap;
    spanSelector.onchange = renderUnifiedRoadmap;
    const fiscalButton = document.querySelector('#roadmapFiscalMode');
    const calendarButton = document.querySelector('#roadmapCalendarMode');
    if (fiscalButton) fiscalButton.onclick = () => setRoadmapMode('fiscal');
    if (calendarButton) calendarButton.onclick = () => setRoadmapMode('calendar');
  }

  function svgToCanvas(svg, width, height, scale = 2) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0,0,canvas.width,canvas.height);
          context.scale(scale,scale);
          context.drawImage(image,0,0,width,height);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (error) { URL.revokeObjectURL(url); reject(error); }
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to render roadmap image.')); };
      image.src = url;
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  function dataUrlBytes(dataUrl) {
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes;
  }

  function makeImagePdf(jpegBytes, imageWidth, imageHeight) {
    // Preserve the exact roadmap aspect ratio in a landscape PDF page.
    const pageHeight = 792;
    const margin = 24;
    const pageWidth = Math.max(1224, Math.min(2592, Math.round((imageWidth / imageHeight) * (pageHeight - margin*2) + margin*2)));
    const scale = Math.min((pageWidth-margin*2)/imageWidth,(pageHeight-margin*2)/imageHeight);
    const drawWidth=imageWidth*scale, drawHeight=imageHeight*scale;
    const x=(pageWidth-drawWidth)/2, y=(pageHeight-drawHeight)/2;
    const encoder=new TextEncoder(), chunks=[], offsets=[0]; let size=0;
    const addText=t=>{const b=encoder.encode(t);chunks.push(b);size+=b.length};
    const addBytes=b=>{chunks.push(b);size+=b.length};
    const object=(n,body,stream)=>{offsets[n]=size;addText(`${n} 0 obj\n${body}`);if(stream){addText('\nstream\n');addBytes(stream);addText('\nendstream')}addText('\nendobj\n')};
    addText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    object(4,`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,jpegBytes);
    const command=encoder.encode(`q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ`);
    object(5,`<< /Length ${command.length} >>`,command);
    const xref=size; addText('xref\n0 6\n0000000000 65535 f \n');
    for(let i=1;i<=5;i++)addText(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks,{type:'application/pdf'});
  }

  function currentOutput() {
    const year=Number(document.querySelector('#roadmapYear')?.value||new Date().getFullYear());
    const span=Number(document.querySelector('#roadmapYearSpan')?.value||1);
    return buildRoadmapSvg(year,span,selectedRoadmapMode());
  }

  async function exportPng() {
    const output=currentOutput();
    const canvas=await svgToCanvas(output.svg,output.width,output.height,2);
    canvas.toBlob(blob=>blob&&downloadBlob(blob,`${output.mode}-roadmap-${output.startYear}-${output.span}yr.png`),'image/png');
  }

  async function exportPdf() {
    const output=currentOutput();
    const canvas=await svgToCanvas(output.svg,output.width,output.height,1.5);
    const jpeg=canvas.toDataURL('image/jpeg',0.94);
    downloadBlob(makeImagePdf(dataUrlBytes(jpeg),canvas.width,canvas.height),`${output.mode}-roadmap-${output.startYear}-${output.span}yr-landscape.pdf`);
  }

  function replaceExportButton(id, handler) {
    const old=document.getElementById(id); if(!old)return;
    const fresh=old.cloneNode(true); old.replaceWith(fresh);
    fresh.addEventListener('click',async()=>{fresh.disabled=true;try{await handler()}catch(error){console.error(error);alert(error.message||'Export failed.')}finally{fresh.disabled=false}});
  }

  renderRoadmap = renderUnifiedRoadmap;
  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = () => { previousRender(); renderUnifiedRoadmap(); };
  }

  ensureSpanSelector();
  const savedMode = localStorage.getItem('roadmapYearMode');
  if (savedMode === 'calendar') {
    document.querySelector('#roadmapFiscalMode')?.classList.remove('active');
    document.querySelector('#roadmapCalendarMode')?.classList.add('active');
    document.querySelector('#roadmapFiscalMode')?.setAttribute('aria-pressed', 'false');
    document.querySelector('#roadmapCalendarMode')?.setAttribute('aria-pressed', 'true');
  }
  replaceExportButton('downloadRoadmapPng',exportPng);
  replaceExportButton('downloadRoadmapPdf',exportPdf);
  renderUnifiedRoadmap();
})();
