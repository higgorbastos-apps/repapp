'use strict';

/* ============================================================
   CONFIG
   ============================================================ */
const CFG_KEY = 'repertorio_cfg_v1';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || { url: '', token: '' }; }
  catch { return { url: '', token: '' }; }
}
function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
function isConfigured() { const c = getConfig(); return !!(c.url && c.token); }

/* ============================================================
   PARSER
   ============================================================ */
function parseLista(texto) {
  if (!texto) return [];
  return texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.replace(/^\s*(\d+\s*[.\)\-–:]?|[-*•▪︎])\s*/, '').trim())
    .filter(l => l.length > 0);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDataBR(isoDate) {
  const [y, m, d] = (isoDate || '').split('-');
  return (d && m && y) ? `${d}/${m}/${y}` : isoDate || '';
}

function formatAnyDate(v) {
  const s = String(v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

/* ============================================================
   STATE
   ============================================================ */
// parsedSongs is the live working copy — edits in preview update it too
let parsedSongs = [];

/* ============================================================
   TABS
   ============================================================ */
const tabs = document.querySelectorAll('.tab');
const panels = {
  registrar: document.getElementById('tab-registrar'),
  buscar:    document.getElementById('tab-buscar'),
  historico: document.getElementById('tab-historico'),
};
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    Object.values(panels).forEach(p => { p.hidden = true; p.classList.remove('active'); });
    const target = panels[btn.dataset.tab];
    target.hidden = false;
    target.classList.add('active');
    if (btn.dataset.tab === 'historico') loadHistorico();
  });
});

/* ============================================================
   REGISTRAR — elements
   ============================================================ */
const inputLocal      = document.getElementById('inputLocal');
const inputData       = document.getElementById('inputData');
const inputLista      = document.getElementById('inputLista');
const parseCount      = document.getElementById('parseCount');
const previewCard     = document.getElementById('previewCard');
const setlistPreview  = document.getElementById('setlistPreview');
const btnSalvar       = document.getElementById('btnSalvar');
const btnPdf          = document.getElementById('btnPdf');
const btnImprimir     = document.getElementById('btnImprimir');
const btnLimpar       = document.getElementById('btnLimpar');
const statusMsg       = document.getElementById('statusMsg');

inputData.valueAsDate = new Date();

/* ---- preview rendering with per-song edit/delete ---- */
function renderPreview() {
  setlistPreview.innerHTML = parsedSongs.map((s, i) => `
    <li data-index="${i}">
      <span class="song-text">${escapeHtml(s)}</span>
      <div class="song-actions" role="group" aria-label="Ações para ${escapeHtml(s)}">
        <button class="song-btn edit" data-action="edit" data-index="${i}" title="Editar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="song-btn del" data-action="delete" data-index="${i}" title="Remover">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </li>
  `).join('');
}

function updatePreview() {
  parsedSongs = parseLista(inputLista.value);
  const n = parsedSongs.length;
  parseCount.textContent = n === 1 ? '1 música detectada' : `${n} músicas detectadas`;
  parseCount.classList.toggle('ready', n > 0);

  if (n > 0) {
    previewCard.hidden = false;
    renderPreview();
  } else {
    previewCard.hidden = true;
    setlistPreview.innerHTML = '';
  }

  const hasMeta = inputLocal.value.trim().length > 0 && !!inputData.value;
  const enabled = n > 0 && hasMeta;
  btnSalvar.disabled  = !enabled;
  btnPdf.disabled     = !enabled;
  btnImprimir.disabled = !enabled;
}

inputLista.addEventListener('input', updatePreview);
inputLocal.addEventListener('input', updatePreview);
inputData.addEventListener('input', updatePreview);

/* ---- inline edit / delete songs in preview ---- */
setlistPreview.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.index, 10);
  const action = btn.dataset.action;
  const li = setlistPreview.querySelector(`li[data-index="${idx}"]`);

  if (action === 'delete') {
    parsedSongs.splice(idx, 1);
    rebuildTextareaFromSongs();
    updatePreview();
    return;
  }

  if (action === 'edit') {
    startInlineEdit(li, idx);
    return;
  }

  if (action === 'save-edit') {
    const inp = li.querySelector('input');
    const newVal = (inp ? inp.value : '').trim();
    if (newVal) {
      parsedSongs[idx] = newVal;
      rebuildTextareaFromSongs();
    }
    renderPreview();
    return;
  }

  if (action === 'cancel-edit') {
    renderPreview();
    return;
  }
});

