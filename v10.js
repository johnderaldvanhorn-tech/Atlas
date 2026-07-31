(() => {
  const HEADERS = ['Name', 'Role', 'Department', 'Loaded Rate', 'Hours / Month'];

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadResourcesCsv() {
    const rows = [HEADERS, ...resources.map(r => [
      r.name || '',
      r.role || '',
      r.department || '',
      Number(r.loadedRate) || 0,
      Number(r.hoursPerMonth) || 0
    ])];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    downloadText('portfolio-resources.csv', csv);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  function normalizeHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function readNumber(value) {
    const cleaned = String(value ?? '').replace(/[$,\s]/g, '');
    return cleaned === '' ? NaN : Number(cleaned);
  }

  async function importResourcesCsv(file) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      alert('The CSV does not contain any resource rows.');
      return;
    }

    const headerMap = new Map(rows[0].map((h, i) => [normalizeHeader(h), i]));
    const aliases = {
      name: ['name', 'resourcename'],
      role: ['role', 'jobtitle'],
      department: ['department', 'division'],
      rate: ['loadedrate', 'loadedhourlyrate', 'hourlyrate', 'rate'],
      hours: ['hoursmonth', 'hourspermonth', 'availablehourspermonth', 'monthlyhours']
    };
    const col = {};
    for (const [key, names] of Object.entries(aliases)) {
      col[key] = names.map(n => headerMap.get(n)).find(v => v !== undefined);
    }
    if (col.name === undefined) {
      alert('The CSV must include a Name column.');
      return;
    }

    let created = 0, updated = 0, skipped = 0;
    const errors = [];
    for (const [offset, row] of rows.slice(1).entries()) {
      const line = offset + 2;
      const name = String(row[col.name] || '').trim();
      const role = col.role === undefined ? '' : String(row[col.role] || '').trim();
      const department = col.department === undefined ? '' : String(row[col.department] || '').trim();
      const rate = col.rate === undefined ? 0 : readNumber(row[col.rate]);
      const hours = col.hours === undefined ? 140 : readNumber(row[col.hours]);

      if (!name) { skipped++; errors.push(`Row ${line}: Name is required.`); continue; }
      if (!Number.isFinite(rate) || rate < 0) { skipped++; errors.push(`Row ${line}: Loaded Rate must be a non-negative number.`); continue; }
      if (!Number.isFinite(hours) || hours <= 0) { skipped++; errors.push(`Row ${line}: Hours / Month must be greater than zero.`); continue; }

      const existingIndex = resources.findIndex(r => String(r.name || '').trim().toLowerCase() === name.toLowerCase());
      const record = {
        id: existingIndex >= 0 ? resources[existingIndex].id : null,
        name,
        role,
        department,
        loadedRate: rate,
        hoursPerMonth: hours
      };
      if (!db || !window.ProjectRepository) throw new Error('Supabase is not connected.');
      const saved = await window.ProjectRepository.saveResource(record);
      if (existingIndex >= 0) { resources[existingIndex] = saved; updated++; }
      else { resources.push(saved); created++; }
    }

    persist();
    render();
    const detail = errors.length ? `\n\nWarnings:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n…and ${errors.length - 10} more.` : ''}` : '';
    alert(`Resource import complete.\n\nCreated: ${created}\nUpdated: ${updated}\nSkipped: ${skipped}${detail}`);
  }

  function init() {
    const download = document.getElementById('downloadResourcesCsv');
    const upload = document.getElementById('uploadResourcesCsv');
    const input = document.getElementById('resourceCsvFile');
    if (!download || !upload || !input) return;
    download.addEventListener('click', downloadResourcesCsv);
    upload.addEventListener('click', () => { input.value = ''; input.click(); });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try { await importResourcesCsv(file); }
      catch (error) { console.error(error); alert(`Unable to import resources: ${error.message || error}`); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
