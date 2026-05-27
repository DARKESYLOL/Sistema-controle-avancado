/* ══════════════════════════════════════════════
   SACPL – script.js  (JavaScript puro)
   ══════════════════════════════════════════════ */

'use strict';

/* ══════ CONSTANTS / CONFIG ══════ */
const APP = {
  user: 'Usuário Portaria',
  version: '3.7.2',
  currentPage: 'dashboard',
  selectedRelType: null
};

/* ══════ LOCAL STORAGE KEYS ══════ */
const KEYS = {
  checkins:        'sacpl_checkins',
  agendamentos:    'sacpl_agendamentos',
  caminhoes:       'sacpl_caminhoes',
  motoristas:      'sacpl_motoristas',
  transportadoras: 'sacpl_transportadoras',
  ocorrencias:     'sacpl_ocorrencias',
  analise:         'sacpl_analise',
  auditoria:       'sacpl_auditoria',
  config:          'sacpl_config'
};

/* ══════════════════════════════════════════════
   STORAGE HELPERS
══════════════════════════════════════════════ */
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function loadObj(key, def = {}) {
  try { return JSON.parse(localStorage.getItem(key)) || def; }
  catch { return def; }
}

/* ══════════════════════════════════════════════
   AUDIT LOG
══════════════════════════════════════════════ */
function registrarAuditoria(acao, tela, registro = '', ant = '', novo = '') {
  const cfg = loadObj(KEYS.config);
  if (cfg.audit === false) return;
  const logs = load(KEYS.auditoria);
  const now = new Date();
  logs.unshift({
    id: gerarId(),
    dt: formatDT(now),
    usuario: APP.user,
    acao,
    tela,
    registro,
    ant,
    novo
  });
  // Keep max 300 entries
  save(KEYS.auditoria, logs.slice(0, 300));
}

/* ══════════════════════════════════════════════
   PROTOCOL / ID GENERATOR
══════════════════════════════════════════════ */
function gerarId() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}
function gerarProtocoloStr() {
  const now = new Date();
  const ym = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
  const ci = load(KEYS.checkins);
  const seq = String(ci.length + 1).padStart(5, '0');
  return `CIN-${ym}${seq}`;
}

/* ══════════════════════════════════════════════
   DATE / TIME HELPERS
══════════════════════════════════════════════ */
function formatDT(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toLocaleString('pt-BR');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function timeStr() {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}
function calcPermanencia(dtEntrada, hrEntrada, dtSaida, hrSaida) {
  if (!dtEntrada || !hrEntrada || !dtSaida || !hrSaida) return '—';
  const entrada = new Date(`${dtEntrada}T${hrEntrada}`);
  const saida   = new Date(`${dtSaida}T${hrSaida}`);
  const diff    = Math.max(0, saida - entrada);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}min`;
}

/* ══════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════ */
function showToast(msg, type = 'info', dur = 3800) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const cont = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa ${icons[type] || icons.info}"></i><span class="toast-msg">${msg}</span><button class="toast-dismiss" onclick="this.parentElement.remove()"><i class="fa fa-x"></i></button>`;
  cont.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(80px)'; toast.style.transition = '.3s'; setTimeout(() => toast.remove(), 310); }, dur);
}

/* ══════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════ */
function openModal(title, html) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
  const ni = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (ni) ni.classList.add('active');
  APP.currentPage = page;
  // Lazy render
  const renders = {
    dashboard:       refreshDashboard,
    checkin:         renderCheckinTable,
    entradas:        renderEntradasTable,
    saidas:          renderSaidasTable,
    agendamentos:    renderAgendamentosTable,
    caminhoes:       renderCaminhoesTable,
    motoristas:      renderMotoristasTable,
    transportadoras: renderTransportadorasTable,
    ocorrencias:     renderOcorrenciasTable,
    analise:         renderAnaliseTable,
    auditoria:       renderAuditoriaTable
  };
  if (renders[page]) renders[page]();
}

/* ══════════════════════════════════════════════
   STATUS BADGE HELPER
══════════════════════════════════════════════ */
function badgeStatus(status) {
  const map = {
    'Dentro da empresa':    'badge badge-blue',
    'Check-out realizado':  'badge badge-green',
    'Agendado':             'badge badge-yellow',
    'Cancelado':            'badge badge-red',
    'Liberado':             'badge badge-green',
    'Pendente':             'badge badge-yellow',
    'Bloqueado':            'badge badge-red',
    'Ativa':                'badge badge-green',
    'Suspensa':             'badge badge-yellow',
    'Aberta':               'badge badge-red',
    'Em análise':           'badge badge-orange',
    'Resolvida':            'badge badge-green',
    'Baixa':                'badge badge-teal',
    'Média':                'badge badge-yellow',
    'Alta':                 'badge badge-orange',
    'Crítica':              'badge badge-red',
    'Normal':               'badge badge-gray',
    'Alta':                 'badge badge-orange',
    'Urgente':              'badge badge-red',
    'Ativo':                'badge badge-green',
    'Inativo':              'badge badge-gray',
    'Manutenção':           'badge badge-yellow',
    'Em análise':           'badge badge-blue',
    'Encaminhado ao RH':    'badge badge-yellow',
    'Encaminhado ao jurídico': 'badge badge-orange',
    'Demissão aplicada':    'badge badge-red',
    'Resolvido':            'badge badge-green',
  };
  const cls = map[status] || 'badge badge-gray';
  return `<span class="${cls}">${status || '—'}</span>`;
}

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
function refreshDashboard() {
  const ci = load(KEYS.checkins);
  const ag = load(KEYS.agendamentos);
  const oc = load(KEYS.ocorrencias);
  const mo = load(KEYS.motoristas);
  const tr = load(KEYS.transportadoras);

  const today = todayStr();
  const dentro       = ci.filter(r => r.status === 'Dentro da empresa').length;
  const entradasHoje = ci.filter(r => r.data === today).length;
  const saidasHoje   = ci.filter(r => r.dtSaida === today).length;
  const agPend       = ag.filter(r => r.status === 'Agendado').length;
  const ocAb         = oc.filter(r => r.status === 'Aberta').length;
  const moBloq       = mo.filter(r => r.status === 'Bloqueado').length;
  const trAtiv       = tr.filter(r => r.status === 'Ativa').length;
  const semSaida     = ci.filter(r => r.status === 'Dentro da empresa').length;

  setKpi('kpi-dentro',        dentro);
  setKpi('kpi-entradas',      entradasHoje);
  setKpi('kpi-saidas',        saidasHoje);
  setKpi('kpi-agendamentos',  agPend);
  setKpi('kpi-ocorrencias',   ocAb);
  setKpi('kpi-bloqueados',    moBloq);
  setKpi('kpi-transportadoras', trAtiv);
  setKpi('kpi-semSaida',      semSaida);

  // Badges na sidebar
  setTxt('agBadge', agPend);
  setTxt('ocBadge', ocAb);

  // Alert dot
  const ad = document.getElementById('alertDot');
  if (ad) ad.style.display = (ocAb > 0 || semSaida > 2) ? 'block' : 'none';

  // Table
  const tbody = document.getElementById('dashTbody');
  const recent = ci.slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fa fa-inbox"></i> Nenhum movimento registrado.</td></tr>';
  } else {
    tbody.innerHTML = recent.map(r => `
      <tr>
        <td class="text-mono">${r.protocolo}</td>
        <td>${r.data} ${r.hora}</td>
        <td><strong>${r.placa}</strong></td>
        <td>${r.motorista}</td>
        <td>${r.transportadora}</td>
        <td>${r.setor}</td>
        <td>${badgeStatus(r.status)}</td>
      </tr>`).join('');
  }

  // Alert list
  const alertList = document.getElementById('alertList');
  const alerts = [];
  if (ocAb > 0) alerts.push({ cls: 'danger', msg: `<strong>${ocAb}</strong> ocorrência(s) em aberto.` });
  if (semSaida > 3) alerts.push({ cls: 'warn', msg: `<strong>${semSaida}</strong> veículos sem saída registrada.` });
  if (moBloq > 0) alerts.push({ cls: 'warn', msg: `<strong>${moBloq}</strong> motorista(s) bloqueado(s).` });
  if (agPend > 0) alerts.push({ cls: 'info', msg: `<strong>${agPend}</strong> agendamento(s) pendente(s) hoje.` });
  alerts.push({ cls: 'ok', msg: 'Sistema operacional. Todos os serviços online.' });
  alertList.innerHTML = alerts.map(a => `<div class="alert-item ${a.cls}"><i class="fa ${a.cls==='danger'?'fa-circle-xmark':a.cls==='warn'?'fa-triangle-exclamation':a.cls==='ok'?'fa-circle-check':'fa-circle-info'}"></i>${a.msg}</div>`).join('');

  // Indicators
  const total = ci.length || 1;
  const ocupPct  = Math.min(100, Math.round((dentro / 20) * 100));
  const eficPct  = total > 1 ? Math.round(((total - dentro) / total) * 100) : 0;
  const ocPct    = Math.min(100, Math.round((oc.length / Math.max(1, total)) * 100));
  setBar('barOcup', 'pctOcup', ocupPct);
  setBar('barEfic', 'pctEfic', eficPct);
  setBar('barOc',   'pctOc',   ocPct);

  // Mini chart (last 7 days)
  buildMiniChart(ci);
}

