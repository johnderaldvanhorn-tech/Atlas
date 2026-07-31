(() => {
  // v0.6.5 - Correct roadmap phase colors and add standalone landscape PNG/PDF exports.
  const CATEGORY_LABELS = {
    NPD: 'NPD - New Product Development',
    CI: 'CI - Continuous Improvement',
    DPT: 'Skunkworks - Experimental / rapid development',
    SUSTAINED: 'Sustained - Bugs and Defects'
  };

  function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    }[char]));
  }

  function normalizeCategory(project) {
    const value = String(project.category || '').trim().toUpperCase();
    return ['NPD', 'CI', 'DPT', 'SUSTAINED'].includes(value) ? value : 'CI';
  }

  function monthIndex(value) {
    if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month] = String(value).split('-').map(Number);
    return year * 12 + month - 1;
  }

  function planFor(project) {
    const result = calculate(project);
    const totalMonths = Math.max(1, Number(result.months) || 1);
    const isNpd = normalizeCategory(project) === 'NPD';
    const testingMonths = isNpd ? Math.min(3, Math.max(1, Math.ceil(totalMonths / 2))) : 0;
    return { result, totalMonths, testingMonths, isNpd };
  }

  function projectsForYear(year) {
    const first = year * 12;
    const last = first + 11;
    return projects.filter(project => {
      const start = monthIndex(project.startDate);
      if (start === null) return false;
      const plan = planFor(project);
      const finish = start + plan.totalMonths - 1;
      return start <= last && finish >= first;
    }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || String(a.name).localeCompare(String(b.name)));
  }

  function buildRoadmapSvg(year) {
    const items = projectsForYear(year);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const width = 1800;
    const titleHeight = 92;
    const headerHeight = 42;
    const rowHeight = 58;
    const footerHeight = 34;
    const projectWidth = 360;
    const monthWidth = (width - projectWidth - 30) / 12;
    const height = titleHeight + headerHeight + Math.max(1, items.length) * rowHeight + footerHeight;
    const firstMonth = year * 12;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
    svg += `<style>text{font-family:Arial,Helvetica,sans-serif;fill:#172033}.muted{fill:#64748b}.small{font-size:15px}.month{font-size:16px;font-weight:700}.project{font-size:18px;font-weight:700}.meta{font-size:14px}.title{font-size:28px;font-weight:700}</style>`;
    svg += `<text x="24" y="38" class="title">Initiative Roadmap - ${year}</text>`;
    svg += `<text x="24" y="64" class="small muted">Green: Development</text><rect x="172" y="52" width="24" height="10" rx="5" fill="#16a34a"/>`;
    svg += `<text x="220" y="64" class="small muted">Orange: Testing - NPD only</text><rect x="425" y="52" width="24" height="10" rx="5" fill="#f59e0b"/>`;
    svg += `<text x="478" y="64" class="small muted">● Start</text><text x="555" y="64" class="small muted">★ Finish</text>`;

    const headerY = titleHeight;
    svg += `<rect x="15" y="${headerY}" width="${width - 30}" height="${headerHeight}" fill="#f8fafc" stroke="#dbe3f1"/>`;
    svg += `<text x="28" y="${headerY + 27}" class="month">Project</text>`;
    months.forEach((month, index) => {
      const x = 15 + projectWidth + index * monthWidth;
      svg += `<line x1="${x}" y1="${headerY}" x2="${x}" y2="${height - footerHeight}" stroke="#e5e7eb"/>`;
      svg += `<text x="${x + monthWidth / 2}" y="${headerY + 27}" class="month" text-anchor="middle">${month}</text>`;
    });
    svg += `<line x1="${width - 15}" y1="${headerY}" x2="${width - 15}" y2="${height - footerHeight}" stroke="#e5e7eb"/>`;

    if (!items.length) {
      svg += `<text x="${width / 2}" y="${headerY + headerHeight + 48}" class="small muted" text-anchor="middle">No scheduled projects overlap ${year}.</text>`;
    }

    items.forEach((project, rowIndex) => {
      const y = headerY + headerHeight + rowIndex * rowHeight;
      const start = monthIndex(project.startDate);
      const plan = planFor(project);
      const finish = start + plan.totalMonths - 1;
      const testingStart = finish - plan.testingMonths + 1;
      const category = normalizeCategory(project);
      svg += `<rect x="15" y="${y}" width="${width - 30}" height="${rowHeight}" fill="${rowIndex % 2 ? '#fbfdff' : '#ffffff'}" stroke="#e9edf3"/>`;
      svg += `<text x="28" y="${y + 23}" class="project">${safeText(project.name)}</text>`;
      svg += `<text x="28" y="${y + 44}" class="meta muted">${safeText(project.division || '')} · ${safeText(CATEGORY_LABELS[category])}</text>`;

      for (let m = 0; m < 12; m++) {
        const absolute = firstMonth + m;
        const active = absolute >= start && absolute <= finish;
        if (!active) continue;
        const testing = plan.isNpd && absolute >= testingStart;
        const x = 15 + projectWidth + m * monthWidth + 3;
        const barY = y + 15;
        const barW = monthWidth - 6;
        const fill = testing ? '#f59e0b' : '#16a34a';
        const leftRadius = absolute === start ? 8 : 0;
        const rightRadius = absolute === finish ? 8 : 0;
        // SVG rect does not support separate corner radii; use rounded ends only on single/edge cells.
        const radius = (absolute === start || absolute === finish) ? 7 : 0;
        svg += `<rect x="${x}" y="${barY}" width="${barW}" height="28" rx="${radius}" fill="${fill}"/>`;
        if (absolute === start) svg += `<circle cx="${x + 13}" cy="${barY + 14}" r="5" fill="#ffffff"/>`;
        if (absolute === finish) svg += `<text x="${x + barW - 12}" y="${barY + 20}" font-size="17" font-family="Arial" fill="#ffffff" text-anchor="middle">★</text>`;
        if (absolute === start) svg += `<text x="${x + 26}" y="${barY + 19}" font-size="13" font-weight="700" font-family="Arial" fill="#ffffff">${plan.totalMonths} mo.</text>`;
      }
    });

    svg += `<text x="24" y="${height - 12}" class="meta muted">Generated ${new Date().toLocaleDateString()}</text>`;
    svg += `</svg>`;
    return { svg, width, height, items };
  }

  function svgToCanvas(svg, width, height, scale = 2) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.scale(scale, scale);
          context.drawImage(image, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to render roadmap image.'));
      };
      image.src = url;
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function dataUrlBytes(dataUrl) {
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function makeSingleImagePdf(jpegBytes, imageWidth, imageHeight) {
    // Ledger landscape: 17 x 11 inches at 72 points/inch.
    const pageWidth = 1224;
    const pageHeight = 792;
    const margin = 24;
    const scale = Math.min((pageWidth - margin * 2) / imageWidth, (pageHeight - margin * 2) / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [0];
    let size = 0;
    const addText = text => { const bytes = encoder.encode(text); chunks.push(bytes); size += bytes.length; };
    const addBytes = bytes => { chunks.push(bytes); size += bytes.length; };
    const object = (number, body, streamBytes) => {
      offsets[number] = size;
      addText(`${number} 0 obj\n${body}`);
      if (streamBytes) {
        addText(`\nstream\n`);
        addBytes(streamBytes);
        addText(`\nendstream`);
      }
      addText(`\nendobj\n`);
    };

    addText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    object(4, `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`, jpegBytes);
    const command = encoder.encode(`q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ`);
    object(5, `<< /Length ${command.length} >>`, command);
    const xrefOffset = size;
    addText('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 1; i <= 5; i++) addText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function exportPng() {
    const year = Number(document.querySelector('#roadmapYear')?.value || new Date().getFullYear());
    const output = buildRoadmapSvg(year);
    const canvas = await svgToCanvas(output.svg, output.width, output.height, 2);
    canvas.toBlob(blob => {
      if (!blob) return;
      downloadBlob(blob, `portfolio-roadmap-${year}.png`);
    }, 'image/png');
  }

  async function exportPdf() {
    const year = Number(document.querySelector('#roadmapYear')?.value || new Date().getFullYear());
    const output = buildRoadmapSvg(year);
    // Use a moderate raster size so the PDF remains compact while readable.
    const canvas = await svgToCanvas(output.svg, output.width, output.height, 1.5);
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = makeSingleImagePdf(dataUrlBytes(jpegUrl), canvas.width, canvas.height);
    downloadBlob(pdf, `portfolio-roadmap-${year}-landscape.pdf`);
  }

  const pngButton = document.querySelector('#downloadRoadmapPng');
  const pdfButton = document.querySelector('#downloadRoadmapPdf');
  if (pngButton) pngButton.addEventListener('click', async () => {
    pngButton.disabled = true;
    try { await exportPng(); } catch (error) { alert(error.message || 'PNG export failed.'); }
    finally { pngButton.disabled = false; }
  });
  if (pdfButton) pdfButton.addEventListener('click', async () => {
    pdfButton.disabled = true;
    try { await exportPdf(); } catch (error) { alert(error.message || 'PDF export failed.'); }
    finally { pdfButton.disabled = false; }
  });
})();
