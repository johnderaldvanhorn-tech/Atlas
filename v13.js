(() => {
  // v0.6.22 - Landscape PNG/PDF export with dashboard color coding and top-aligned PDF layout.
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
  }[char]));

  const fmtMoney = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const fmtPct = value => `${(Number(value || 0) * 100).toFixed(0)}%`;

  function fiscalPeriod(index) {
    const year = Math.floor(index / 12);
    const month = index % 12;
    const fiscalYear = month >= 9 ? year + 1 : year;
    const quarter = month >= 9 ? 1 : month <= 2 ? 2 : month <= 5 ? 3 : 4;
    return `FY${fiscalYear} Q${quarter}`;
  }

  function fiscalRange(project, months) {
    const value = String(project.startDate || '');
    if (!/^\d{4}-\d{2}$/.test(value)) return 'Unscheduled';
    const [year, month] = value.split('-').map(Number);
    const start = year * 12 + month - 1;
    const end = start + Math.max(1, Number(months) || 1) - 1;
    const a = fiscalPeriod(start), b = fiscalPeriod(end);
    return a === b ? a : `${a} → ${b}`;
  }

  function visibleProjects() {
    const ids = [...document.querySelectorAll('#projectRows tr[data-id]')].map(row => row.dataset.id);
    if (!ids.length) return [];
    const byId = new Map(projects.map(project => [String(project.id), project]));
    return ids.map(id => byId.get(String(id))).filter(Boolean);
  }

  function wrapText(text, maxChars, maxLines = 3) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxChars || !line) line = candidate;
      else { lines.push(line); line = word; }
      if (lines.length === maxLines - 1) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      const last = lines.length - 1;
      lines[last] = `${lines[last].replace(/[.…]+$/, '')}…`;
    }
    return lines;
  }


  function pillPalette(kind, value) {
    const text = String(value || '').toLowerCase();
    if (kind === 'quadrant') {
      if (text.includes('quick')) return { fill:'#d1fae5', text:'#166534', stroke:'#bbf7d0' };
      if (text.includes('long')) return { fill:'#dbeafe', text:'#1d4ed8', stroke:'#bfdbfe' };
      if (text.includes('slow')) return { fill:'#fef3c7', text:'#92400e', stroke:'#fde68a' };
      return { fill:'#f1f5f9', text:'#475569', stroke:'#e2e8f0' };
    }
    if (kind === 'fiscal') return { fill:'#eef2ff', text:'#3730a3', stroke:'#e0e7ff' };
    const numeric = Number(value) || 0;
    if (numeric >= 0.8) return { fill:'#d1fae5', text:'#166534', stroke:'#bbf7d0' };
    if (numeric >= 0.6) return { fill:'#fef3c7', text:'#92400e', stroke:'#fde68a' };
    return { fill:'#fee2e2', text:'#991b1b', stroke:'#fecaca' };
  }

  function pillSvg(x, y, width, height, label, palette, anchor = 'middle') {
    const radius = height / 2;
    const textX = anchor === 'end' ? x + width - 12 : anchor === 'start' ? x + 12 : x + width / 2;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${palette.fill}" stroke="${palette.stroke}"/>` +
      `<text x="${textX}" y="${y + height/2 + 5}" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="${palette.text}" text-anchor="${anchor}">${safe(label)}</text>`;
  }

  function buildPortfolioSvg() {
    const list = visibleProjects();
    const columns = [
      { key:'project', label:'Project', width:500, align:'left' },
      { key:'division', label:'Division', width:170, align:'left' },
      { key:'champion', label:'Champion', width:180, align:'left' },
      { key:'quadrant', label:'Quadrant', width:210, align:'left' },
      { key:'alignment', label:'Alignment Score', width:190, align:'right' },
      { key:'duration', label:'Duration', width:130, align:'right' },
      { key:'fiscal', label:'Fiscal Quarter', width:280, align:'left' },
      { key:'spend', label:'Total Spend', width:180, align:'right' },
      { key:'revenue', label:'Y1 Revenue', width:180, align:'right' },
      { key:'roi', label:'ROI', width:120, align:'right' },
      { key:'score', label:'Total Initiative Score', width:220, align:'right' }
    ];
    const left = 24, right = 24;
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const width = left + tableWidth + right;
    const titleHeight = 118, headerHeight = 58, rowHeight = 82, footerHeight = 42;
    const height = titleHeight + headerHeight + Math.max(1, list.length) * rowHeight + footerHeight;
    const generated = new Date().toLocaleDateString();
    const search = document.querySelector('#projectSearch')?.value?.trim();
    const fiscal = document.querySelector('#fiscalQuarterFilter')?.selectedOptions?.[0]?.textContent || 'All fiscal quarters';

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
    svg += `<style>text{font-family:Arial,Helvetica,sans-serif;fill:#172033}.title{font-size:30px;font-weight:700}.sub{font-size:16px;fill:#64748b}.head{font-size:14px;font-weight:700;fill:#5b677d}.cell{font-size:15px}.name{font-size:16px;font-weight:700}.meta{font-size:13px;fill:#64748b}.num{font-size:15px;font-weight:600}</style>`;
    svg += `<text x="${left}" y="42" class="title">Product Initiatives</text>`;
    svg += `<text x="${left}" y="72" class="sub">Executive project evaluation - ${safe(fiscal)}${search ? ` - Search: ${safe(search)}` : ''}</text>`;
    svg += `<text x="${width-right}" y="72" class="sub" text-anchor="end">Generated ${safe(generated)} - v${safe(window.APP_VERSION || '0.6.22')}</text>`;
    svg += `<line x1="${left}" y1="94" x2="${width-right}" y2="94" stroke="#dbe3f1"/>`;

    const headerY = titleHeight;
    svg += `<rect x="${left}" y="${headerY}" width="${tableWidth}" height="${headerHeight}" fill="#f8fafc" stroke="#dbe3f1"/>`;
    let x = left;
    columns.forEach(col => {
      svg += `<line x1="${x}" y1="${headerY}" x2="${x}" y2="${height-footerHeight}" stroke="#e5e7eb"/>`;
      const tx = col.align === 'right' ? x + col.width - 14 : x + 14;
      svg += `<text x="${tx}" y="${headerY+35}" class="head" text-anchor="${col.align === 'right' ? 'end' : 'start'}">${safe(col.label)}</text>`;
      x += col.width;
    });
    svg += `<line x1="${x}" y1="${headerY}" x2="${x}" y2="${height-footerHeight}" stroke="#e5e7eb"/>`;

    if (!list.length) {
      svg += `<text x="${width/2}" y="${headerY+headerHeight+50}" class="sub" text-anchor="middle">No projects match the current portfolio filters.</text>`;
    }

    list.forEach((project, rowIndex) => {
      const c = calculate(project);
      const y = headerY + headerHeight + rowIndex * rowHeight;
      svg += `<rect x="${left}" y="${y}" width="${tableWidth}" height="${rowHeight}" fill="${rowIndex % 2 ? '#fbfdff' : '#ffffff'}" stroke="#e9edf3"/>`;
      let cx = left;
      const nameLines = wrapText(project.name, 44, 2);
      nameLines.forEach((line, i) => svg += `<text x="${cx+14}" y="${y+24+i*19}" class="name">${safe(line)}</text>`);
      const metaY = y + (nameLines.length > 1 ? 63 : 47);
      svg += `<text x="${cx+14}" y="${metaY}" class="meta">${safe(project.status || '')} · ${safe(typeof categoryLabel==='function'?categoryLabel(project.category):project.category||'')}</text>`;
      cx += columns[0].width;

      const values = [
        project.division || '', project.champion || 'Unassigned', c.quadrant || '',
        fmtPct(c.alignmentScore), `${Number(c.months || 0).toFixed(0)} mo.`,
        fiscalRange(project, c.months), fmtMoney(c.totalSpend), fmtMoney(c.year1Revenue),
        fmtPct(c.roi), fmtPct(c.totalProjectScore)
      ];
      values.forEach((value, i) => {
        const col = columns[i+1];
        const metricKey = ['division','champion','quadrant','alignment','duration','fiscal','spend','revenue','roi','score'][i];
        if (metricKey === 'quadrant') {
          const pillWidth = Math.min(col.width - 28, Math.max(104, String(value).length * 8.3 + 28));
          svg += pillSvg(cx + 14, y + 25, pillWidth, 30, value, pillPalette('quadrant', value), 'middle');
        } else if (metricKey === 'alignment' || metricKey === 'roi' || metricKey === 'score') {
          const raw = metricKey === 'alignment' ? c.alignmentScore : metricKey === 'roi' ? c.roi : c.totalProjectScore;
          const pillWidth = metricKey === 'score' ? 82 : 68;
          svg += pillSvg(cx + col.width - pillWidth - 14, y + 25, pillWidth, 30, value, pillPalette(metricKey, raw), 'middle');
        } else if (metricKey === 'fiscal') {
          const pillWidth = Math.min(col.width - 28, Math.max(104, String(value).length * 7.4 + 26));
          svg += pillSvg(cx + 14, y + 25, pillWidth, 30, value, pillPalette('fiscal', value), 'middle');
        } else {
          const tx = col.align === 'right' ? cx + col.width - 14 : cx + 14;
          const anchor = col.align === 'right' ? 'end' : 'start';
          const cls = col.align === 'right' ? 'num' : 'cell';
          const maxChars = Math.max(10, Math.floor(col.width / 9));
          const lines = wrapText(value, maxChars, 2);
          lines.forEach((line, li) => svg += `<text x="${tx}" y="${y+38+li*19}" class="${cls}" text-anchor="${anchor}">${safe(line)}</text>`);
        }
        cx += col.width;
      });
    });

    svg += `<text x="${left}" y="${height-14}" class="meta">${list.length} project${list.length === 1 ? '' : 's'} shown</text>`;
    svg += `</svg>`;
    return { svg, width, height };
  }

  function svgToCanvas(svg, width, height, scale = 2) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.scale(scale,scale); ctx.drawImage(image,0,0,width,height);
        URL.revokeObjectURL(url); resolve(canvas);
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to render portfolio export.')); };
      image.src = url;
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function dataUrlBytes(dataUrl) {
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function makePdf(jpegBytes, imageWidth, imageHeight) {
    const pageWidth = 1224, pageHeight = 792, marginX = 30, marginTop = 34, marginBottom = 30;
    const scale = Math.min((pageWidth-marginX*2)/imageWidth, (pageHeight-marginTop-marginBottom)/imageHeight);
    const drawWidth=imageWidth*scale, drawHeight=imageHeight*scale;
    const dx=(pageWidth-drawWidth)/2, dy=pageHeight-marginTop-drawHeight;
    const enc=new TextEncoder(), chunks=[], offsets=[0]; let size=0;
    const text=s=>{const b=enc.encode(s);chunks.push(b);size+=b.length;};
    const bytes=b=>{chunks.push(b);size+=b.length;};
    const obj=(n,body,stream)=>{offsets[n]=size;text(`${n} 0 obj\n${body}`);if(stream){text('\nstream\n');bytes(stream);text('\nendstream');}text('\nendobj\n');};
    text('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4,`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,jpegBytes);
    const cmd=enc.encode(`q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm\n/Im0 Do\nQ`);
    obj(5,`<< /Length ${cmd.length} >>`,cmd);
    const xref=size;text('xref\n0 6\n0000000000 65535 f \n');
    for(let i=1;i<=5;i++)text(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks,{type:'application/pdf'});
  }

  async function exportPng() {
    const output = buildPortfolioSvg();
    const canvas = await svgToCanvas(output.svg, output.width, output.height, 2);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
    if (!blob) throw new Error('PNG export failed.');
    downloadBlob(blob, 'project-portfolio-landscape.png');
  }

  async function exportPdf() {
    const output = buildPortfolioSvg();
    const canvas = await svgToCanvas(output.svg, output.width, output.height, 1.35);
    const jpeg = canvas.toDataURL('image/jpeg',0.94);
    downloadBlob(makePdf(dataUrlBytes(jpeg),canvas.width,canvas.height),'project-portfolio-landscape.pdf');
  }

  const toolbar = document.querySelector('#projectsView .panelHead.toolbar');
  const controls = toolbar?.querySelector('.portfolioControls');
  if (controls && !document.querySelector('#downloadPortfolioPng')) {
    const png = document.createElement('button');
    png.id='downloadPortfolioPng'; png.className='secondary exportCompactButton'; png.type='button'; png.textContent='PNG'; png.title='Download PNG'; png.setAttribute('aria-label','Download PNG');
    const pdf = document.createElement('button');
    pdf.id='downloadPortfolioPdf'; pdf.className='primary exportCompactButton'; pdf.type='button'; pdf.textContent='PDF'; pdf.title='Download PDF'; pdf.setAttribute('aria-label','Download PDF');
    const exportGroup=document.createElement('div'); exportGroup.className='exportButtonGroup'; exportGroup.appendChild(png); exportGroup.appendChild(pdf); controls.appendChild(exportGroup);
    png.onclick=async()=>{png.disabled=true;try{await exportPng();}catch(e){alert(e.message||'PNG export failed.');}finally{png.disabled=false;}};
    pdf.onclick=async()=>{pdf.disabled=true;try{await exportPdf();}catch(e){alert(e.message||'PDF export failed.');}finally{pdf.disabled=false;}};
  }
})();
