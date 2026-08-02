(() => {
  const $=s=>document.querySelector(s);
  const metricKey='atlas.scorecard.metrics.v1';
  const historyKey='atlas.scorecard.history.v1';
  let editingId=null;
  let anchorDate=null;
  let selectedYear=new Date().getFullYear();
  const earliestDate=new Date('2024-01-01T12:00:00');
  const defaults=[
    {id:'software-mrr',metric_name:'Software MRR',team:'Product & Technology',category:'Financial',owner:'CTO',unit:'currency',target_value:150000,current_value:133500,average_value:98571,status:'Needs Attention',notes:'',updated_at:new Date().toISOString()},
    {id:'connections',metric_name:'Current Connections',team:'Product & Technology',category:'Customer Growth',owner:'CTO',unit:'number',target_value:4200,current_value:3793,average_value:2775,status:'Needs Attention',notes:'',updated_at:new Date().toISOString()}
  ];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=(v,u)=>u==='currency'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0):u==='percent'?`${Number(v||0).toFixed(1)}%`:new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(v)||0);
  const parseLocal=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
  const saveLocal=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const db=()=>window.ProjectRepository?.client||null;
  const iso=d=>d.toISOString().slice(0,10);
  function endOfWeek(d=new Date()){const x=new Date(d);x.setHours(12,0,0,0);const day=x.getDay();x.setDate(x.getDate()+(day===0?0:7-day));return x}
  function clampAnchor(d){const current=endOfWeek();const x=endOfWeek(d);if(x>current)return current;if(x<endOfWeek(earliestDate))return endOfWeek(earliestDate);return x}
  function weeks(count=8,anchor=anchorDate||endOfWeek()){
    const last=clampAnchor(anchor);
    return Array.from({length:count},(_,i)=>{const end=new Date(last);end.setDate(last.getDate()-7*i);const start=new Date(end);start.setDate(end.getDate()-6);return {start:iso(start),end:iso(end),label:`${start.toLocaleDateString('en-US',{month:'short'}).toUpperCase()} ${String(start.getDate()).padStart(2,'0')} - ${end.toLocaleDateString('en-US',{month:'short'}).toUpperCase()} ${String(end.getDate()).padStart(2,'0')}`}})
  }
  function yearWeeks(year=selectedYear){
    const y=Number(year)||new Date().getFullYear();
    const firstDay=new Date(`${y}-01-01T12:00:00`);
    const lastDay=new Date(`${y}-12-31T12:00:00`);

    let weekEnd=endOfWeek(firstDay);
    const rows=[];

    while(weekEnd.getFullYear()===y || weekEnd<=lastDay){
      const end=new Date(weekEnd);
      const start=new Date(end);
      start.setDate(end.getDate()-6);

      if(start<=lastDay && end>=firstDay){
        rows.push({
          start:iso(start),
          end:iso(end),
          label:`${start.toLocaleDateString('en-US',{month:'short'}).toUpperCase()} ${String(start.getDate()).padStart(2,'0')} - ${end.toLocaleDateString('en-US',{month:'short'}).toUpperCase()} ${String(end.getDate()).padStart(2,'0')}`
        });
      }

      weekEnd.setDate(weekEnd.getDate()+7);

      if(weekEnd.getFullYear()>y && weekEnd>lastDay){
        break;
      }
    }

    return rows.reverse();
  }

  function seedHistory(){
    const existing=parseLocal(historyKey);if(existing.length)return existing;
    const vals={'software-mrr':[110500,110000,108000,108000,107500,107000,103000,101500],'connections':[3200,3193,3150,3160,3141,3126,3057,3010]};
    const ws=weeks();const rows=[];
    Object.entries(vals).forEach(([metric_id,arr])=>arr.forEach((value,i)=>rows.push({id:crypto.randomUUID(),metric_id,period_end:ws[i].end,value,notes:'',created_at:new Date().toISOString()})));
    saveLocal(historyKey,rows);return rows;
  }
  async function load(){
    let metrics=parseLocal(metricKey);if(!metrics.length)metrics=defaults;
    let history=seedHistory();const client=db();
    if(client){const [{data:m,error:me},{data:h,error:he}]=await Promise.all([client.from('executive_scorecard').select('*').order('display_order'),client.from('executive_scorecard_history').select('*').order('period_end',{ascending:false})]);if(!me&&m?.length)metrics=m;if(!he&&h?.length)history=h}
    window.scorecardMetrics=metrics;window.scorecardHistory=history;
    window.dispatchEvent(
      new CustomEvent('atlas:scorecard-updated')
    );saveLocal(metricKey,metrics);saveLocal(historyKey,history);
  }
  function metricHistory(id){return (window.scorecardHistory||[]).filter(x=>String(x.metric_id)===String(id))}
  function valFor(id,date){return metricHistory(id).find(x=>x.period_end===date)?.value}
  function averageFor(id){const a=metricHistory(id).map(x=>Number(x.value)).filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0}
  function currentFor(id,fallback){const a=metricHistory(id).sort((x,y)=>String(y.period_end).localeCompare(String(x.period_end)));return a.length?Number(a[0].value):Number(fallback)||0}
  function good(m,v){return Number(v)>=Number(m.target_value||0)}
  function populateYears(){const select=$('#scorecardYear');if(!select)return;const currentYear=new Date().getFullYear();select.innerHTML='';for(let y=currentYear;y>=2024;y--){const o=document.createElement('option');o.value=String(y);o.textContent=String(y);select.appendChild(o)}select.value=String(selectedYear)}
  function updateNav(){
    const currentYear=new Date().getFullYear();
    const next=$('#scorecardNextWeeks');
    const prev=$('#scorecardPreviousWeeks');
    const year=$('#scorecardYear');

    if(next)next.disabled=selectedYear>=currentYear;
    if(prev)prev.disabled=selectedYear<=2024;
    if(year)year.value=String(selectedYear);
  }
  function render(){
    const head=$('#scorecardHead'),body=$('#scorecardRows');if(!head||!body)return;
    const ws=yearWeeks(selectedYear);
    head.innerHTML=`<tr><th class="scoreMetricHead">Metric</th><th>Team</th><th>Category</th><th>Target</th><th>Average</th>${ws.map(w=>`<th class="scoreWeekHead">${esc(w.label)}</th>`).join('')}<th></th></tr>`;
    const data=Array.isArray(window.scorecardMetrics)?window.scorecardMetrics:[];
    body.innerHTML=data.map(m=>{const avg=averageFor(m.id)||Number(m.average_value)||0;return `<tr data-scorecard-id="${esc(m.id)}"><td class="scoreMetricCell"><button class="scoreDrag" type="button" aria-label="Reorder">⋮⋮</button><strong>${esc(m.metric_name)}</strong></td><td>${esc(m.team||'—')}</td><td>${esc(m.category||'—')}</td><td class="scoreTarget">${m.target_value?`≥ ${fmt(m.target_value,m.unit)}`:'—'}</td><td class="scoreAverage ${good(m,avg)?'met':'missed'}">${fmt(avg,m.unit)}</td>${ws.map(w=>{const v=valFor(m.id,w.end);return `<td class="scoreWeekCell ${v==null?'empty':good(m,v)?'met':'missed'}" data-period="${w.end}" title="Click to enter or edit this week">${v==null?'—':fmt(v,m.unit)}<span class="scoreCorner"></span></td>`}).join('')}<td><button class="scoreMore" type="button" aria-label="Edit metric">⋮</button></td></tr>`}).join('')||'<tr><td colspan="14">No scorecard metrics have been added.</td></tr>';
    body.querySelectorAll('.scoreWeekCell').forEach(cell=>cell.addEventListener('click',e=>{e.stopPropagation();editWeek(cell.closest('tr').dataset.scorecardId,cell.dataset.period)}));
    body.querySelectorAll('.scoreMore').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();open(btn.closest('tr').dataset.scorecardId)}));
    syncLatest();updateNav();
  }
  async function editWeek(metricId,period){
    const m=(window.scorecardMetrics||[]).find(x=>String(x.id)===String(metricId));if(!m)return;
    const old=valFor(metricId,period);const answer=prompt(`${m.metric_name}\nWeek ending ${new Date(period+'T12:00:00').toLocaleDateString()}\n\nEnter value:`,old??'');
    if(answer===null)return;const value=Number(String(answer).replace(/[$,%\s,]/g,''));if(!Number.isFinite(value)){message('Enter a valid numeric value.',true);return}
    let row=(window.scorecardHistory||[]).find(x=>String(x.metric_id)===String(metricId)&&x.period_end===period);
    row=row?{...row,value,updated_at:new Date().toISOString()}:{id:crypto.randomUUID(),metric_id:metricId,period_end:period,value,notes:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const client=db();if(client){const {data,error}=await client.from('executive_scorecard_history').upsert(row,{onConflict:'metric_id,period_end'}).select('*');if(error)message(`Saved locally; Supabase history unavailable: ${error.message}`,true);else if(data?.[0])row=data[0]}
    const list=[...(window.scorecardHistory||[])];const i=list.findIndex(x=>String(x.metric_id)===String(metricId)&&x.period_end===period);if(i>=0)list[i]=row;else list.push(row);window.scorecardHistory=list;saveLocal(historyKey,list);syncLatest();render();window.renderExecutiveReport?.();message(`${m.metric_name} updated.`)
  }
  function syncLatest(){(window.scorecardMetrics||[]).forEach(m=>{m.current_value=currentFor(m.id,m.current_value);m.average_value=averageFor(m.id)||m.average_value});saveLocal(metricKey,window.scorecardMetrics||[])}
  function message(text,error=false){const el=$('#scorecardMessage');if(!el)return;el.textContent=text;el.className=`scorecardMessage ${error?'error':'success'}`;setTimeout(()=>{el.textContent='';el.className='scorecardMessage'},3500)}
  function open(id=null){editingId=id;const m=(window.scorecardMetrics||[]).find(x=>String(x.id)===String(id));$('#scorecardDrawerTitle').textContent=m?'Edit Scorecard Metric':'Add Scorecard Metric';$('#scorecardMetricName').value=m?.metric_name||'';$('#scorecardTeam').value=m?.team||'';$('#scorecardCategory').value=m?.category||'';$('#scorecardOwner').value=m?.owner||'';$('#scorecardUnit').value=m?.unit||'number';$('#scorecardTarget').value=m?.target_value??'';$('#scorecardCurrent').value=currentFor(m?.id,m?.current_value??'');$('#scorecardAverage').value=averageFor(m?.id) || (m?.average_value ?? '');$('#scorecardStatus').value=m?.status||'On Target';$('#scorecardNotes').value=m?.notes||'';$('#deleteScorecardMetric').classList.toggle('hidden',!m);$('#scorecardOverlay').classList.remove('hidden')}
  const close=()=>$('#scorecardOverlay').classList.add('hidden');
  async function save(){const name=$('#scorecardMetricName').value.trim();if(!name){message('Metric name is required.',true);return}const existing=(window.scorecardMetrics||[]).find(x=>String(x.id)===String(editingId));const row={id:existing?.id||crypto.randomUUID(),metric_name:name,team:$('#scorecardTeam').value.trim(),category:$('#scorecardCategory').value.trim(),owner:$('#scorecardOwner').value.trim(),unit:$('#scorecardUnit').value,target_value:Number($('#scorecardTarget').value)||0,current_value:Number($('#scorecardCurrent').value)||0,average_value:Number($('#scorecardAverage').value)||0,status:$('#scorecardStatus').value,notes:$('#scorecardNotes').value.trim(),display_order:existing?.display_order||((window.scorecardMetrics||[]).length+1),active:true,updated_at:new Date().toISOString()};const client=db();if(client){const {data,error}=await client.from('executive_scorecard').upsert(row,{onConflict:'id'}).select('*');if(error)message(`Saved locally; Supabase table unavailable: ${error.message}`,true);else if(data?.[0])Object.assign(row,data[0])}const list=[...(window.scorecardMetrics||[])];const i=list.findIndex(x=>String(x.id)===String(row.id));if(i>=0)list[i]=row;else list.push(row);window.scorecardMetrics=list;saveLocal(metricKey,list);close();render();window.renderExecutiveReport?.();message(`${name} saved.`)}
  async function remove(){if(!editingId||!confirm('Delete this scorecard metric?'))return;const client=db();if(client){await client.from('executive_scorecard_history').delete().eq('metric_id',editingId);await client.from('executive_scorecard').delete().eq('id',editingId)}window.scorecardMetrics=(window.scorecardMetrics||[]).filter(x=>String(x.id)!==String(editingId));window.scorecardHistory=(window.scorecardHistory||[]).filter(x=>String(x.metric_id)!==String(editingId));saveLocal(metricKey,window.scorecardMetrics);saveLocal(historyKey,window.scorecardHistory);close();render();window.renderExecutiveReport?.();message('Metric deleted.')}
  function shiftWeeks(direction){
    const currentYear=new Date().getFullYear();
    selectedYear=Math.max(2024,Math.min(currentYear,selectedYear+direction));
    render();
  }

  function selectYear(year){
    selectedYear=Number(year)||new Date().getFullYear();
    render();
  }

  function csvCell(value){
    const text=String(value??'');
    return /[",\r\n]/.test(text)
      ? `"${text.replace(/"/g,'""')}"`
      : text;
  }

  function parseCsv(text){
    const rows=[];
    let row=[];
    let field='';
    let quoted=false;

    for(let i=0;i<text.length;i++){
      const char=text[i];

      if(quoted){
        if(char==='"' && text[i+1]==='"'){
          field+='"';
          i++;
        }else if(char==='"'){
          quoted=false;
        }else{
          field+=char;
        }
      }else if(char==='"'){
        quoted=true;
      }else if(char===','){
        row.push(field);
        field='';
      }else if(char==='\n'){
        row.push(field.replace(/\r$/,''));
        rows.push(row);
        row=[];
        field='';
      }else{
        field+=char;
      }
    }

    if(field.length || row.length){
      row.push(field.replace(/\r$/,''));
      rows.push(row);
    }

    return rows.filter(r=>r.some(v=>String(v).trim()!==''));
  }

  function exportScorecardCsv(){
    const metrics=Array.isArray(window.scorecardMetrics)
      ?window.scorecardMetrics
      :[];

    const history=Array.isArray(window.scorecardHistory)
      ?window.scorecardHistory
      :[];

    const headers=[
      'Metric Name',
      'Team',
      'Category',
      'Owner',
      'Unit',
      'Target Value',
      'Status',
      'Executive Notes',
      'Period End',
      'Value'
    ];

    const rows=[headers];

    metrics.forEach(metric=>{
      const metricRows=history
        .filter(item=>String(item.metric_id)===String(metric.id))
        .sort((a,b)=>String(a.period_end).localeCompare(String(b.period_end)));

      if(!metricRows.length){
        rows.push([
          metric.metric_name||'',
          metric.team||'',
          metric.category||'',
          metric.owner||'',
          metric.unit||'number',
          metric.target_value??'',
          metric.status||'',
          metric.notes||'',
          '',
          ''
        ]);
        return;
      }

      metricRows.forEach(item=>{
        rows.push([
          metric.metric_name||'',
          metric.team||'',
          metric.category||'',
          metric.owner||'',
          metric.unit||'number',
          metric.target_value??'',
          metric.status||'',
          metric.notes||'',
          item.period_end||'',
          item.value??''
        ]);
      });
    });

    const csv=rows
      .map(row=>row.map(csvCell).join(','))
      .join('\r\n');

    const blob=new Blob(
      ['\ufeff',csv],
      {type:'text/csv;charset=utf-8'}
    );

    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download=`atlas-scorecard-${new Date().toISOString().slice(0,10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(link.href);
    message(`Exported ${metrics.length} scorecard metrics.`);
  }

  function normalizeHeader(value){
    return String(value||'')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_|_$/g,'');
  }

  function numericValue(value){
    const cleaned=String(value??'')
      .replace(/[$,%\s,]/g,'');

    if(cleaned==='')return null;

    const number=Number(cleaned);
    return Number.isFinite(number)?number:null;
  }

  async function importScorecardCsv(file){
    if(!file)return;

    const text=await file.text();
    const parsed=parseCsv(text);

    if(parsed.length<2){
      message('The CSV does not contain any scorecard rows.',true);
      return;
    }

    const headers=parsed[0].map(normalizeHeader);

    const required=['metric_name'];
    const missing=required.filter(name=>!headers.includes(name));

    if(missing.length){
      message(
        `CSV is missing required column: ${missing.join(', ')}`,
        true
      );
      return;
    }

    const records=parsed.slice(1).map(row=>{
      const record={};

      headers.forEach((header,index)=>{
        record[header]=row[index]??'';
      });

      return record;
    }).filter(row=>String(row.metric_name||'').trim());

    if(!records.length){
      message('No valid scorecard metrics were found.',true);
      return;
    }

    const metrics=[...(window.scorecardMetrics||[])];
    const history=[...(window.scorecardHistory||[])];
    const client=db();

    let importedMetrics=0;
    let importedHistory=0;
    let skippedRows=0;

    const groups=new Map();

    records.forEach(record=>{
      const name=String(record.metric_name).trim();
      const key=name.toLowerCase();

      if(!groups.has(key)){
        groups.set(key,[]);
      }

      groups.get(key).push(record);
    });

    for(const group of groups.values()){
      const first=group[0];
      const metricName=String(first.metric_name).trim();

      let metric=metrics.find(item=>
        String(item.metric_name||'').trim().toLowerCase()
        ===metricName.toLowerCase()
      );

      const target=numericValue(first.target_value);

      const metricRow={
        id:metric?.id||crypto.randomUUID(),
        metric_name:metricName,
        team:String(first.team||metric?.team||'').trim(),
        category:String(first.category||metric?.category||'').trim(),
        owner:String(first.owner||metric?.owner||'').trim(),
        unit:['currency','number','percent'].includes(
          String(first.unit||'').trim().toLowerCase()
        )
          ?String(first.unit).trim().toLowerCase()
          :(metric?.unit||'number'),
        target_value:target ?? (Number(metric?.target_value) || 0),
        current_value:Number(metric?.current_value)||0,
        average_value:Number(metric?.average_value)||0,
        status:String(first.status||metric?.status||'On Target').trim(),
        notes:String(
          first.executive_notes
          ??first.notes
          ??metric?.notes
          ??''
        ).trim(),
        display_order:metric?.display_order||(metrics.length+1),
        active:true,
        updated_at:new Date().toISOString()
      };

      if(client){
        const {data,error}=await client
          .from('executive_scorecard')
          .upsert(metricRow,{onConflict:'id'})
          .select('*');

        if(error){
          console.warn(
            `Scorecard metric database import failed for ${metricName}:`,
            error
          );
        }else if(data?.[0]){
          Object.assign(metricRow,data[0]);
        }
      }

      const metricIndex=metrics.findIndex(item=>
        String(item.id)===String(metricRow.id)
      );

      if(metricIndex>=0){
        metrics[metricIndex]=metricRow;
      }else{
        metrics.push(metricRow);
      }

      importedMetrics++;

      for(const record of group){
        const period=String(
          record.period_end
          ??record.period_date
          ??record.week_ending
          ??''
        ).trim();

        const value=numericValue(record.value);

        if(!period && value===null){
          continue;
        }

        if(!/^\d{4}-\d{2}-\d{2}$/.test(period) || value===null){
          skippedRows++;
          continue;
        }

        let historyRow=history.find(item=>
          String(item.metric_id)===String(metricRow.id)
          &&String(item.period_end)===period
        );

        historyRow=historyRow
          ?{
              ...historyRow,
              value,
              updated_at:new Date().toISOString()
            }
          :{
              id:crypto.randomUUID(),
              metric_id:metricRow.id,
              period_end:period,
              value,
              notes:'',
              created_at:new Date().toISOString(),
              updated_at:new Date().toISOString()
            };

        if(client){
          const {data,error}=await client
            .from('executive_scorecard_history')
            .upsert(
              historyRow,
              {onConflict:'metric_id,period_end'}
            )
            .select('*');

          if(error){
            console.warn(
              `Scorecard history database import failed for ${metricName} ${period}:`,
              error
            );
          }else if(data?.[0]){
            historyRow=data[0];
          }
        }

        const historyIndex=history.findIndex(item=>
          String(item.metric_id)===String(metricRow.id)
          &&String(item.period_end)===period
        );

        if(historyIndex>=0){
          history[historyIndex]=historyRow;
        }else{
          history.push(historyRow);
        }

        importedHistory++;
      }
    }

    window.scorecardMetrics=metrics;
    window.scorecardHistory=history;
    window.dispatchEvent(
      new CustomEvent('atlas:scorecard-updated')
    );

    saveLocal(metricKey,metrics);
    saveLocal(historyKey,history);

    syncLatest();
    render();
    window.renderExecutiveReport?.();

    message(
      `Imported ${importedMetrics} metrics and ${importedHistory} weekly values`
      +(skippedRows?`; skipped ${skippedRows} invalid rows.`:'.')
    );
  }

  document.addEventListener('DOMContentLoaded',async()=>{anchorDate=endOfWeek();selectedYear=new Date().getFullYear();populateYears();
    $('#importScorecardCsv')?.addEventListener('click',()=>$('#scorecardCsvFile')?.click());
    $('#exportScorecardCsv')?.addEventListener('click',exportScorecardCsv);
    $('#scorecardCsvFile')?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      event.target.value='';
      if(file)await importScorecardCsv(file);
    });
    $('#addScorecardMetric')?.addEventListener('click',()=>open());$('#saveScorecardMetric')?.addEventListener('click',save);$('#deleteScorecardMetric')?.addEventListener('click',remove);$('#scorecardPreviousWeeks')?.addEventListener('click',()=>shiftWeeks(-1));$('#scorecardNextWeeks')?.addEventListener('click',()=>shiftWeeks(1));$('#scorecardCurrentWeeks')?.addEventListener('click',()=>{selectedYear=new Date().getFullYear();render()});$('#scorecardYear')?.addEventListener('change',e=>selectYear(e.target.value));await load();render();window.renderExecutiveReport?.()});
  window.renderScorecard=render;window.reloadScorecard=async()=>{await load();render();window.renderExecutiveReport?.()};
})();