function setKpi(id, val) {
  const el = document.getElementById(id);
  if (el) {
    const old = parseInt(el.textContent) || 0;
    animateCounter(el, old, val, 600);
  }
}
function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setBar(barId, pctId, pct) {
  const b = document.getElementById(barId);
  const p = document.getElementById(pctId);
  if (b) b.style.width = pct + '%';
  if (p) p.textContent = pct + '%';
}
function animateCounter(el, from, to, dur) {
  const start = performance.now();
  function step(ts) {
    const prog = Math.min(1, (ts - start) / dur);
    el.textContent = Math.round(from + (to - from) * prog);
    if (prog < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function buildMiniChart(ci) {
  const cont = document.getElementById('miniChart');
  if (!cont) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const s = d.toISOString().slice(0, 10);
    const count = ci.filter(r => r.data === s).length;
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
    days.push({ count, label });
  }
  const max = Math.max(...days.map(d => d.count), 1);
  const colors = ['#1D4ED8','#2563EB','#3B82F6','#059669','#10B981','#059669','#1D4ED8'];
  cont.innerHTML = days.map((d, i) => {
    const h = Math.round((d.count / max) * 60) + 4;
    return `<div class="chart-bar" style="height:${h}px;background:${colors[i]};border-radius:4px 4px 0 0;margin-bottom:20px" data-label="${d.label}" title="${d.count} entrada(s)"></div>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   CHECK-IN
══════════════════════════════════════════════ */
function gerarProtocolo() {
  const proto = gerarProtocoloStr();
  const el = document.getElementById('protocolValue');
  if (el) el.textContent = proto;
  return proto;
}

function clearCheckin() {
  ['ci-data','ci-hora','ci-transportadora','ci-motorista','ci-cpf','ci-cnh',
   'ci-categCNH','ci-valCNH','ci-placa','ci-placaCarreta','ci-modelo',
   'ci-tipoVeiculo','ci-tipoCarga','ci-peso','ci-setor','ci-responsavel',
   'ci-motivo','ci-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const pv = document.getElementById('protocolValue');
  if (pv) pv.textContent = '—';
}

function salvarCheckin() {
  // Required fields
  const required = {
    'ci-data':           'Data do registro',
    'ci-hora':           'Hora de entrada',
    'ci-transportadora': 'Transportadora',
    'ci-motorista':      'Motorista',
    'ci-cpf':            'CPF do motorista',
    'ci-cnh':            'CNH',
    'ci-categCNH':       'Categoria CNH',
    'ci-valCNH':         'Validade CNH',
    'ci-placa':          'Placa do caminhão',
    'ci-modelo':         'Modelo do caminhão',
    'ci-setor':          'Setor de destino',
    'ci-responsavel':    'Responsável interno',
    'ci-motivo':         'Motivo da entrada',
  };
  for (const [id, label] of Object.entries(required)) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      showToast(`Campo obrigatório: <strong>${label}</strong>`, 'error');
      el && el.focus();
      return;
    }
  }

  // CNH validade check
  const cfg = loadObj(KEYS.config);
  const valCNH = document.getElementById('ci-valCNH').value;
  if (cfg.exigirCNH !== false && valCNH < todayStr()) {
    showToast('CNH vencida! Verifique a validade antes de registrar.', 'warn');
    return;
  }

  let proto = document.getElementById('protocolValue').textContent;
  if (!proto || proto === '—') proto = gerarProtocolo();

  const ci = load(KEYS.checkins);
  const registro = {
    id:            gerarId(),
    protocolo:     proto,
    data:          document.getElementById('ci-data').value,
    hora:          document.getElementById('ci-hora').value,
    transportadora:document.getElementById('ci-transportadora').value.trim(),
    motorista:     document.getElementById('ci-motorista').value.trim(),
    cpf:           document.getElementById('ci-cpf').value.trim(),
    cnh:           document.getElementById('ci-cnh').value.trim(),
    categCNH:      document.getElementById('ci-categCNH').value,
    valCNH:        valCNH,
    placa:         document.getElementById('ci-placa').value.trim().toUpperCase(),
    placaCarreta:  document.getElementById('ci-placaCarreta').value.trim().toUpperCase(),
    modelo:        document.getElementById('ci-modelo').value.trim(),
    tipoVeiculo:   document.getElementById('ci-tipoVeiculo').value,
    tipoCarga:     document.getElementById('ci-tipoCarga').value,
    peso:          document.getElementById('ci-peso').value,
    setor:         document.getElementById('ci-setor').value,
    responsavel:   document.getElementById('ci-responsavel').value.trim(),
    motivo:        document.getElementById('ci-motivo').value,
    obs:           document.getElementById('ci-obs').value.trim(),
    status:        'Dentro da empresa',
    dtSaida:       null,
    hrSaida:       null,
    conferente:    null,
    situacaoSaida: null,
    obsFinais:     null,
    criadoEm:      new Date().toISOString()
  };
  ci.unshift(registro);
  save(KEYS.checkins, ci);
  registrarAuditoria('CHECK-IN', 'Check-in', registro.protocolo, '', `Placa: ${registro.placa}`);
  addAlert(`Check-in registrado: ${registro.protocolo} · ${registro.placa}`, 'ok');
  showToast(`✅ Check-in registrado! Protocolo: <strong>${proto}</strong>`, 'success', 5000);
  clearCheckin();
  renderCheckinTable();
  updateSidebarBadges();
}

function imprimirCheckin() {
  const p = document.getElementById('protocolValue').textContent;
  window.print();
}

function renderCheckinTable() {
  const ci     = load(KEYS.checkins);
  const tbody  = document.getElementById('checkinTbody');
  const filter = (document.getElementById('filterCheckin') || {}).value || '';
  if (!tbody) return;
  let data = ci;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.placa, r.motorista, r.transportadora, r.protocolo, r.setor].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row"><i class="fa fa-inbox"></i> Nenhum check-in encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="text-mono">${r.protocolo}</td>
      <td>${r.data} ${r.hora}</td>
      <td><strong>${r.placa}</strong></td>
      <td>${r.transportadora}</td>
      <td>${r.motorista}</td>
      <td>${r.setor}</td>
      <td>${badgeStatus(r.status)}</td>
      <td>
        <div class="actions">
          <button class="btn-action view" onclick="verCheckin('${r.id}')"><i class="fa fa-eye"></i></button>
          <button class="btn-action edit" onclick="editarCheckin('${r.id}')"><i class="fa fa-pen"></i></button>
          <button class="btn-action del" onclick="excluirCheckin('${r.id}')"><i class="fa fa-trash"></i></button>
          ${r.status === 'Dentro da empresa' ? `<button class="btn-action co" onclick="irCheckout('${r.protocolo}')"><i class="fa fa-sign-out-alt"></i> C/O</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function verCheckin(id) {
  const ci = load(KEYS.checkins);
  const r  = ci.find(x => x.id === id);
  if (!r) return;
  const fields = [
    ['Protocolo', r.protocolo],['Status', r.status],['Data', r.data],['Hora', r.hora],
    ['Placa', r.placa],['Placa Carreta', r.placaCarreta || '—'],['Modelo', r.modelo],
    ['Tipo Veículo', r.tipoVeiculo || '—'],['Transportadora', r.transportadora],
    ['Motorista', r.motorista],['CPF', r.cpf],['CNH', r.cnh],
    ['Categoria CNH', r.categCNH],['Validade CNH', r.valCNH],
    ['Tipo de Carga', r.tipoCarga],['Peso', r.peso ? r.peso + ' kg' : '—'],
    ['Setor', r.setor],['Responsável', r.responsavel],['Motivo', r.motivo],
    ['Observações', r.obs || '—'],
    ['Data Saída', r.dtSaida || '—'],['Hora Saída', r.hrSaida || '—'],
    ['Conferente', r.conferente || '—'],['Situação Saída', r.situacaoSaida || '—'],
    ['Permanência', calcPermanencia(r.data, r.hora, r.dtSaida, r.hrSaida)]
  ];
  const html = `<div class="modal-detail-grid">${fields.map(([l,v]) => `<div class="modal-field"><span class="mf-label">${l}</span><span class="mf-value">${v}</span></div>`).join('')}</div>`;
  openModal(`Detalhes · ${r.protocolo}`, html);
}

function editarCheckin(id) {
  const ci = load(KEYS.checkins);
  const r  = ci.find(x => x.id === id);
  if (!r) return;
  // Navigate and fill form
  navigateTo('checkin');
  const map = {
    'ci-data': r.data, 'ci-hora': r.hora, 'ci-transportadora': r.transportadora,
    'ci-motorista': r.motorista, 'ci-cpf': r.cpf, 'ci-cnh': r.cnh,
    'ci-categCNH': r.categCNH, 'ci-valCNH': r.valCNH, 'ci-placa': r.placa,
    'ci-placaCarreta': r.placaCarreta, 'ci-modelo': r.modelo,
    'ci-tipoVeiculo': r.tipoVeiculo, 'ci-tipoCarga': r.tipoCarga,
    'ci-peso': r.peso, 'ci-setor': r.setor, 'ci-responsavel': r.responsavel,
    'ci-motivo': r.motivo, 'ci-obs': r.obs
  };
  Object.entries(map).forEach(([k, v]) => {
    const el = document.getElementById(k);
    if (el) el.value = v || '';
  });
  const pv = document.getElementById('protocolValue');
  if (pv) pv.textContent = r.protocolo;
  // Remove original
  save(KEYS.checkins, ci.filter(x => x.id !== id));
  showToast('Registro carregado para edição. Salve novamente ao concluir.', 'info');
}

function excluirCheckin(id) {
  if (!confirm('Confirmar exclusão deste registro?')) return;
  const ci = load(KEYS.checkins);
  const r  = ci.find(x => x.id === id);
  save(KEYS.checkins, ci.filter(x => x.id !== id));
  registrarAuditoria('EXCLUSÃO', 'Check-in', r ? r.protocolo : id, `Placa: ${r?.placa}`, 'EXCLUÍDO');
  showToast('Registro excluído.', 'warn');
  renderCheckinTable();
  updateSidebarBadges();
}

function irCheckout(protocolo) {
  navigateTo('checkout');
  setTimeout(() => {
    const el = document.getElementById('co-protocolo');
    if (el) { el.value = protocolo; buscarCheckin(); }
  }, 80);
}

/* ══════════════════════════════════════════════
   CHECK-OUT
══════════════════════════════════════════════ */
let checkoutTargetId = null;

function buscarCheckin() {
  const proto  = (document.getElementById('co-protocolo') || {}).value.trim();
  const placa  = (document.getElementById('co-placa') || {}).value.trim().toUpperCase();
  const motor  = (document.getElementById('co-motorista') || {}).value.trim().toLowerCase();
  const ci     = load(KEYS.checkins);

  const found = ci.find(r =>
    r.status === 'Dentro da empresa' &&
    (
      (proto && r.protocolo.toLowerCase().includes(proto.toLowerCase())) ||
      (placa && r.placa.includes(placa)) ||
      (motor && r.motorista.toLowerCase().includes(motor))
    )
  );

  const result = document.getElementById('checkoutResult');
  if (!found) {
    showToast('Nenhum registro ativo encontrado com esses dados.', 'error');
    result.classList.add('hidden');
    checkoutTargetId = null;
    return;
  }

  checkoutTargetId = found.id;
  result.classList.remove('hidden');

  const grid = document.getElementById('checkoutInfoGrid');
  const fields = [
    ['Protocolo', found.protocolo], ['Status', badgeStatus(found.status)],
    ['Data Entrada', found.data], ['Hora Entrada', found.hora],
    ['Placa', found.placa], ['Modelo', found.modelo],
    ['Transportadora', found.transportadora], ['Motorista', found.motorista],
    ['CPF', found.cpf], ['CNH', found.cnh], ['Validade CNH', found.valCNH],
    ['Tipo de Carga', found.tipoCarga], ['Setor', found.setor],
    ['Responsável', found.responsavel]
  ];
  grid.innerHTML = fields.map(([l, v]) => `<div class="info-field"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`).join('');

  // Pre-fill date/time
  const ds = document.getElementById('co-dataSaida');
  const hs = document.getElementById('co-horaSaida');
  if (ds) ds.value = todayStr();
  if (hs) hs.value = timeStr();
}

function finalizarCheckout() {
  if (!checkoutTargetId) { showToast('Nenhum registro selecionado.', 'error'); return; }
  const conf = document.getElementById('co-confirmacao');
  if (conf && !conf.checked) { showToast('Confirme a liberação do veículo antes de finalizar.', 'warn'); return; }

  const ds  = document.getElementById('co-dataSaida').value;
  const hs  = document.getElementById('co-horaSaida').value;
  const cfr = document.getElementById('co-conferente').value.trim();
  const sit = document.getElementById('co-situacao').value;
  const obs = document.getElementById('co-obsFinais').value.trim();

  if (!ds || !hs) { showToast('Informe data e hora de saída.', 'error'); return; }
  if (!cfr) { showToast('Informe o conferente responsável.', 'error'); return; }
  if (!sit) { showToast('Informe a situação da saída.', 'error'); return; }

  const ci = load(KEYS.checkins);
  const idx = ci.findIndex(r => r.id === checkoutTargetId);
  if (idx === -1) { showToast('Registro não encontrado.', 'error'); return; }

  const perm = calcPermanencia(ci[idx].data, ci[idx].hora, ds, hs);
  ci[idx].status       = 'Check-out realizado';
  ci[idx].dtSaida      = ds;
  ci[idx].hrSaida      = hs;
  ci[idx].conferente   = cfr;
  ci[idx].situacaoSaida= sit;
  ci[idx].obsFinais    = obs;
  ci[idx].permanencia  = perm;
  save(KEYS.checkins, ci);

  registrarAuditoria('CHECK-OUT', 'Check-out', ci[idx].protocolo, 'Dentro da empresa', 'Check-out realizado');
  addAlert(`Check-out realizado: ${ci[idx].protocolo} · Permanência: ${perm}`, 'ok');
  showToast(`✅ Check-out finalizado! Permanência: <strong>${perm}</strong>`, 'success', 5000);

  // Reset checkout
  document.getElementById('checkoutResult').classList.add('hidden');
  checkoutTargetId = null;
  ['co-protocolo','co-placa','co-motorista','co-horaSaida','co-dataSaida','co-conferente','co-situacao','co-obsFinais'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const ck = document.getElementById('co-confirmacao');
  if (ck) ck.checked = false;
  updateSidebarBadges();
}

/* ══════════════════════════════════════════════
   AGENDAMENTOS
══════════════════════════════════════════════ */
function clearAgendamento() {
  ['ag-data','ag-hora','ag-transp','ag-motorista','ag-placa','ag-tipoCarga','ag-setor','ag-prioridade','ag-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? el.options[0].value : '';
  });
}

function salvarAgendamento() {
  const data  = document.getElementById('ag-data').value;
  const hora  = document.getElementById('ag-hora').value;
  const transp= document.getElementById('ag-transp').value.trim();
  if (!data || !hora || !transp) { showToast('Preencha data, hora e transportadora.', 'error'); return; }

  const ag = load(KEYS.agendamentos);
  ag.unshift({
    id:       gerarId(),
    data, hora,
    transp,
    motorista: document.getElementById('ag-motorista').value.trim(),
    placa:     document.getElementById('ag-placa').value.trim().toUpperCase(),
    tipoCarga: document.getElementById('ag-tipoCarga').value,
    setor:     document.getElementById('ag-setor').value,
    prioridade:document.getElementById('ag-prioridade').value,
    obs:       document.getElementById('ag-obs').value.trim(),
    status:    'Agendado',
    criadoEm:  new Date().toISOString()
  });
  save(KEYS.agendamentos, ag);
  registrarAuditoria('AGENDAMENTO', 'Agendamentos', `${transp} – ${data}`, '', 'Novo agendamento');
  showToast('Agendamento registrado com sucesso!', 'success');
  clearAgendamento();
  renderAgendamentosTable();
  updateSidebarBadges();
}

function renderAgendamentosTable() {
  const ag     = load(KEYS.agendamentos);
  const tbody  = document.getElementById('agTbody');
  const filter = (document.getElementById('filterAg') || {}).value || '';
  if (!tbody) return;
  let data = ag;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.transp, r.motorista, r.placa, r.status].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row"><i class="fa fa-inbox"></i> Nenhum agendamento.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.data}</td><td>${r.hora}</td><td>${r.transp}</td>
      <td>${r.motorista || '—'}</td><td>${r.placa || '—'}</td>
      <td>${badgeStatus(r.prioridade)}</td>
      <td>${badgeStatus(r.status)}</td>
      <td>
        <div class="actions">
          <button class="btn-action co" onclick="converterAgendamento('${r.id}')"><i class="fa fa-check"></i> Check-in</button>
          <button class="btn-action del" onclick="excluirAgendamento('${r.id}')"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function converterAgendamento(id) {
  const ag  = load(KEYS.agendamentos);
  const idx = ag.findIndex(r => r.id === id);
  if (idx === -1) return;
  const r = ag[idx];
  navigateTo('checkin');
  setTimeout(() => {
    const map = {
      'ci-transportadora': r.transp,
      'ci-motorista': r.motorista,
      'ci-placa': r.placa,
      'ci-tipoCarga': r.tipoCarga,
      'ci-setor': r.setor,
      'ci-data': todayStr(),
      'ci-hora': timeStr()
    };
    Object.entries(map).forEach(([k, v]) => {
      const el = document.getElementById(k);
      if (el) el.value = v || '';
    });
    gerarProtocolo();
    ag[idx].status = 'Confirmado';
    save(KEYS.agendamentos, ag);
    showToast('Agendamento convertido em check-in. Complete e salve.', 'info');
  }, 100);
}

function excluirAgendamento(id) {
  if (!confirm('Excluir agendamento?')) return;
  const ag = load(KEYS.agendamentos);
  save(KEYS.agendamentos, ag.filter(r => r.id !== id));
  showToast('Agendamento excluído.', 'warn');
  renderAgendamentosTable();
  updateSidebarBadges();
}

/* ══════════════════════════════════════════════
   ENTRADAS / SAÍDAS
══════════════════════════════════════════════ */
function renderEntradasTable() {
  const ci    = load(KEYS.checkins);
  const tbody = document.getElementById('entradasTbody');
  if (!tbody) return;
  const di     = (document.getElementById('ent-di') || {}).value || '';
  const df     = (document.getElementById('ent-df') || {}).value || '';
  const transp = ((document.getElementById('ent-transp') || {}).value || '').toLowerCase();
  const mot    = ((document.getElementById('ent-mot') || {}).value || '').toLowerCase();
  const placa  = ((document.getElementById('ent-placa') || {}).value || '').toUpperCase();
  const status = (document.getElementById('ent-status') || {}).value || '';
  let data = ci;
  if (di) data = data.filter(r => r.data >= di);
  if (df) data = data.filter(r => r.data <= df);
  if (transp) data = data.filter(r => r.transportadora.toLowerCase().includes(transp));
  if (mot) data = data.filter(r => r.motorista.toLowerCase().includes(mot));
  if (placa) data = data.filter(r => r.placa.includes(placa));
  if (status) data = data.filter(r => r.status === status);
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row"><i class="fa fa-inbox"></i> Nenhum registro encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="text-mono">${r.protocolo}</td>
      <td>${r.data} ${r.hora}</td>
      <td><strong>${r.placa}</strong></td>
      <td>${r.transportadora}</td>
      <td>${r.motorista}</td>
      <td>${r.setor}</td>
      <td>${r.tipoCarga || '—'}</td>
      <td>${badgeStatus(r.status)}</td>
      <td><button class="btn-action view" onclick="verCheckin('${r.id}')"><i class="fa fa-eye"></i></button></td>
    </tr>`).join('');
}

function clearEntFilter() {
  ['ent-di','ent-df','ent-transp','ent-mot','ent-placa','ent-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderEntradasTable();
}

function renderSaidasTable() {
  const ci    = load(KEYS.checkins);
  const tbody = document.getElementById('saidasTbody');
  if (!tbody) return;
  const di     = (document.getElementById('sai-di') || {}).value || '';
  const df     = (document.getElementById('sai-df') || {}).value || '';
  const transp = ((document.getElementById('sai-transp') || {}).value || '').toLowerCase();
  const mot    = ((document.getElementById('sai-mot') || {}).value || '').toLowerCase();
  const placa  = ((document.getElementById('sai-placa') || {}).value || '').toUpperCase();
  let data = ci.filter(r => r.status === 'Check-out realizado');
  if (di) data = data.filter(r => r.dtSaida >= di);
  if (df) data = data.filter(r => r.dtSaida <= df);
  if (transp) data = data.filter(r => r.transportadora.toLowerCase().includes(transp));
  if (mot) data = data.filter(r => r.motorista.toLowerCase().includes(mot));
  if (placa) data = data.filter(r => r.placa.includes(placa));
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row"><i class="fa fa-inbox"></i> Nenhuma saída registrada.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="text-mono">${r.protocolo}</td>
      <td>${r.data} ${r.hora}</td>
      <td>${r.dtSaida} ${r.hrSaida}</td>
      <td><strong>${r.placa}</strong></td>
      <td>${r.motorista}</td>
      <td>${r.transportadora}</td>
      <td><span class="badge badge-teal">${r.permanencia || '—'}</span></td>
      <td>${badgeStatus(r.situacaoSaida)}</td>
    </tr>`).join('');
}

function clearSaiFilter() {
  ['sai-di','sai-df','sai-transp','sai-mot','sai-placa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderSaidasTable();
}

/* ══════════════════════════════════════════════
   CAMINHÕES
══════════════════════════════════════════════ */
function salvarCaminhao() {
  const placa = document.getElementById('cam-placa').value.trim().toUpperCase();
  const modelo= document.getElementById('cam-modelo').value.trim();
  if (!placa || !modelo) { showToast('Preencha placa e modelo.', 'error'); return; }
  const cam = load(KEYS.caminhoes);
  cam.unshift({
    id:       gerarId(),
    placa,
    placaCarreta: document.getElementById('cam-placaC').value.trim().toUpperCase(),
    modelo,
    marca:    document.getElementById('cam-marca').value.trim(),
    ano:      document.getElementById('cam-ano').value,
    tipo:     document.getElementById('cam-tipo').value,
    cap:      document.getElementById('cam-cap').value,
    status:   document.getElementById('cam-status').value,
    criadoEm: new Date().toISOString()
  });
  save(KEYS.caminhoes, cam);
  registrarAuditoria('CADASTRO', 'Caminhões', placa, '', 'Novo veículo');
  showToast('Caminhão cadastrado com sucesso!', 'success');
  ['cam-placa','cam-placaC','cam-modelo','cam-marca','cam-ano','cam-cap'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderCaminhoesTable();
}

function renderCaminhoesTable() {
  const cam   = load(KEYS.caminhoes);
  const tbody = document.getElementById('camTbody');
  const filter= (document.getElementById('filterCam') || {}).value || '';
  if (!tbody) return;
  let data = cam;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.placa, r.modelo, r.marca, r.tipo].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row"><i class="fa fa-inbox"></i> Nenhum veículo cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><strong>${r.placa}</strong></td><td>${r.placaCarreta||'—'}</td>
      <td>${r.modelo}</td><td>${r.marca||'—'}</td><td>${r.ano||'—'}</td>
      <td>${r.tipo||'—'}</td><td>${r.cap ? r.cap+' kg' : '—'}</td>
      <td>${badgeStatus(r.status)}</td>
      <td><button class="btn-action del" onclick="excluirCaminhao('${r.id}')"><i class="fa fa-trash"></i></button></td>
    </tr>`).join('');
}

function excluirCaminhao(id) {
  if (!confirm('Excluir veículo?')) return;
  const cam = load(KEYS.caminhoes);
  save(KEYS.caminhoes, cam.filter(r => r.id !== id));
  showToast('Veículo excluído.', 'warn');
  renderCaminhoesTable();
}

/* ══════════════════════════════════════════════
   MOTORISTAS
══════════════════════════════════════════════ */
function salvarMotorista() {
  const nome = document.getElementById('mot-nome').value.trim();
  const cpf  = document.getElementById('mot-cpf').value.trim();
  const cnh  = document.getElementById('mot-cnh').value.trim();
  if (!nome || !cpf || !cnh) { showToast('Preencha nome, CPF e CNH.', 'error'); return; }
  const mo = load(KEYS.motoristas);
  mo.unshift({
    id:       gerarId(),
    nome, cpf, cnh,
    categ:    document.getElementById('mot-categ').value,
    valCNH:   document.getElementById('mot-valCNH').value,
    tel:      document.getElementById('mot-tel').value.trim(),
    transp:   document.getElementById('mot-transp').value.trim(),
    status:   document.getElementById('mot-status').value,
    obs:      document.getElementById('mot-obs').value.trim(),
    criadoEm: new Date().toISOString()
  });
  save(KEYS.motoristas, mo);
  registrarAuditoria('CADASTRO', 'Motoristas', nome, '', 'Novo motorista');
  showToast('Motorista cadastrado com sucesso!', 'success');
  ['mot-nome','mot-cpf','mot-cnh','mot-valCNH','mot-tel','mot-transp','mot-obs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderMotoristasTable();
  updateSidebarBadges();
}

function renderMotoristasTable() {
  const mo    = load(KEYS.motoristas);
  const tbody = document.getElementById('motTbody');
  const filter= (document.getElementById('filterMot') || {}).value || '';
  if (!tbody) return;
  let data = mo;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.nome, r.cpf, r.cnh, r.transp].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row"><i class="fa fa-inbox"></i> Nenhum motorista cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => {
    const cnhVenc = r.valCNH && r.valCNH < todayStr() ? '<span class="badge badge-red">VENCIDA</span>' : r.valCNH;
    return `<tr>
      <td>${r.nome}</td><td class="text-mono">${r.cpf}</td><td class="text-mono">${r.cnh}</td>
      <td>${r.categ||'—'}</td><td>${cnhVenc||'—'}</td><td>${r.tel||'—'}</td>
      <td>${r.transp||'—'}</td><td>${badgeStatus(r.status)}</td>
      <td><button class="btn-action del" onclick="excluirMotorista('${r.id}')"><i class="fa fa-trash"></i></button></td>
    </tr>`;
  }).join('');
}

function excluirMotorista(id) {
  if (!confirm('Excluir motorista?')) return;
  const mo = load(KEYS.motoristas);
  save(KEYS.motoristas, mo.filter(r => r.id !== id));
  showToast('Motorista excluído.', 'warn');
  renderMotoristasTable();
  updateSidebarBadges();
}

/* ══════════════════════════════════════════════
   TRANSPORTADORAS
══════════════════════════════════════════════ */
function salvarTransportadora() {
  const nome = document.getElementById('tr-nome').value.trim();
  if (!nome) { showToast('Informe o nome da transportadora.', 'error'); return; }
  const tr = load(KEYS.transportadoras);
  tr.unshift({
    id:       gerarId(),
    nome,
    cnpj:     document.getElementById('tr-cnpj').value.trim(),
    tel:      document.getElementById('tr-tel').value.trim(),
    email:    document.getElementById('tr-email').value.trim(),
    end:      document.getElementById('tr-end').value.trim(),
    resp:     document.getElementById('tr-resp').value.trim(),
    status:   document.getElementById('tr-status').value,
    obs:      document.getElementById('tr-obs').value.trim(),
    criadoEm: new Date().toISOString()
  });
  save(KEYS.transportadoras, tr);
  registrarAuditoria('CADASTRO', 'Transportadoras', nome, '', 'Nova transportadora');
  showToast('Transportadora cadastrada com sucesso!', 'success');
  ['tr-nome','tr-cnpj','tr-tel','tr-email','tr-end','tr-resp','tr-obs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderTransportadorasTable();
  updateSidebarBadges();
  populateDatalist();
}

function renderTransportadorasTable() {
  const tr    = load(KEYS.transportadoras);
  const tbody = document.getElementById('trTbody');
  const filter= (document.getElementById('filterTr') || {}).value || '';
  if (!tbody) return;
  let data = tr;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.nome, r.cnpj, r.resp].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fa fa-inbox"></i> Nenhuma transportadora cadastrada.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><strong>${r.nome}</strong></td><td class="text-mono">${r.cnpj||'—'}</td>
      <td>${r.tel||'—'}</td><td>${r.email||'—'}</td><td>${r.resp||'—'}</td>
      <td>${badgeStatus(r.status)}</td>
      <td><button class="btn-action del" onclick="excluirTransportadora('${r.id}')"><i class="fa fa-trash"></i></button></td>
    </tr>`).join('');
}

function excluirTransportadora(id) {
  if (!confirm('Excluir transportadora?')) return;
  const tr = load(KEYS.transportadoras);
  save(KEYS.transportadoras, tr.filter(r => r.id !== id));
  showToast('Transportadora excluída.', 'warn');
  renderTransportadorasTable();
  updateSidebarBadges();
}

/* ══════════════════════════════════════════════
   OCORRÊNCIAS
══════════════════════════════════════════════ */
function clearOcorrencia() {
  ['oc-tipo','oc-dt','oc-envolvidos','oc-grav','oc-status','oc-resp','oc-desc'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

function salvarOcorrencia() {
  const tipo = document.getElementById('oc-tipo').value;
  const desc = document.getElementById('oc-desc').value.trim();
  const grav = document.getElementById('oc-grav').value;
  if (!tipo || !desc || !grav) { showToast('Preencha tipo, descrição e gravidade.', 'error'); return; }
  const oc = load(KEYS.ocorrencias);
  oc.unshift({
    id:         gerarId(),
    tipo,
    dt:         document.getElementById('oc-dt').value || new Date().toISOString().slice(0,16),
    envolvidos: document.getElementById('oc-envolvidos').value.trim(),
    grav,
    status:     document.getElementById('oc-status').value,
    resp:       document.getElementById('oc-resp').value.trim(),
    desc,
    criadoEm:   new Date().toISOString()
  });
  save(KEYS.ocorrencias, oc);
  registrarAuditoria('OCORRÊNCIA', 'Ocorrências', tipo, '', grav);
  addAlert(`Nova ocorrência registrada: ${tipo} – Gravidade: ${grav}`, grav === 'Crítica' ? 'danger' : 'warn');
  showToast('Ocorrência registrada com sucesso!', grav === 'Crítica' ? 'error' : 'warn');
  clearOcorrencia();
  renderOcorrenciasTable();
  updateSidebarBadges();
}

function renderOcorrenciasTable() {
  const oc    = load(KEYS.ocorrencias);
  const tbody = document.getElementById('ocTbody');
  const filter= (document.getElementById('filterOc') || {}).value || '';
  if (!tbody) return;
  let data = oc;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.tipo, r.envolvidos, r.grav, r.status, r.resp].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fa fa-inbox"></i> Nenhuma ocorrência registrada.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.dt ? r.dt.replace('T',' ') : '—'}</td>
      <td>${r.tipo}</td><td>${r.envolvidos||'—'}</td>
      <td>${badgeStatus(r.grav)}</td>
      <td>${badgeStatus(r.status)}</td>
      <td>${r.resp||'—'}</td>
      <td>
        <div class="actions">
          <button class="btn-action view" onclick="verOcorrencia('${r.id}')"><i class="fa fa-eye"></i></button>
          <button class="btn-action del" onclick="excluirOcorrencia('${r.id}')"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function verOcorrencia(id) {
  const oc = load(KEYS.ocorrencias);
  const r  = oc.find(x => x.id === id);
  if (!r) return;
  const html = `<div class="modal-detail-grid">
    <div class="modal-field"><span class="mf-label">Tipo</span><span class="mf-value">${r.tipo}</span></div>
    <div class="modal-field"><span class="mf-label">Data/Hora</span><span class="mf-value">${r.dt||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Envolvidos</span><span class="mf-value">${r.envolvidos||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Gravidade</span><span class="mf-value">${badgeStatus(r.grav)}</span></div>
    <div class="modal-field"><span class="mf-label">Status</span><span class="mf-value">${badgeStatus(r.status)}</span></div>
    <div class="modal-field"><span class="mf-label">Responsável</span><span class="mf-value">${r.resp||'—'}</span></div>
    <div class="modal-field" style="grid-column:1/-1"><span class="mf-label">Descrição</span><span class="mf-value">${r.desc}</span></div>
  </div>`;
  openModal(`Ocorrência · ${r.tipo}`, html);
}

function excluirOcorrencia(id) {
  if (!confirm('Excluir ocorrência?')) return;
  const oc = load(KEYS.ocorrencias);
  save(KEYS.ocorrencias, oc.filter(r => r.id !== id));
  showToast('Ocorrência excluída.', 'warn');
  renderOcorrenciasTable();
  updateSidebarBadges();
}

/* ══════════════════════════════════════════════
   ANÁLISE ADMINISTRATIVA
══════════════════════════════════════════════ */
function clearAnalise() {
  ['an-nome','an-cargo','an-setor','an-ativContr','an-ativExig','an-gerente',
   'an-datas','an-testmunhas','an-desc','an-rh','an-obsFinais'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.querySelectorAll('input[name="an-tipo"]').forEach(cb => cb.checked = false);
  ['an-respRH','an-canal','an-codigo','an-situacao'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

function salvarAnalise() {
  const nome = document.getElementById('an-nome').value.trim();
  const desc = document.getElementById('an-desc').value.trim();
  if (!nome || !desc) { showToast('Informe nome do funcionário e descrição.', 'error'); return; }
  const tipos = [...document.querySelectorAll('input[name="an-tipo"]:checked')].map(cb => cb.value);
  const an = load(KEYS.analise);
  an.unshift({
    id:       gerarId(),
    nome,
    cargo:    document.getElementById('an-cargo').value.trim(),
    setor:    document.getElementById('an-setor').value.trim(),
    ativContr:document.getElementById('an-ativContr').value.trim(),
    ativExig: document.getElementById('an-ativExig').value.trim(),
    gerente:  document.getElementById('an-gerente').value.trim(),
    datas:    document.getElementById('an-datas').value.trim(),
    testmunhas:document.getElementById('an-testmunhas').value.trim(),
    tipos,
    desc,
    rh:       document.getElementById('an-rh').value.trim(),
    respRH:   document.getElementById('an-respRH').value,
    canal:    document.getElementById('an-canal').value,
    codigo:   document.getElementById('an-codigo').value,
    situacao: document.getElementById('an-situacao').value,
    obsFinais:document.getElementById('an-obsFinais').value.trim(),
    criadoEm: new Date().toISOString()
  });
  save(KEYS.analise, an);
  registrarAuditoria('CASO ADM', 'Análise Administrativa', nome, '', tipos.join(', '));
  showToast('Caso administrativo registrado com sucesso!', 'success');
  clearAnalise();
  renderAnaliseTable();
}

function renderAnaliseTable() {
  const an    = load(KEYS.analise);
  const tbody = document.getElementById('anTbody');
  const filter= (document.getElementById('filterAn') || {}).value || '';
  if (!tbody) return;
  let data = an;
  if (filter) {
    const f = filter.toLowerCase();
    data = data.filter(r => [r.nome, r.cargo, r.gerente, r.situacao].join(' ').toLowerCase().includes(f));
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fa fa-inbox"></i> Nenhum caso registrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.criadoEm ? r.criadoEm.slice(0,10) : '—'}</td>
      <td><strong>${r.nome}</strong></td>
      <td>${r.cargo||'—'}</td>
      <td>${r.gerente||'—'}</td>
      <td><small>${(r.tipos||[]).slice(0,3).join(', ')}${r.tipos&&r.tipos.length>3?'...':''}</small></td>
      <td>${badgeStatus(r.situacao)}</td>
      <td>
        <div class="actions">
          <button class="btn-action view" onclick="verAnalise('${r.id}')"><i class="fa fa-eye"></i></button>
          <button class="btn-action del" onclick="excluirAnalise('${r.id}')"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function verAnalise(id) {
  const an = load(KEYS.analise);
  const r  = an.find(x => x.id === id);
  if (!r) return;
  const html = `<div class="modal-detail-grid">
    <div class="modal-field"><span class="mf-label">Funcionário</span><span class="mf-value">${r.nome}</span></div>
    <div class="modal-field"><span class="mf-label">Cargo</span><span class="mf-value">${r.cargo||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Setor</span><span class="mf-value">${r.setor||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Supervisor</span><span class="mf-value">${r.gerente||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Datas</span><span class="mf-value">${r.datas||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Testemunhas</span><span class="mf-value">${r.testmunhas||'—'}</span></div>
    <div class="modal-field" style="grid-column:1/-1"><span class="mf-label">Tipos de Situação</span><span class="mf-value">${(r.tipos||[]).join(' · ')||'—'}</span></div>
    <div class="modal-field" style="grid-column:1/-1"><span class="mf-label">Descrição</span><span class="mf-value">${r.desc}</span></div>
    <div class="modal-field" style="grid-column:1/-1"><span class="mf-label">Providência RH</span><span class="mf-value">${r.rh||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Resposta Formal RH</span><span class="mf-value">${r.respRH||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Canal Denúncia</span><span class="mf-value">${r.canal||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Código de Conduta</span><span class="mf-value">${r.codigo||'—'}</span></div>
    <div class="modal-field"><span class="mf-label">Situação Final</span><span class="mf-value">${badgeStatus(r.situacao)}</span></div>
    <div class="modal-field" style="grid-column:1/-1"><span class="mf-label">Observações Finais</span><span class="mf-value">${r.obsFinais||'—'}</span></div>
  </div>`;
  openModal(`Caso Administrativo · ${r.nome}`, html);
}

function excluirAnalise(id) {
  if (!confirm('Excluir caso administrativo?')) return;
  const an = load(KEYS.analise);
  save(KEYS.analise, an.filter(r => r.id !== id));
  showToast('Caso excluído.', 'warn');
  renderAnaliseTable();
}

/* ══════════════════════════════════════════════
   RELATÓRIOS
══════════════════════════════════════════════ */
function selectRelType(el, type) {
  document.querySelectorAll('.rel-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  APP.selectedRelType = type;
}

function gerarRelatorio() {
  if (!APP.selectedRelType) { showToast('Selecione um tipo de relatório.', 'warn'); return; }
  const ci  = load(KEYS.checkins);
  const oc  = load(KEYS.ocorrencias);
  const an  = load(KEYS.analise);
  const aud = load(KEYS.auditoria);
  const di  = (document.getElementById('rel-di') || {}).value || '';
  const df  = (document.getElementById('rel-df') || {}).value || '';
  const transp= ((document.getElementById('rel-transp')||{}).value||'').toLowerCase();
  const mot   = ((document.getElementById('rel-mot')||{}).value||'').toLowerCase();
  const placa = ((document.getElementById('rel-placa')||{}).value||'').toUpperCase();
  const status= (document.getElementById('rel-status')||{}).value||'';

  let data = [], cols = [], title = '';

  switch (APP.selectedRelType) {
    case 'entradas':
      title = '📥 Relatório de Entradas';
      cols  = ['Protocolo','Data','Hora','Placa','Motorista','Transportadora','Setor','Status'];
      data  = ci.filter(applyFilters(di,df,transp,mot,placa,status));
      break;
    case 'saidas':
      title = '📤 Relatório de Saídas';
      cols  = ['Protocolo','Data Entrada','Data Saída','Placa','Motorista','Permanência','Situação'];
      data  = ci.filter(r => r.status === 'Check-out realizado').filter(applyFilters(di,df,transp,mot,placa,''));
      break;
    case 'permanencia':
      title = '⏱ Relatório de Permanência';
      cols  = ['Protocolo','Placa','Motorista','Entrada','Saída','Permanência'];
      data  = ci.filter(r => r.permanencia).filter(applyFilters(di,df,transp,mot,placa,''));
      break;
    case 'transportadora':
      title = '🏢 Relatório por Transportadora';
      cols  = ['Transportadora','Total Entradas','Dentro','Check-outs'];
      const byT = {};
      ci.forEach(r => {
        if (!byT[r.transportadora]) byT[r.transportadora] = { tot: 0, dentro: 0, co: 0 };
        byT[r.transportadora].tot++;
        if (r.status === 'Dentro da empresa') byT[r.transportadora].dentro++;
        if (r.status === 'Check-out realizado') byT[r.transportadora].co++;
      });
      data = Object.entries(byT).map(([k, v]) => ({ transp: k, tot: v.tot, dentro: v.dentro, co: v.co }));
      break;
    case 'ocorrencias':
      title = '⚠️ Relatório de Ocorrências';
      cols  = ['Data','Tipo','Gravidade','Status','Responsável'];
      data  = oc;
      break;
    case 'administrativo':
      title = '⚖️ Relatório Administrativo';
      cols  = ['Data','Funcionário','Cargo','Situação Final'];
      data  = an;
      break;
    case 'auditoria':
      title = '🛡️ Relatório de Auditoria';
      cols  = ['Data/Hora','Usuário','Ação','Tela','Registro'];
      data  = aud;
      break;
    default:
      title = '📋 Relatório Geral';
      cols  = ['Protocolo','Data','Placa','Motorista','Status'];
      data  = ci;
  }

  const tbody = document.getElementById('relTbody');
  const thead = document.getElementById('relThead');
  const relResult = document.getElementById('relResult');
  document.getElementById('relTitle').textContent = title;
  relResult.style.display = 'block';

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="empty-row">Nenhum dado para o período selecionado.</td></tr>';
    return;
  }

  switch (APP.selectedRelType) {
    case 'entradas': case 'saidas':
      tbody.innerHTML = data.map(r => `<tr><td class="text-mono">${r.protocolo}</td><td>${r.data}</td><td>${r.dtSaida||r.hora}</td><td>${r.placa}</td><td>${r.motorista}</td><td>${r.transportadora||''}</td><td>${r.setor||r.permanencia||''}</td><td>${badgeStatus(r.status)}</td></tr>`).join('');
      break;
    case 'permanencia':
      tbody.innerHTML = data.map(r => `<tr><td class="text-mono">${r.protocolo}</td><td>${r.placa}</td><td>${r.motorista}</td><td>${r.data} ${r.hora}</td><td>${r.dtSaida||''} ${r.hrSaida||''}</td><td><span class="badge badge-teal">${r.permanencia}</span></td></tr>`).join('');
      break;
    case 'transportadora':
      tbody.innerHTML = data.map(r => `<tr><td>${r.transp}</td><td>${r.tot}</td><td>${r.dentro}</td><td>${r.co}</td></tr>`).join('');
      break;
    case 'ocorrencias':
      tbody.innerHTML = data.map(r => `<tr><td>${r.dt||'—'}</td><td>${r.tipo}</td><td>${badgeStatus(r.grav)}</td><td>${badgeStatus(r.status)}</td><td>${r.resp||'—'}</td></tr>`).join('');
      break;
    case 'administrativo':
      tbody.innerHTML = data.map(r => `<tr><td>${r.criadoEm?.slice(0,10)||'—'}</td><td>${r.nome}</td><td>${r.cargo||'—'}</td><td>${badgeStatus(r.situacao)}</td></tr>`).join('');
      break;
    case 'auditoria':
      tbody.innerHTML = data.map(r => `<tr><td>${r.dt}</td><td>${r.usuario}</td><td><span class="badge badge-blue">${r.acao}</span></td><td>${r.tela}</td><td>${r.registro||'—'}</td></tr>`).join('');
      break;
    default:
      tbody.innerHTML = data.map(r => `<tr><td class="text-mono">${r.protocolo}</td><td>${r.data}</td><td>${r.placa}</td><td>${r.motorista}</td><td>${badgeStatus(r.status)}</td></tr>`).join('');
  }
  registrarAuditoria('RELATÓRIO', 'Relatórios', APP.selectedRelType, '', `${data.length} registros`);
  showToast(`Relatório gerado: <strong>${data.length}</strong> registros.`, 'info');
}

function applyFilters(di, df, transp, mot, placa, status) {
  return function(r) {
    if (di && r.data && r.data < di) return false;
    if (df && r.data && r.data > df) return false;
    if (transp && !(r.transportadora||'').toLowerCase().includes(transp)) return false;
    if (mot && !(r.motorista||'').toLowerCase().includes(mot)) return false;
    if (placa && !(r.placa||'').includes(placa)) return false;
    if (status && r.status !== status) return false;
    return true;
  };
}

function exportarCSV() {
  const ci = load(KEYS.checkins);
  if (!ci.length) { showToast('Nenhum dado para exportar.', 'warn'); return; }
  const cols = ['protocolo','data','hora','placa','placaCarreta','modelo','motorista','cpf','cnh','categCNH','valCNH','transportadora','tipoCarga','peso','setor','responsavel','motivo','status','dtSaida','hrSaida','conferente','situacaoSaida','permanencia'];
  const header = cols.join(';');
  const rows   = ci.map(r => cols.map(c => `"${(r[c]||'').toString().replace(/"/g,'""')}"`).join(';'));
  const csv    = [header, ...rows].join('\n');
  const blob   = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `sacpl_export_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportação CSV concluída!', 'success');
}

function imprimirRelatorio() { window.print(); }

function clearRelFilter() {
  ['rel-di','rel-df','rel-transp','rel-mot','rel-placa','rel-tipoV','rel-status','rel-setor'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

/* ══════════════════════════════════════════════
   AUDITORIA
══════════════════════════════════════════════ */
function renderAuditoriaTable() {
  const aud   = load(KEYS.auditoria);
  const tbody = document.getElementById('audTbody');
  if (!tbody) return;
  const di   = (document.getElementById('aud-di') || {}).value || '';
  const df   = (document.getElementById('aud-df') || {}).value || '';
  const user = ((document.getElementById('aud-user')||{}).value||'').toLowerCase();
  const acao = ((document.getElementById('aud-acao')||{}).value||'').toLowerCase();
  const tela = ((document.getElementById('aud-tela')||{}).value||'').toLowerCase();
  let data = aud;
  if (di) data = data.filter(r => r.dt >= di);
  if (df) data = data.filter(r => r.dt <= df);
  if (user) data = data.filter(r => r.usuario.toLowerCase().includes(user));
  if (acao) data = data.filter(r => r.acao.toLowerCase().includes(acao));
  if (tela) data = data.filter(r => r.tela.toLowerCase().includes(tela));
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fa fa-inbox"></i> Nenhuma ação registrada.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="text-mono">${r.dt}</td>
      <td>${r.usuario}</td>
      <td><span class="badge badge-blue">${r.acao}</span></td>
      <td>${r.tela}</td>
      <td>${r.registro||'—'}</td>
      <td><small class="badge badge-red">${r.ant||'—'}</small></td>
      <td><small class="badge badge-green">${r.novo||'—'}</small></td>
    </tr>`).join('');
}

function limparAuditoria() {
  if (!confirm('Limpar todo o log de auditoria? Esta ação não pode ser desfeita.')) return;
  save(KEYS.auditoria, []);
  renderAuditoriaTable();
  showToast('Log de auditoria limpo.', 'warn');
}

function clearAudFilter() {
  ['aud-di','aud-df','aud-user','aud-acao','aud-tela'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderAuditoriaTable();
}

/* ══════════════════════════════════════════════
   CONFIGURAÇÕES
══════════════════════════════════════════════ */
function carregarConfiguracoes() {
  const cfg = loadObj(KEYS.config);
  const map = {
    'cfg-empresa': cfg.empresa || '',
    'cfg-cnpj':    cfg.cnpj || '',
    'cfg-end':     cfg.end || '',
    'cfg-logo':    cfg.logo || '',
    'cfg-tempo':   cfg.tempo || 8
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val;
  });
  const boolMap = {
    'cfg-alertas':  cfg.alertas !== false,
    'cfg-avancado': cfg.avancado === true,
    'cfg-excluir':  cfg.excluir !== false,
    'cfg-cnh':      cfg.exigirCNH !== false,
    'cfg-transp':   cfg.exigirTransp === true,
    'cfg-audit':    cfg.audit !== false,
    'cfg-confirm':  cfg.confirm !== false
  };
  Object.entries(boolMap).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.checked = val;
  });
}

function salvarConfiguracoes() {
  const cfg = {
    empresa:     document.getElementById('cfg-empresa').value.trim(),
    cnpj:        document.getElementById('cfg-cnpj').value.trim(),
    end:         document.getElementById('cfg-end').value.trim(),
    logo:        document.getElementById('cfg-logo').value.trim(),
    tema:        document.getElementById('cfg-tema').value,
    dens:        document.getElementById('cfg-dens').value,
    tempo:       parseInt(document.getElementById('cfg-tempo').value) || 8,
    alertas:     document.getElementById('cfg-alertas').checked,
    avancado:    document.getElementById('cfg-avancado').checked,
    excluir:     document.getElementById('cfg-excluir').checked,
    exigirCNH:   document.getElementById('cfg-cnh').checked,
    exigirTransp:document.getElementById('cfg-transp').checked,
    audit:       document.getElementById('cfg-audit').checked,
    confirm:     document.getElementById('cfg-confirm').checked
  };
  localStorage.setItem(KEYS.config, JSON.stringify(cfg));
  registrarAuditoria('CONFIGURAÇÃO', 'Configurações', '', '', 'Configurações salvas');
  showToast('Configurações salvas com sucesso!', 'success');
}

/* ══════════════════════════════════════════════
   MISC HELPERS
══════════════════════════════════════════════ */
function updateSidebarBadges() {
  const ag = load(KEYS.agendamentos);
  const oc = load(KEYS.ocorrencias);
  setTxt('agBadge', ag.filter(r => r.status === 'Agendado').length);
  setTxt('ocBadge', oc.filter(r => r.status === 'Aberta').length);
}

function addAlert(msg, type = 'info') {
  const list = document.getElementById('alertList');
  if (!list) return;
  const icons = { danger: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', ok: 'fa-circle-check', info: 'fa-circle-info' };
  const item = document.createElement('div');
  item.className = `alert-item ${type}`;
  item.innerHTML = `<i class="fa ${icons[type]||icons.info}"></i>${msg}`;
  list.prepend(item);
  // Keep max 8
  while (list.children.length > 8) list.removeChild(list.lastChild);
}

function populateDatalist() {
  // Populate datalists for autocomplete
  const tr = load(KEYS.transportadoras);
  const mo = load(KEYS.motoristas);
  const listTransp = document.getElementById('listTransp');
  const listMot    = document.getElementById('listMot');
  if (listTransp) listTransp.innerHTML = tr.map(t => `<option value="${t.nome}">`).join('');
  if (listMot)    listMot.innerHTML    = mo.map(m => `<option value="${m.nome}">`).join('');
}

/* ══════════════════════════════════════════════
   GLOBAL SEARCH
══════════════════════════════════════════════ */
function initGlobalSearch() {
  const inp = document.getElementById('globalSearch');
  if (!inp) return;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = inp.value.trim().toUpperCase();
      if (!q) return;
      const ci = load(KEYS.checkins);
      const found = ci.find(r => r.placa.includes(q) || r.protocolo.includes(q) || r.motorista.toUpperCase().includes(q));
      if (found) {
        navigateTo('checkin');
        setTimeout(() => {
          document.getElementById('filterCheckin').value = q;
          renderCheckinTable();
        }, 100);
        showToast(`Encontrado: ${found.protocolo} · ${found.placa}`, 'info');
      } else {
        showToast('Nenhum registro encontrado para essa busca.', 'warn');
      }
    }
  });
  // Ctrl+K shortcut
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      inp.focus();
      inp.select();
    }
  });
}

/* ══════════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════════ */
function initSidebarToggle() {
  const btn  = document.getElementById('sidebarToggle');
  const sb   = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');
  if (!btn || !sb || !main) return;
  btn.addEventListener('click', () => {
    sb.classList.toggle('collapsed');
    main.classList.toggle('expanded');
  });
}

/* ══════════════════════════════════════════════
   AUTO-FILL DATE/TIME ON CHECK-IN
══════════════════════════════════════════════ */
function initAutoDateTime() {
  const d = document.getElementById('ci-data');
  const h = document.getElementById('ci-hora');
  if (d && !d.value) d.value = todayStr();
  if (h && !h.value) h.value = timeStr();
}

/* ══════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════ */
document.getElementById('btnLogout')?.addEventListener('click', () => {
  if (confirm('Deseja sair do sistema?')) {
    registrarAuditoria('LOGOUT', 'Sistema', '', '', 'Sessão encerrada');
    showToast('Sessão encerrada. Até logo!', 'info');
    setTimeout(() => location.reload(), 1500);
  }
});

/* ══════════════════════════════════════════════
   SEED DEMO DATA (on first load)
══════════════════════════════════════════════ */
function seedDemoData() {
  if (localStorage.getItem('sacpl_seeded')) return;

  const transportadoras = [
    { id: gerarId(), nome: 'Transporte Rápido Ltda', cnpj: '12.345.678/0001-90', tel: '(11) 3333-4444', email: 'contato@transrapido.com.br', end: 'Av. Industrial, 1500 – SP', resp: 'Carlos Alberto', status: 'Ativa', obs: '', criadoEm: new Date().toISOString() },
    { id: gerarId(), nome: 'LogFlex Transportes', cnpj: '98.765.432/0001-01', tel: '(21) 2222-3333', email: 'ops@logflex.com.br', end: 'Rua do Porto, 300 – RJ', resp: 'Mariana Silva', status: 'Ativa', obs: '', criadoEm: new Date().toISOString() },
    { id: gerarId(), nome: 'NorteSul Cargas', cnpj: '11.223.344/0001-55', tel: '(51) 9876-5432', email: 'nortesul@cargas.com.br', end: 'Estrada RS-010 km 45 – RS', resp: 'João Pedro', status: 'Suspensa', obs: 'Verificar pendências fiscais', criadoEm: new Date().toISOString() }
  ];
  save(KEYS.transportadoras, transportadoras);

  const motoristas = [
    { id: gerarId(), nome: 'Antônio Ferreira da Silva', cpf: '123.456.789-00', cnh: 'CNH0001234', categ: 'E', valCNH: '2026-08-15', tel: '(11) 99999-0001', transp: 'Transporte Rápido Ltda', status: 'Liberado', obs: '', criadoEm: new Date().toISOString() },
    { id: gerarId(), nome: 'Roberto Mendes Neto', cpf: '987.654.321-00', cnh: 'CNH0009876', categ: 'E', valCNH: '2024-03-01', tel: '(21) 98888-0002', transp: 'LogFlex Transportes', status: 'Bloqueado', obs: 'CNH vencida – aguardando renovação', criadoEm: new Date().toISOString() },
    { id: gerarId(), nome: 'Marcos Oliveira Santos', cpf: '111.222.333-44', cnh: 'CNH0005555', categ: 'D', valCNH: '2027-01-20', tel: '(51) 97777-0003', transp: 'NorteSul Cargas', status: 'Liberado', obs: '', criadoEm: new Date().toISOString() }
  ];
  save(KEYS.motoristas, motoristas);

  const hoje = todayStr();
  const ontem = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
  const checkins = [
    { id: gerarId(), protocolo: 'CIN-260001', data: hoje, hora: '08:15', transportadora: 'Transporte Rápido Ltda', motorista: 'Antônio Ferreira da Silva', cpf: '123.456.789-00', cnh: 'CNH0001234', categCNH: 'E', valCNH: '2026-08-15', placa: 'ABC-1234', placaCarreta: 'XYZ-5678', modelo: 'Volvo FH 540', tipoVeiculo: 'Carreta', tipoCarga: 'Seco', peso: '24000', setor: 'Recebimento', responsavel: 'Ana Paula', motivo: 'Entrega de mercadoria', obs: 'Carga paletizada', status: 'Dentro da empresa', dtSaida: null, hrSaida: null, conferente: null, situacaoSaida: null, obsFinais: null, criadoEm: new Date().toISOString() },
    { id: gerarId(), protocolo: 'CIN-260002', data: hoje, hora: '09:42', transportadora: 'LogFlex Transportes', motorista: 'Marcos Oliveira Santos', cpf: '111.222.333-44', cnh: 'CNH0005555', categCNH: 'D', valCNH: '2027-01-20', placa: 'DEF-5678', placaCarreta: '', modelo: 'Scania R 450', tipoVeiculo: 'Truck', tipoCarga: 'Fracionado', peso: '12000', setor: 'Expedição', responsavel: 'Bruno Costa', motivo: 'Coleta de mercadoria', obs: '', status: 'Check-out realizado', dtSaida: hoje, hrSaida: '14:30', conferente: 'Bruno Costa', situacaoSaida: 'Normal', obsFinais: 'Saída sem pendências', permanencia: '4h 48min', criadoEm: new Date().toISOString() },
    { id: gerarId(), protocolo: 'CIN-260003', data: ontem, hora: '16:00', transportadora: 'NorteSul Cargas', motorista: 'Marcos Oliveira Santos', cpf: '111.222.333-44', cnh: 'CNH0005555', categCNH: 'D', valCNH: '2027-01-20', placa: 'GHI-9012', placaCarreta: 'JKL-3456', modelo: 'Mercedes Actros', tipoVeiculo: 'Carreta', tipoCarga: 'Granel', peso: '28000', setor: 'Almoxarifado', responsavel: 'Carla Souza', motivo: 'Entrega de mercadoria', obs: 'Carga de areia', status: 'Dentro da empresa', dtSaida: null, hrSaida: null, conferente: null, situacaoSaida: null, obsFinais: null, criadoEm: new Date().toISOString() }
  ];
  save(KEYS.checkins, checkins);

  const agendamentos = [
    { id: gerarId(), data: hoje, hora: '15:00', transp: 'Transporte Rápido Ltda', motorista: 'Antônio Ferreira da Silva', placa: 'ABC-1234', tipoCarga: 'Perecível', setor: 'Docas A', prioridade: 'Alta', obs: 'Carga refrigerada – urgente', status: 'Agendado', criadoEm: new Date().toISOString() },
    { id: gerarId(), data: hoje, hora: '17:30', transp: 'LogFlex Transportes', motorista: '', placa: '', tipoCarga: 'Seco', setor: 'Recebimento', prioridade: 'Normal', obs: '', status: 'Agendado', criadoEm: new Date().toISOString() }
  ];
  save(KEYS.agendamentos, agendamentos);

  const ocorrencias = [
    { id: gerarId(), tipo: 'CNH vencida', dt: ontem + 'T10:30', envolvidos: 'Roberto Mendes Neto', grav: 'Alta', status: 'Aberta', resp: 'Porteiro José', desc: 'Motorista apresentou CNH vencida desde março/2024. Entrada negada.', criadoEm: new Date().toISOString() }
  ];
  save(KEYS.ocorrencias, ocorrencias);

  registrarAuditoria('INICIALIZAÇÃO', 'Sistema', '', '', 'Dados de demonstração carregados');
  localStorage.setItem('sacpl_seeded', '1');
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Seed
  seedDemoData();

  // Navigation events
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page) navigateTo(page);
    });
  });

  // Sidebar
  initSidebarToggle();

  // Global search
  initGlobalSearch();

  // Auto date/time for check-in
  initAutoDateTime();

  // Load config
  carregarConfiguracoes();

  // Populate datalists
  populateDatalist();

  // Initial render
  refreshDashboard();
  updateSidebarBadges();

  // Auto-refresh dashboard every 60s
  setInterval(() => {
    if (APP.currentPage === 'dashboard') refreshDashboard();
  }, 60000);

  // Auto-refresh sidebar badges every 30s
  setInterval(updateSidebarBadges, 30000);
});