function startInlineEdit(li, idx) {
  const currentText = parsedSongs[idx];
  li.classList.add('editing');
  li.innerHTML = `
    <input type="text" value="${escapeHtml(currentText)}" aria-label="Editar música">
    <div class="song-actions">
      <button class="song-btn ok" data-action="save-edit" data-index="${idx}" title="Salvar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="song-btn" data-action="cancel-edit" data-index="${idx}" title="Cancelar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
  const inp = li.querySelector('input');
  inp.focus();
  inp.select();
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') li.querySelector('[data-action=save-edit]').click();
    if (ev.key === 'Escape') li.querySelector('[data-action=cancel-edit]').click();
  });
}

function rebuildTextareaFromSongs() {
  inputLista.value = parsedSongs.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

/* ---- LIMPAR (clear all) ---- */
btnLimpar.addEventListener('click', () => {
  if (parsedSongs.length > 0 && !confirm('Limpar o formulário inteiro?')) return;
  inputLocal.value = '';
  inputData.valueAsDate = new Date();
  inputLista.value = '';
  parsedSongs = [];
  setStatus('', '');
  updatePreview();
});

function setStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg' + (type ? ' ' + type : '');
}

/* ============================================================
   SALVAR
   ============================================================ */
btnSalvar.addEventListener('click', async () => {
  if (!isConfigured()) { setStatus('Configure a URL e o token primeiro (⚙).', 'err'); openConfigModal(); return; }
  const cfg = getConfig();
  const payload = { token: cfg.token, local: inputLocal.value.trim(), data: inputData.value, musicas: parsedSongs };

  btnSalvar.disabled = true;
  setStatus('Salvando na planilha…', 'busy');

  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setStatus(`✓ ${json.salvos} músicas salvas no banco de repertório.`, 'ok');
    } else {
      setStatus(`Erro: ${json.error || 'falha desconhecida'}`, 'err');
    }
  } catch {
    setStatus('Não foi possível conectar à planilha. Verifique internet e URL configurada.', 'err');
  } finally {
    btnSalvar.disabled = false;
  }
});

/* ============================================================
   PDF
   ============================================================ */
btnPdf.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const local = inputLocal.value.trim();
  const dataBR = formatDataBR(inputData.value);
  const margin = 48; let y = margin;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
  doc.text('Repertório', margin, y); y += 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(90);
  doc.text(`${local}  •  ${dataBR}`, margin, y); y += 28;
  doc.setDrawColor(220); doc.line(margin, y, 595 - margin, y); y += 24;
  doc.setTextColor(20);

  parsedSongs.forEach((song, i) => {
    if (y > 780) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(180, 120, 0);
    doc.text(String(i + 1) + '.', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
    doc.text(song, margin + 28, y); y += 26;
  });

  const safe = (local || 'setlist').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  doc.save(`repertorio-${safe || 'setlist'}-${inputData.value}.pdf`);
});

/* ============================================================
   IMPRIMIR
   ============================================================ */
btnImprimir.addEventListener('click', () => {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = `
    <h1>Repertório</h1>
    <div class="print-meta">${escapeHtml(inputLocal.value.trim())} • ${formatDataBR(inputData.value)}</div>
    <ol>${parsedSongs.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
  `;
  window.print();
});

/* ============================================================
   BUSCAR
   ============================================================ */
const inputBusca       = document.getElementById('inputBusca');
const btnBuscar        = document.getElementById('btnBuscar');
const btnLimparBusca   = document.getElementById('btnLimparBusca');
const buscaResultados  = document.getElementById('buscaResultados');

inputBusca.addEventListener('input', () => {
  btnLimparBusca.hidden = inputBusca.value.length === 0;
});
btnLimparBusca.addEventListener('click', () => {
  inputBusca.value = '';
  btnLimparBusca.hidden = true;
  buscaResultados.innerHTML = '';
  inputBusca.focus();
});

async function buscarMusica() {
  const termo = inputBusca.value.trim();
  if (!termo) return;
  if (!isConfigured()) { openConfigModal(); return; }

  buscaResultados.innerHTML = `<p class="empty-state">Buscando…</p>`;
  const cfg = getConfig();
  const url = `${cfg.url}?action=buscar&musica=${encodeURIComponent(termo)}&token=${encodeURIComponent(cfg.token)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) { buscaResultados.innerHTML = `<p class="empty-state">Erro: ${escapeHtml(json.error || 'falha')}</p>`; return; }
    if (json.resultados.length === 0) {
      buscaResultados.innerHTML = `<p class="empty-state">Nenhuma ocorrência de "${escapeHtml(termo)}" ainda.</p>`;
      return;
    }
    buscaResultados.innerHTML = json.resultados.map(r => `
      <div class="result-item">
        <div class="result-item-header">
          <div class="result-meta">
            <div class="r-top">
              <span>${escapeHtml(r.local)}</span>
              <span>${formatAnyDate(r.data)}</span>
            </div>
            <div class="r-song"><span class="r-order">#${r.ordem}</span>${escapeHtml(r.musica)}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    buscaResultados.innerHTML = `<p class="empty-state">Não foi possível conectar à planilha.</p>`;
  }
}
btnBuscar.addEventListener('click', buscarMusica);
inputBusca.addEventListener('keydown', e => { if (e.key === 'Enter') buscarMusica(); });

/* ============================================================
   HISTÓRICO — shows list with expandable setlist detail
   ============================================================ */
const historicoLista = document.getElementById('historicoLista');

async function loadHistorico() {
  if (!isConfigured()) {
    historicoLista.innerHTML = `<p class="empty-state">Configure a conexão (⚙) para ver o histórico.</p>`;
    return;
  }
  historicoLista.innerHTML = `<p class="empty-state">Carregando…</p>`;
  const cfg = getConfig();
  const url = `${cfg.url}?action=shows&token=${encodeURIComponent(cfg.token)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) { historicoLista.innerHTML = `<p class="empty-state">Erro: ${escapeHtml(json.error || 'falha')}</p>`; return; }
    if (json.shows.length === 0) { historicoLista.innerHTML = `<p class="empty-state">Nenhum show registrado ainda.</p>`; return; }

    historicoLista.innerHTML = json.shows.map((s, i) => `
      <div class="result-item" data-show-index="${i}" data-show-local="${escapeHtml(s.local)}" data-show-data="${escapeHtml(s.data)}">
        <div class="result-item-header">
          <div class="result-meta">
            <div class="r-top">
              <span>${formatAnyDate(s.data)}</span>
              <span class="r-qtd">${s.qtd} música${s.qtd === 1 ? '' : 's'}</span>
            </div>
            <div class="r-song">${escapeHtml(s.local)}</div>
          </div>
          <svg class="expand-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="show-detail">
          <div class="show-detail-loading">Toque para ver o setlist</div>
        </div>
      </div>
    `).join('');

    // attach click handlers
    historicoLista.querySelectorAll('.result-item').forEach(item => {
      item.querySelector('.result-item-header').addEventListener('click', () => toggleShowDetail(item));
    });

  } catch {
    historicoLista.innerHTML = `<p class="empty-state">Não foi possível conectar à planilha.</p>`;
  }
}

async function toggleShowDetail(item) {
  const isOpen = item.classList.contains('open');

  // close all others first
  historicoLista.querySelectorAll('.result-item.open').forEach(el => el.classList.remove('open'));

  if (isOpen) return; // was open → just close

  item.classList.add('open');
  const detail = item.querySelector('.show-detail');
  const loading = item.querySelector('.show-detail-loading');

  // if already loaded, just open
  if (item.dataset.loaded === 'true') return;

  loading.textContent = 'Carregando…';

  const local = item.dataset.showLocal;
  const data  = item.dataset.showData;

  if (!isConfigured()) { loading.textContent = 'Configure a conexão primeiro (⚙).'; return; }

  const cfg = getConfig();
  const url = `${cfg.url}?action=setlist&local=${encodeURIComponent(local)}&data=${encodeURIComponent(data)}&token=${encodeURIComponent(cfg.token)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success || !json.musicas) { loading.textContent = `Erro: ${json.error || 'falha'}`; return; }

    item.dataset.loaded = 'true';
    detail.innerHTML = `
      <ol class="show-songs">
        ${json.musicas.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
      </ol>
      <div class="show-detail-actions">
        <button class="btn btn-secondary" onclick="reuseSetlist('${escapeHtml(local)}','${data}',${JSON.stringify(json.musicas).replace(/'/g, "\\'")})">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          Reutilizar na aba Registrar
        </button>
        <button class="btn btn-secondary" onclick="exportShowPdf('${escapeHtml(local)}','${data}',${JSON.stringify(json.musicas).replace(/'/g, "\\'")})">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          PDF
        </button>
      </div>
    `;
  } catch {
    loading.textContent = 'Não foi possível carregar o setlist.';
  }
}

// exposed globally for inline onclick handlers
window.reuseSetlist = function(local, data, songs) {
  inputLocal.value = local;
  inputData.value = data;
  inputLista.value = songs.map((s, i) => `${i + 1}. ${s}`).join('\n');
  parsedSongs = songs.slice();
  updatePreview();
  setStatus('Setlist carregado do histórico — edite se precisar e salve novamente.', 'ok');
  tabs[0].click(); // switch to Registrar
};

window.exportShowPdf = function(local, data, songs) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48; let y = margin;
  const dataBR = formatAnyDate(data);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
  doc.text('Repertório', margin, y); y += 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(90);
  doc.text(`${local}  •  ${dataBR}`, margin, y); y += 28;
  doc.setDrawColor(220); doc.line(margin, y, 595 - margin, y); y += 24;
  doc.setTextColor(20);

  songs.forEach((song, i) => {
    if (y > 780) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(180, 120, 0);
    doc.text(String(i + 1) + '.', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
    doc.text(song, margin + 28, y); y += 26;
  });

  const safe = local.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  doc.save(`repertorio-${safe || 'show'}-${data}.pdf`);
};

document.getElementById('btnRefreshHistorico').addEventListener('click', () => {
  historicoLista.innerHTML = '';
  loadHistorico();
});

/* ============================================================
   CONFIG MODAL
   ============================================================ */
const modalConfig  = document.getElementById('modalConfig');
const cfgUrl       = document.getElementById('cfgUrl');
const cfgToken     = document.getElementById('cfgToken');
const cfgStatusMsg = document.getElementById('cfgStatusMsg');

function openConfigModal() {
  const cfg = getConfig();
  cfgUrl.value = cfg.url || '';
  cfgToken.value = cfg.token || '';
  cfgStatusMsg.textContent = '';
  modalConfig.hidden = false;
}
function closeConfigModal() { modalConfig.hidden = true; }

document.getElementById('btnConfig').addEventListener('click', openConfigModal);
document.getElementById('btnCfgFechar').addEventListener('click', closeConfigModal);
modalConfig.addEventListener('click', e => { if (e.target === modalConfig) closeConfigModal(); });

document.getElementById('btnCfgSalvar').addEventListener('click', () => {
  const url = cfgUrl.value.trim(), token = cfgToken.value.trim();
  if (!url || !token) { cfgStatusMsg.textContent = 'Preencha a URL e o token.'; cfgStatusMsg.className = 'status-msg err'; return; }
  setConfig({ url, token });
  cfgStatusMsg.textContent = '✓ Conexão salva neste dispositivo.';
  cfgStatusMsg.className = 'status-msg ok';
  updatePreview();
  setTimeout(closeConfigModal, 900);
});

/* ============================================================
   SERVICE WORKER
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

/* first-run nudge */
if (!isConfigured()) {
  setTimeout(() => setStatus('Configure a conexão com sua planilha (ícone ⚙) antes de salvar.', ''), 300);
}

updatePreview();
