'use strict';

/* ============================================================
   CONFIG — Apps Script URL + token live only in this browser's
   localStorage, never in the published source code.
   ============================================================ */
const CFG_KEY = 'repertorio_cfg_v1';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || { url: '', token: '' };
  } catch {
    return { url: '', token: '' };
  }
}
function setConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}
function isConfigured() {
  const cfg = getConfig();
  return !!(cfg.url && cfg.token);
}

/* ============================================================
   PARSER — turns a pasted enumerated/bulleted list into a
   clean array of song names.
   Accepts: "1. Song"  "1) Song"  "1 - Song"  "01. Song"
            "- Song"   "* Song"   "• Song"    "Song" (plain line)
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

/* ============================================================
   STATE
   ============================================================ */
let parsedSongs = [];

/* ============================================================
   TABS
   ============================================================ */
const tabs = document.querySelectorAll('.tab');
const panels = {
  registrar: document.getElementById('tab-registrar'),
  buscar: document.getElementById('tab-buscar'),
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
   REGISTRAR — form elements
   ============================================================ */
const inputLocal = document.getElementById('inputLocal');
const inputData = document.getElementById('inputData');
const inputLista = document.getElementById('inputLista');
const parseCount = document.getElementById('parseCount');
const previewCard = document.getElementById('previewCard');
const setlistPreview = document.getElementById('setlistPreview');
const btnSalvar = document.getElementById('btnSalvar');
const btnPdf = document.getElementById('btnPdf');
const btnImprimir = document.getElementById('btnImprimir');
const statusMsg = document.getElementById('statusMsg');

// default date = today
inputData.valueAsDate = new Date();

function updatePreview() {
  parsedSongs = parseLista(inputLista.value);
  const n = parsedSongs.length;
  parseCount.textContent = n === 1 ? '1 música detectada' : `${n} músicas detectadas`;
  parseCount.classList.toggle('ready', n > 0);

  if (n > 0) {
    previewCard.hidden = false;
    setlistPreview.innerHTML = parsedSongs.map(s => `<li>${escapeHtml(s)}</li>`).join('');
  } else {
    previewCard.hidden = true;
    setlistPreview.innerHTML = '';
  }

  const hasMeta = inputLocal.value.trim().length > 0 && !!inputData.value;
  btnSalvar.disabled = !(n > 0 && hasMeta);
  btnPdf.disabled = !(n > 0 && hasMeta);
  btnImprimir.disabled = !(n > 0 && hasMeta);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

inputLista.addEventListener('input', updatePreview);
inputLocal.addEventListener('input', updatePreview);
inputData.addEventListener('input', updatePreview);

function setStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg' + (type ? ' ' + type : '');
}

function formatDataBR(isoDate) {
  // isoDate: "YYYY-MM-DD" -> "DD/MM/YYYY"
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/* ============================================================
   SALVAR — POST to the Apps Script Web App.
   Sent as text/plain to avoid a CORS preflight that Apps Script
   web apps can't answer (a well-known platform limitation).
   ============================================================ */
btnSalvar.addEventListener('click', async () => {
  if (!isConfigured()) {
    setStatus('Configure a URL e o token primeiro (ícone de engrenagem).', 'err');
    openConfigModal();
    return;
  }
  const cfg = getConfig();
  const payload = {
    token: cfg.token,
    local: inputLocal.value.trim(),
    data: inputData.value,
    musicas: parsedSongs,
  };

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
  } catch (err) {
    setStatus('Não foi possível conectar à planilha. Verifique sua internet e a URL configurada.', 'err');
  } finally {
    btnSalvar.disabled = false;
  }
});

/* ============================================================
   PDF — built client-side with jsPDF, independent of the save
   step, so it still works without a connection on show day.
   ============================================================ */
btnPdf.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const local = inputLocal.value.trim();
  const dataBR = formatDataBR(inputData.value);
  const margin = 48;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Repertório', margin, y);
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(90);
  doc.text(`${local}  •  ${dataBR}`, margin, y);
  y += 28;

  doc.setDrawColor(220);
  doc.line(margin, y, 595 - margin, y);
  y += 24;

  doc.setTextColor(20);
  parsedSongs.forEach((song, i) => {
    if (y > 780) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(180, 120, 0);
    doc.text(String(i + 1) + '.', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    doc.text(song, margin + 28, y);
    y += 26;
  });

  const filenameSafe = (local || 'setlist').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  doc.save(`repertorio-${filenameSafe || 'setlist'}-${inputData.value}.pdf`);
});

/* ============================================================
   IMPRIMIR — fills the hidden print-only area and opens the
   browser print dialog (which on most devices can also save
   straight to PDF).
   ============================================================ */
btnImprimir.addEventListener('click', () => {
  const local = inputLocal.value.trim();
  const dataBR = formatDataBR(inputData.value);
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = `
    <h1>Repertório</h1>
    <div class="print-meta">${escapeHtml(local)} • ${dataBR}</div>
    <ol>${parsedSongs.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
  `;
  window.print();
});

/* ============================================================
   BUSCAR — query the Apps Script doGet search endpoint
   ============================================================ */
const inputBusca = document.getElementById('inputBusca');
const btnBuscar = document.getElementById('btnBuscar');
const buscaResultados = document.getElementById('buscaResultados');

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
    if (!json.success) {
      buscaResultados.innerHTML = `<p class="empty-state">Erro: ${escapeHtml(json.error || 'falha')}</p>`;
      return;
    }
    if (json.resultados.length === 0) {
      buscaResultados.innerHTML = `<p class="empty-state">Nenhuma ocorrência de "${escapeHtml(termo)}" no histórico ainda.</p>`;
      return;
    }
    buscaResultados.innerHTML = json.resultados.map(r => `
      <div class="result-item">
        <div class="r-top">
          <span>${escapeHtml(r.local)}</span>
          <span>${formatAnyDate(r.data)}</span>
        </div>
        <div class="r-song"><span class="r-order">#${r.ordem}</span> ${escapeHtml(r.musica)}</div>
      </div>
    `).join('');
  } catch {
    buscaResultados.innerHTML = `<p class="empty-state">Não foi possível conectar à planilha.</p>`;
  }
}
btnBuscar.addEventListener('click', buscarMusica);
inputBusca.addEventListener('keydown', e => { if (e.key === 'Enter') buscarMusica(); });

/* ============================================================
   HISTÓRICO — list of shows already registered
   ============================================================ */
const historicoLista = document.getElementById('historicoLista');
const btnRefreshHistorico = document.getElementById('btnRefreshHistorico');

async function loadHistorico() {
  if (!isConfigured()) {
    historicoLista.innerHTML = `<p class="empty-state">Configure a conexão (ícone de engrenagem) para ver o histórico.</p>`;
    return;
  }
  historicoLista.innerHTML = `<p class="empty-state">Carregando…</p>`;
  const cfg = getConfig();
  const url = `${cfg.url}?action=shows&token=${encodeURIComponent(cfg.token)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) {
      historicoLista.innerHTML = `<p class="empty-state">Erro: ${escapeHtml(json.error || 'falha')}</p>`;
      return;
    }
    if (json.shows.length === 0) {
      historicoLista.innerHTML = `<p class="empty-state">Nenhum show registrado ainda.</p>`;
      return;
    }
    historicoLista.innerHTML = json.shows.map(s => `
      <div class="result-item">
        <div class="r-top">
          <span>${formatAnyDate(s.data)}</span>
          <span>${s.qtd} música${s.qtd === 1 ? '' : 's'}</span>
        </div>
        <div class="r-song">${escapeHtml(s.local)}</div>
      </div>
    `).join('');
  } catch {
    historicoLista.innerHTML = `<p class="empty-state">Não foi possível conectar à planilha.</p>`;
  }
}
btnRefreshHistorico.addEventListener('click', loadHistorico);

function formatAnyDate(v) {
  // Apps Script may return an ISO string or a Date-like value
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

/* ============================================================
   CONFIG MODAL
   ============================================================ */
const modalConfig = document.getElementById('modalConfig');
const cfgUrl = document.getElementById('cfgUrl');
const cfgToken = document.getElementById('cfgToken');
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
  const url = cfgUrl.value.trim();
  const token = cfgToken.value.trim();
  if (!url || !token) {
    cfgStatusMsg.textContent = 'Preencha a URL e o token.';
    cfgStatusMsg.className = 'status-msg err';
    return;
  }
  setConfig({ url, token });
  cfgStatusMsg.textContent = '✓ Conexão salva neste dispositivo.';
  cfgStatusMsg.className = 'status-msg ok';
  updatePreview();
  setTimeout(closeConfigModal, 900);
});

// first run: nudge the musician to configure the connection
if (!isConfigured()) {
  setTimeout(() => {
    setStatus('Antes de salvar, configure a conexão com sua planilha (ícone de engrenagem).', '');
  }, 300);
}

/* ============================================================
   PWA — service worker registration
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

updatePreview();
