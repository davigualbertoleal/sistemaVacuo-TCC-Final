// =============================================
//  SCRIPT engenheiro/supervisor - Sistema de Vacuo  (TSEA ENERGY)
//  Sensor XGZP6847D (-150~10 kPa)
//  API retorna valores em mBar (float)
// =============================================

const API_URL = `http://${window.location.hostname}:5000/api`;

let usuarioAtual = null;
let timerInterval = null;
let tempoDecorrido = 0;
let tempoLimite = 0;
let processoEmAndamento = false;
let dashboardCarregado = false;
let cicloAtualId = 1;
let modoEmergencia = false;

// Óleo
let intervaloOleo = null;
let nivelCheio = false;
let tempCoolingStarted = false;

let dadosOleo = {
    pressao: 0,
    temperatura: 60,
    nivel: 0,
    fluxo: 0
};

// Tubos e servos
const mangueiras = { 1: false, 2: false, 3: false };
const servos = { 1: 155, 2: 155, 3: 155 };

let dadosAtual = null;

const historicoVacuo = { labels: [], values: [] };
const historicoTemp = { labels: [], values: [] };

const SENSOR_MBAR_MIN = -150;
const SENSOR_MBAR_MAX = 10;

// =============================================
//  CONVERSAO PA -> mBar
// =============================================
function paParaMbar(pa) { return pa * 0.01; }

// =============================================
//  STORAGE SEGURO
// =============================================
const memStorage = {};

function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { memStorage[key] = value; }
}
function storageGet(key) {
    try { const v = localStorage.getItem(key); if (v !== null) return v; } catch { }
    return memStorage[key] ?? null;
}
function storageRemove(key) {
    try { localStorage.removeItem(key); } catch { }
    delete memStorage[key];
}

// =============================================
//  INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarTema(storageGet('tema') || 'dark');
    configurarToggleTema();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();
    // Dashboard só inicializa após receberContextoUsuario() chamado pelo C#
});

// =============================================
//  TEMA CLARO / ESCURO
// =============================================
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    storageSet('tema', tema);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = tema === 'dark' ? 'ESCURO' : 'CLARO';
    try {
        if (window.vacuoChart?.data?.datasets?.[0]) {
            const cor = tema === 'dark' ? '#c8c8d4' : '#3a3730';
            window.vacuoChart.data.datasets[0].borderColor = cor;
            window.vacuoChart.update();
        }
    } catch { }
}

function configurarToggleTema() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        const atual = document.documentElement.getAttribute('data-theme') || 'dark';
        aplicarTema(atual === 'dark' ? 'light' : 'dark');
    });
}

// =============================================
//  AGUARDA CHART.JS CARREGAR
// =============================================
function esperarChartJS(callback) {
    if (window.Chart) { callback(); return; }
    let tentativas = 0;
    const intervalo = setInterval(() => {
        tentativas++;
        if (window.Chart) { clearInterval(intervalo); callback(); }
        else if (tentativas > 50) { clearInterval(intervalo); callback(); }
    }, 100);
}

// =============================================
//  INTEGRAÇÃO WEBVIEW2
// =============================================
window.addEventListener('load', () => {
    if (window.chrome?.webview)
        window.chrome.webview.postMessage('dashboard_pronto');
});

// Recebe o ID real do ciclo do banco (chamado pelo C# apos IniciarNovoCiclo)
function receberCicloId(id) {
    cicloAtualId = id;
    console.log('Ciclo ID recebido do banco:', cicloAtualId);
}

function receberContextoUsuario(id, nome, papel) {
    usuarioAtual = id;
    try {
        localStorage.setItem('usuarioId', id);
        localStorage.setItem('usuarioNome', nome);
        localStorage.setItem('usuarioPapel', papel);
    } catch { }
    storageSet('usuarioNome', nome);
    const el = document.getElementById('usuarioLogado');
    if (el) el.textContent = `${id}  —  ${nome}`;
    if (!dashboardCarregado) {
        dashboardCarregado = true;
        esperarChartJS(() => inicializarDashboard());
    }
}

// =============================================
//  INICIALIZAR DASHBOARD
// =============================================
function inicializarDashboard() {
    configurarAbas();
    configurarMangueiras();
    configurarServos();
    inicializarGrafico();
    inicializarGraficoOleo();
    configurarBotoes();
    inicializarDrums();
    mostrarDadosIniciais();
    validarMangueiras();
    atualizarStatusValvulas();
}

function mostrarDadosIniciais() {
    ['infoPressao', 'pressaoValue', 'infoTemp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '--';
    });
    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = 'AGUARDANDO';
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';
    const timerLimitEl = document.getElementById('timerLimit');
    if (timerLimitEl) timerLimitEl.textContent = '';
    atualizarGauges(0, 0, 0, 0, 0);
    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`infoPressaoM${n}`);
        if (p) p.textContent = '--';
        const vp = document.getElementById(`valvePressure${n}`);
        const vf = document.getElementById(`valveFlow${n}`);
        if (vp) vp.textContent = '-- mBar';
        if (vf) vf.textContent = '-- LPM';
        const btn = document.getElementById(`btnMangueira${n}`);
        if (btn) { btn.classList.remove('conectada'); btn.textContent = `Tubo ${n}`; }
    });
}

// =============================================
//  GRÁFICOS
// =============================================
function inicializarGrafico() {
    try {
        const canvas = document.getElementById('vacuoChart');
        if (!canvas || !window.Chart) return;
        const ctx = canvas.getContext('2d');
        const tema = document.documentElement.getAttribute('data-theme') || 'dark';
        const corLinha = tema === 'dark' ? '#c8c8d4' : '#3a3730';
        window.vacuoChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Pressao (mBar)', data: [], borderColor: corLinha, borderWidth: 2, tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(200,200,212,0.06)', fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, plugins: { legend: { display: false } }, scales: { y: { min: SENSOR_MBAR_MIN, max: SENSOR_MBAR_MAX, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 9, family: 'IBM Plex Mono' } } }, x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 6 } } } }
        });
    } catch (e) { console.warn('Erro ao inicializar grafico vacuo:', e.message); window.vacuoChart = null; }
}

function inicializarGraficoOleo() {
    try {
        const canvas = document.getElementById('oleoChart');
        if (!canvas || !window.Chart) return;
        const ctx = canvas.getContext('2d');
        window.oleoChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Pressao Oleo (Bar)', data: [], borderColor: '#bd0202', borderWidth: 2, tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(189,2,2,0.12)', fill: true, yAxisID: 'yPressao' }, { label: 'Temperatura (C)', data: [], borderColor: '#e88a00', borderWidth: 2, tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(232,138,0,0.07)', fill: false, yAxisID: 'yTemp' }] },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, plugins: { legend: { display: true, labels: { color: '#888', font: { size: 9, family: 'IBM Plex Mono' }, boxWidth: 12, padding: 10 } } }, scales: { yPressao: { type: 'linear', position: 'left', min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#bd0202', font: { size: 9 } } }, yTemp: { type: 'linear', position: 'right', min: 20, max: 65, grid: { display: false }, ticks: { color: '#e88a00', font: { size: 9 } } }, x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 6 } } } }
        });
    } catch (e) { console.warn('Erro ao inicializar grafico oleo:', e.message); window.oleoChart = null; }
}

// =============================================
//  ABAS, MANGUEIRAS, SERVOS
// =============================================
function configurarAbas() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            button.classList.add('active');
            const tab = document.getElementById(tabName);
            if (tab) tab.classList.add('active');
        });
    });
}

function configurarMangueiras() {
    document.querySelectorAll('.mangueira-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = btn.getAttribute('data-mangueira');
            mangueiras[num] = !mangueiras[num];
            btn.classList.toggle('conectada', mangueiras[num]);
            btn.textContent = `Tubo ${num}`;
            validarMangueiras();
        });
    });
}

function configurarServos() {
    document.querySelectorAll('.servo-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = btn.getAttribute('data-servo');
            servos[num] = servos[num] === 80 ? 155 : 80;
            atualizarValvulaVisual(num, servos[num]);
        });
    });
}

function configurarBotoes() {
    document.getElementById('btnIniciar')?.addEventListener('click', abrirModalTimer);
    document.getElementById('btnEmergencia')?.addEventListener('click', emergencia);
    document.getElementById('btnRelatorio')?.addEventListener('click', gerarRelatorioMensal);

    // X = LOGOUT → volta para login.html
    document.getElementById('btnFechar')?.addEventListener('click', abrirModalLogout);

    document.getElementById('btnCancelarFechar')?.addEventListener('click', fecharModalFechar);
    document.getElementById('btnConfirmarFechar')?.addEventListener('click', fazerLogout);

    document.getElementById('btnCancelarTimer')?.addEventListener('click', fecharModalTimer);
    document.getElementById('btnConfirmarTimer')?.addEventListener('click', confirmarTimer);
    document.getElementById('btnFecharTempoEncerrado')?.addEventListener('click', fecharModalTempoEncerrado);
    document.getElementById('btnCancelarEmergencia')?.addEventListener('click', fecharModalDesativarEmergencia);
    document.getElementById('btnConfirmarDesativarEmergencia')?.addEventListener('click', desativarEmergencia);
}

// =============================================
//  MODAIS
// =============================================
function abrirModalLogout() { document.getElementById('modalFechar')?.classList.remove('hidden'); }
function fecharModalFechar() { document.getElementById('modalFechar')?.classList.add('hidden'); }
function mostrarModalTempoEncerrado() { document.getElementById('modalTempoEncerrado')?.classList.remove('hidden'); }
function fecharModalTempoEncerrado() { document.getElementById('modalTempoEncerrado')?.classList.add('hidden'); }
function abrirModalDesativarEmergencia() { document.getElementById('modalDesativarEmergencia')?.classList.remove('hidden'); }
function fecharModalDesativarEmergencia() { document.getElementById('modalDesativarEmergencia')?.classList.add('hidden'); }

// =============================================
//  LOGOUT
// =============================================
function fazerLogout() {
    // Para processos em andamento
    if (processoEmAndamento) pararProcesso();
    pararSimulacaoOleo();

    // Limpa estado
    usuarioAtual = null;
    dashboardCarregado = false;
    modoEmergencia = false;
    try {
        localStorage.removeItem('usuarioId');
        localStorage.removeItem('usuarioNome');
        localStorage.removeItem('usuarioPapel');
    } catch { }

    // Volta para login via C# ou direto no browser
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage('logout');
    } else {
        window.location.href = 'login.html';
    }
}

// =============================================
//  DRUM PICKER
// =============================================
const drumState = { horas: 0, minutos: 0, segundos: 0 };

function criarDrum(elId, max, loop) {
    const el = document.getElementById(elId);
    if (!el) return;
    const ITEM_H = 36, VISIBLE = 3;
    let current = 0, startY = 0, isDragging = false, startOffset = 0, currentOffset = 0;
    const count = max + 1;
    el.innerHTML = '';
    for (let i = 0; i < VISIBLE; i++) { const p = document.createElement('div'); p.className = 'drum-item'; el.appendChild(p); }
    for (let i = 0; i <= max; i++) { const item = document.createElement('div'); item.className = 'drum-item'; item.textContent = String(i).padStart(2, '0'); if (i === 0) item.classList.add('selected'); el.appendChild(item); }
    for (let i = 0; i < VISIBLE; i++) { const p = document.createElement('div'); p.className = 'drum-item'; el.appendChild(p); }

    function getOffset(index) { return -(index + VISIBLE) * ITEM_H + (120 / 2) - ITEM_H / 2; }
    function snapTo(index, animate) {
        if (loop) current = ((index % count) + count) % count;
        else current = Math.max(0, Math.min(max, index));
        el.style.transition = animate ? 'transform 0.18s ease' : 'none';
        el.style.transform = `translateY(${getOffset(current)}px)`;
        el.querySelectorAll('.drum-item').forEach((item, i) => { item.classList.toggle('selected', i === current + VISIBLE); });
        if (elId === 'drumHoras') drumState.horas = current;
        if (elId === 'drumMinutos') drumState.minutos = current;
        if (elId === 'drumSegundos') drumState.segundos = current;
    }
    snapTo(0, false);
    el.parentElement.addEventListener('mousedown', (e) => { isDragging = true; startY = e.clientY; startOffset = getOffset(current); el.style.transition = 'none'; e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (!isDragging) return; currentOffset = startOffset + (e.clientY - startY); el.style.transform = `translateY(${currentOffset}px)`; });
    window.addEventListener('mouseup', (e) => { if (!isDragging) return; isDragging = false; snapTo(current + Math.round(-(e.clientY - startY) / ITEM_H), true); });
    el.parentElement.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; startOffset = getOffset(current); el.style.transition = 'none'; }, { passive: true });
    el.parentElement.addEventListener('touchmove', (e) => { currentOffset = startOffset + (e.touches[0].clientY - startY); el.style.transform = `translateY(${currentOffset}px)`; }, { passive: true });
    el.parentElement.addEventListener('touchend', (e) => { snapTo(current + Math.round(-(e.changedTouches[0].clientY - startY) / ITEM_H), true); });
    el.parentElement.addEventListener('wheel', (e) => { e.preventDefault(); snapTo(current + (e.deltaY > 0 ? 1 : -1), true); }, { passive: false });
    return { snapTo };
}

let drumInstances = {};
function inicializarDrums() {
    drumInstances.horas = criarDrum('drumHoras', 99, false);
    drumInstances.minutos = criarDrum('drumMinutos', 59, true);
    drumInstances.segundos = criarDrum('drumSegundos', 59, true);
}
function resetarDrums() {
    drumInstances.horas?.snapTo(0, false);
    drumInstances.minutos?.snapTo(0, false);
    drumInstances.segundos?.snapTo(0, false);
    drumState.horas = drumState.minutos = drumState.segundos = 0;
}

// =============================================
//  MODAL TIMER
// =============================================
function abrirModalTimer() { resetarDrums(); document.getElementById('modalTimer')?.classList.remove('hidden'); }
function fecharModalTimer() { document.getElementById('modalTimer')?.classList.add('hidden'); }
function confirmarTimer() {
    tempoLimite = (drumState.horas * 3600) + (drumState.minutos * 60) + drumState.segundos;
    if (tempoLimite <= 0) {
        const hint = document.getElementById('drumHint');
        if (hint) { hint.textContent = 'Defina um tempo antes de iniciar.'; hint.style.display = 'block'; setTimeout(() => { hint.style.display = 'none'; }, 3000); }
        return;
    }
    fecharModalTimer();
    iniciarProcesso();
}

// =============================================
//  MANGUEIRAS / VÁLVULAS
// =============================================
function validarMangueiras() { validarBotaoIniciar(); }
function atualizarStatusValvulas() { [1, 2, 3].forEach(n => atualizarValvulaVisual(n, servos[n])); validarBotaoIniciar(); }

function validarBotaoIniciar() {
    const btnIniciar = document.getElementById('btnIniciar');
    if (!btnIniciar) return;
    const umConectado = mangueiras[1] || mangueiras[2] || mangueiras[3];
    const umaAberta = servos[1] === 80 || servos[2] === 80 || servos[3] === 80;
    btnIniciar.disabled = !(umConectado && umaAberta);
}

function atualizarValvulaVisual(num, angulo) {
    const angleEl = document.getElementById(`valveAngle${num}`);
    const angleTxtEl = document.getElementById(`valveAngleTxt${num}`);
    const indicatorEl = document.getElementById(`valveIndicator${num}`);
    const pressureEl = document.getElementById(`valvePressure${num}`);
    const flowEl = document.getElementById(`valveFlow${num}`);
    const statusEl = document.getElementById(`valveStatus${num}`);

    const isAberta = angulo <= 100;
    const status = isAberta ? 'ABERTA' : 'FECHADA';

    if (angleEl) angleEl.textContent = angulo + '\u00B0';
    if (angleTxtEl) angleTxtEl.textContent = angulo + '\u00B0';
    if (indicatorEl) indicatorEl.style.transform = `rotate(${angulo}deg)`;
    if (!processoEmAndamento) { if (pressureEl) pressureEl.textContent = '-- mBar'; if (flowEl) flowEl.textContent = '-- LPM'; }
    if (statusEl) { statusEl.textContent = status; statusEl.className = 'valve-status ' + (isAberta ? 'on' : 'off'); }

    const panel = document.getElementById(`btnServo${num}`)?.closest('.valve-panel');
    if (panel) {
        const svgContainer = panel.querySelector('.valve-visual');
        if (svgContainer) {
            const svg = svgContainer.querySelector('svg');
            if (svg) {
                const valveColor = isAberta ? 'var(--valve-open)' : 'var(--valve-closed)';
                svg.querySelectorAll('rect').forEach(r => { if (r.getAttribute('stroke') !== 'none') r.style.stroke = valveColor; });
                svg.querySelectorAll('line').forEach(l => l.style.stroke = valveColor);
                svg.querySelectorAll('circle').forEach(c => { if (c.getAttribute('stroke') !== 'none') c.style.stroke = valveColor; });
                svg.querySelectorAll('text').forEach(t => t.style.fill = valveColor);
            }
        }
    }
    validarBotaoIniciar();
}

// =============================================
//  PROCESSO E TIMER
// =============================================
async function iniciarProcesso() {
    if (!mangueiras[1] && !mangueiras[2] && !mangueiras[3]) { alert('Conecte pelo menos 1 tubo para iniciar!'); return; }
    if (servos[1] !== 80 && servos[2] !== 80 && servos[3] !== 80) { alert('Abra pelo menos 1 valvula para iniciar!'); return; }

    processoEmAndamento = true;
    tempoDecorrido = 0;
    nivelCheio = false;
    tempCoolingStarted = false;

    // Registra o ciclo na API e dispara o email
    try {
        const res = await fetch(`${API_URL}/ciclo/iniciar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operadorId: parseInt(usuarioAtual) || 0 })
        });
        if (res.ok) {
            const data = await res.json();
            cicloAtualId = data.cicloId;
            console.log('Ciclo registrado:', cicloAtualId);
        }
    } catch (err) {
        console.warn('Erro ao registrar ciclo:', err.message);
    }

    dadosOleo = { pressao: 0, temperatura: 60, nivel: 0, fluxo: 0 };
    historicoVacuo.labels = []; historicoVacuo.values = [];
    historicoTemp.labels = []; historicoTemp.values = [];

    document.getElementById('btnIniciar').disabled = true;

    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'PROCESSANDO'; statusEl.style.color = ''; }
    document.getElementById('timerLimit').textContent = '';

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) {
        const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
        const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
        const ls = (tempoLimite % 60).toString().padStart(2, '0');
        timerEl.textContent = `${lh}:${lm}:${ls}`;
    }

    if (window.vacuoChart) { window.vacuoChart.data.labels = []; window.vacuoChart.data.datasets[0].data = []; window.vacuoChart.update(); }
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        tempoDecorrido++;
        const restante = Math.max(tempoLimite - tempoDecorrido, 0);
        const h = Math.floor(restante / 3600).toString().padStart(2, '0');
        const m = Math.floor((restante % 3600) / 60).toString().padStart(2, '0');
        const s = (restante % 60).toString().padStart(2, '0');
        const tEl = document.getElementById('timerDisplay');
        if (tEl) tEl.textContent = `${h}:${m}:${s}`;

        if (tempoDecorrido >= tempoLimite) {
            pararProcesso();
            document.getElementById('timerDisplay').textContent = '00:00:00';
            const sEl2 = document.getElementById('status-estado');
            if (sEl2) { sEl2.textContent = 'CONCLUIDO'; sEl2.style.color = 'var(--green)'; }
            document.getElementById('timerLimit').textContent = 'TEMPO ENCERRADO';
            gerarRelatorioPDF(false);
            mostrarModalTempoEncerrado();
        }
    }, 1000);

    if (window.apiInterval) clearInterval(window.apiInterval);
    window.apiInterval = setInterval(buscarDadosDaAPI, 1000);

    // ← CORREÇÃO: óleo só começa aqui, junto com o processo
    iniciarSimulacaoOleo();

    console.log('Processo iniciado. Limite:', tempoLimite + 's');
}

function pararProcesso(motivo = null) {
    processoEmAndamento = false;
    if (timerInterval) clearInterval(timerInterval);
    if (window.apiInterval) clearInterval(window.apiInterval);
    pararSimulacaoOleo();

    // Encerra o ciclo na API
    if (cicloAtualId) {
        const url = motivo
            ? `${API_URL}/ciclo/${cicloAtualId}/parar?motivo=${motivo}`
            : `${API_URL}/ciclo/${cicloAtualId}/parar`;
        fetch(url, { method: 'POST' }).catch(() => { });
    }

    document.getElementById('btnIniciar').disabled = false;
    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'OPERACIONAL'; statusEl.style.color = ''; }
    const status = document.getElementById('oleoEstado');
    if (status) status.textContent = 'CONCLUIDO';
}

// =============================================
//  EMERGÊNCIA
// =============================================
function emergencia() {
    if (modoEmergencia) { abrirModalDesativarEmergencia(); return; }

    modoEmergencia = true;
    const snaphotDados = dadosAtual ? { ...dadosAtual } : null;
    pararProcesso("EMERGENCIA");
    pararSimulacaoOleo();
    gerarRelatorioPDF(true, snaphotDados);

    tempoDecorrido = tempoLimite = 0;
    document.getElementById('timerDisplay').textContent = '00:00:00';
    document.getElementById('timerLimit').textContent = '';

    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'EMERGENCIA'; statusEl.style.color = 'var(--accent)'; }

    servos[1] = servos[2] = servos[3] = 155;
    [1, 2, 3].forEach(n => atualizarValvulaVisual(n, 155));
    mostrarDadosIniciais();
    bloquearInterface(true);

    const btnEmergencia = document.getElementById('btnEmergencia');
    if (btnEmergencia) { btnEmergencia.textContent = 'DESATIVAR EMERGENCIA'; btnEmergencia.classList.add('btn-emergency-ativa'); }
    console.log('EMERGENCIA ATIVADA');
}

function bloquearInterface(bloquear) {
    const opacity = bloquear ? '0.3' : '';
    document.querySelectorAll('.mangueira-button, .servo-button').forEach(btn => { btn.disabled = bloquear; btn.style.opacity = opacity; btn.style.cursor = bloquear ? 'not-allowed' : ''; });
    ['btnIniciar', 'btnRelatorio'].forEach(id => { const el = document.getElementById(id); if (el) { el.disabled = bloquear; el.style.opacity = opacity; } });
    document.querySelectorAll('.tab-button').forEach(btn => { btn.style.pointerEvents = bloquear ? 'none' : ''; btn.style.opacity = opacity; });
}

function desativarEmergencia() {
    modoEmergencia = false;
    fecharModalDesativarEmergencia();
    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'OPERACIONAL'; statusEl.style.color = ''; }
    const btnEmergencia = document.getElementById('btnEmergencia');
    if (btnEmergencia) { btnEmergencia.textContent = 'EMERGENCIA'; btnEmergencia.classList.remove('btn-emergency-ativa'); }
    bloquearInterface(false);
    validarBotaoIniciar();
    console.log('EMERGENCIA DESATIVADA');
}

// =============================================
//  GAUGES
// =============================================
function atualizarGauges(temp, fluxo1, fluxo2, fluxo3, diferencial) {
    const ag = (barId, valId, pct, texto) => { const b = document.getElementById(barId); const v = document.getElementById(valId); if (b) b.style.height = Math.min(pct, 100) + '%'; if (v) v.textContent = texto; };
    ag('gaugeBar2', 'gaugeValue2', (temp / 100) * 100, temp.toFixed(1) + ' C');
    ag('gaugeBar3', 'gaugeValue3', (fluxo1 / 20) * 100, fluxo1.toFixed(1) + ' LPM');
    ag('gaugeBar4', 'gaugeValue4', (fluxo2 / 20) * 100, fluxo2.toFixed(1) + ' LPM');
    ag('gaugeBar5', 'gaugeValue5', (fluxo3 / 20) * 100, fluxo3.toFixed(1) + ' LPM');
    ag('gaugeBar6', 'gaugeValue6', (Math.abs(diferencial) / 5) * 100, diferencial.toFixed(2) + ' mBar');
}

// =============================================
//  API
// =============================================
async function buscarDadosDaAPI() {
    if (!processoEmAndamento) return;
    try {
        const response = await fetch(`${API_URL}/leiturasSensores?limit=1`);
        if (!response.ok) return;
        const leituras = await response.json();
        if (!leituras || leituras.length === 0) return;
        const leitura = leituras[0];
        dadosAtual = {
            cicloId: leitura.cicloId || 1,
            estadoMaquina: leitura.estadoMaquina || 'Ligado',
            pressaoCamaraMbar: parseFloat(leitura.pressaoCamaraMbar) || 0,
            pressaoTubo1Mbar: parseFloat(leitura.pressaoTubo1Mbar) || 0,
            fluxoTubo1LPM: parseFloat(leitura.fluxoTubo1LPM) || 0,
            pressaoTubo2Mbar: parseFloat(leitura.pressaoTubo2Mbar) || 0,
            fluxoTubo2LPM: parseFloat(leitura.fluxoTubo2LPM) || 0,
            pressaoTubo3Mbar: parseFloat(leitura.pressaoTubo3Mbar) || 0,
            fluxoTubo3LPM: parseFloat(leitura.fluxoTubo3LPM) || 0,
            temperaturaOleo: parseFloat(leitura.temperaturaOleo) || 0,
            bombaLigada: leitura.bombaLigada ?? true,
            valvulaAberta: leitura.valvulaAberta ?? true,
            servoAngulo: leitura.servoAngulo || 0
        };
        atualizarDados(dadosAtual);
    } catch (error) { console.error('Erro API:', error.message); }
}

// =============================================
//  ATUALIZAR DASHBOARD
// =============================================
function atualizarDados(dados) {
    if (!processoEmAndamento) return;

    const infoPressaoEl = document.getElementById('infoPressao');
    const pressaoValueEl = document.getElementById('pressaoValue');
    if (infoPressaoEl) infoPressaoEl.textContent = dados.pressaoCamaraMbar.toFixed(2);
    if (pressaoValueEl) pressaoValueEl.textContent = dados.pressaoCamaraMbar.toFixed(2) + ' mBar';

    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = dados.temperaturaOleo.toFixed(1);

    [1, 2, 3].forEach(n => { const el = document.getElementById(`infoPressaoM${n}`); if (el) el.textContent = dados[`pressaoTubo${n}Mbar`].toFixed(2); });

    const p = dados.pressaoCamaraMbar;
    const fase = p < -600 ? 'SUCCAO' : p <= -200 ? 'ESTAVEL' : 'PRESSAO BAIXA';
    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = fase;

    if (window.vacuoChart) {
        const agora = new Date().toLocaleTimeString();
        window.vacuoChart.data.labels.push(agora);
        window.vacuoChart.data.datasets[0].data.push(dados.pressaoCamaraMbar);
        if (window.vacuoChart.data.labels.length > 60) { window.vacuoChart.data.labels.shift(); window.vacuoChart.data.datasets[0].data.shift(); }
        window.vacuoChart.update();
        historicoVacuo.labels.push(agora);
        historicoVacuo.values.push(dados.pressaoCamaraMbar);
    }

    const pressoes = [dados.pressaoTubo1Mbar, dados.pressaoTubo2Mbar, dados.pressaoTubo3Mbar];
    const diferencial = Math.max(...pressoes) - Math.min(...pressoes);
    atualizarGauges(dados.temperaturaOleo, dados.fluxoTubo1LPM, dados.fluxoTubo2LPM, dados.fluxoTubo3LPM, diferencial);
    atualizarSistemaOleo();

    [1, 2, 3].forEach(n => {
        const pEl = document.getElementById(`valvePressure${n}`);
        const fEl = document.getElementById(`valveFlow${n}`);
        if (pEl) pEl.textContent = dados[`pressaoTubo${n}Mbar`].toFixed(1) + ' mBar';
        if (fEl) fEl.textContent = dados[`fluxoTubo${n}LPM`].toFixed(1) + ' LPM';
    });
}

// =============================================
//  SIMULADOR ÓLEO — só roda dentro do processo
// =============================================
function iniciarSimulacaoOleo() {
    if (intervaloOleo) clearInterval(intervaloOleo);

    if (window.oleoChart) {
        window.oleoChart.data.labels = [];
        window.oleoChart.data.datasets[0].data = [];
        window.oleoChart.data.datasets[1].data = [];
        window.oleoChart.update();
    }

    dadosOleo.temperatura = 60;
    dadosOleo.nivel = 0;
    dadosOleo.pressao = 0;
    nivelCheio = false;
    tempCoolingStarted = false;

    const tempoNivelCheio = tempoLimite * 0.60;
    const duracaoResfriamento = tempoLimite * 0.10;

    intervaloOleo = setInterval(() => {
        // ← CORREÇÃO: guarda só se processo em andamento
        if (!processoEmAndamento) return;

        dadosOleo.pressao = Math.min(dadosOleo.pressao + Math.random() * 0.25 + 0.05, 10);

        if (!nivelCheio) {
            const incremento = (100 / tempoNivelCheio) + (Math.random() * 0.3 - 0.15);
            dadosOleo.nivel = Math.min(dadosOleo.nivel + incremento, 100);
            if (dadosOleo.nivel >= 100) { dadosOleo.nivel = 100; nivelCheio = true; tempCoolingStarted = true; }
        } else {
            dadosOleo.nivel = 100;
        }

        if (!tempCoolingStarted) {
            dadosOleo.temperatura = 60 + (Math.random() * 0.4 - 0.2);
        } else {
            const tempoResfriando = tempoDecorrido - tempoNivelCheio;
            if (tempoResfriando <= 0) { dadosOleo.temperatura = 60; }
            else if (tempoResfriando >= duracaoResfriamento) { dadosOleo.temperatura = 25; }
            else {
                const progresso = tempoResfriando / duracaoResfriamento;
                dadosOleo.temperatura = Math.max(25, Math.min(60, 60 - (60 - 25) * progresso + (Math.random() * 0.4 - 0.2)));
            }
        }

        dadosOleo.fluxo = Math.random() * 8 + 14;
        atualizarSistemaOleo();
    }, 1000);
}

function pararSimulacaoOleo() {
    if (intervaloOleo) { clearInterval(intervaloOleo); intervaloOleo = null; }
}

// =============================================
//  ATUALIZAR UI ÓLEO
// =============================================
function atualizarSistemaOleo() {
    if (!processoEmAndamento) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('oleoPressao', dadosOleo.pressao.toFixed(1));
    set('oleoNivel', dadosOleo.nivel.toFixed(1));
    set('oleoTemp', dadosOleo.temperatura.toFixed(1));
    set('oleoEstado', tempoDecorrido >= tempoLimite ? 'CONCLUIDO' : 'OPERANDO');

    const oilFill = document.getElementById('oilFill');
    const oilPercent = document.getElementById('oilPercent');
    if (oilFill) oilFill.style.height = dadosOleo.nivel + '%';
    if (oilPercent) oilPercent.textContent = dadosOleo.nivel.toFixed(0) + '%';

    const tempRatio = Math.max(0, Math.min(1, (dadosOleo.temperatura - 25) / (60 - 25)));
    const r = Math.round(107 + (189 - 107) * tempRatio);
    if (oilFill) { oilFill.style.background = `linear-gradient(to top, rgb(${Math.max(60, r - 30)},2,2), rgb(${Math.min(255, r + 30)},2,2))`; }

    const filtro = document.getElementById('oleoFiltro');
    if (filtro) filtro.textContent = dadosOleo.nivel < 30 ? 'CRITICO' : dadosOleo.nivel < 60 ? 'ATENCAO' : 'NORMAL';

    const hora = new Date().toLocaleTimeString();
    historicoTemp.labels.push(hora);
    historicoTemp.values.push(dadosOleo.temperatura);

    if (window.oleoChart) {
        window.oleoChart.data.labels.push(hora);
        window.oleoChart.data.datasets[0].data.push(dadosOleo.pressao);
        window.oleoChart.data.datasets[1].data.push(dadosOleo.temperatura);
        if (window.oleoChart.data.labels.length > 60) { window.oleoChart.data.labels.shift(); window.oleoChart.data.datasets[0].data.shift(); window.oleoChart.data.datasets[1].data.shift(); }
        window.oleoChart.update();
    }
}

// =============================================
//  HISTÓRICO
// =============================================
function salvarCicloNoHistorico(emergencia = false) {
    const agora = new Date();
    const chave = `ciclos_vacuo_${agora.getFullYear()}_${String(agora.getMonth() + 1).padStart(2, '0')}`;
    let ciclos = [];
    try { ciclos = JSON.parse(storageGet(chave) || '[]'); } catch { }

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');

    ciclos.push({
        id: cicloAtualId, emergencia,
        operador: usuarioAtual || 'Nao identificado',
        dataHora: agora.toLocaleString('pt-BR'),
        tempoOperacao: `${lh}:${lm}:${ls}`,
        pressaoCamara: dadosAtual ? dadosAtual.pressaoCamaraMbar.toFixed(2) : '--',
        pressaoT1: dadosAtual ? dadosAtual.pressaoTubo1Mbar.toFixed(2) : '--',
        fluxoT1: dadosAtual ? dadosAtual.fluxoTubo1LPM.toFixed(1) : '--',
        pressaoT2: dadosAtual ? dadosAtual.pressaoTubo2Mbar.toFixed(2) : '--',
        fluxoT2: dadosAtual ? dadosAtual.fluxoTubo2LPM.toFixed(1) : '--',
        pressaoT3: dadosAtual ? dadosAtual.pressaoTubo3Mbar.toFixed(2) : '--',
        fluxoT3: dadosAtual ? dadosAtual.fluxoTubo3LPM.toFixed(1) : '--',
        temperatura: dadosAtual ? dadosAtual.temperaturaOleo?.toFixed(1) : dadosOleo.temperatura.toFixed(1),
        tubo1: mangueiras[1] ? 'CONECTADO' : 'DESCONECTADO',
        tubo2: mangueiras[2] ? 'CONECTADO' : 'DESCONECTADO',
        tubo3: mangueiras[3] ? 'CONECTADO' : 'DESCONECTADO',
        servo: dadosAtual ? dadosAtual.servoAngulo + ' graus' : '--',
        graficoPressaoLabels: [...historicoVacuo.labels],
        graficoPressaoValues: [...historicoVacuo.values],
        graficoTempLabels: [...historicoTemp.labels],
        graficoTempValues: [...historicoTemp.values],
        graficoOleoLabels: window.oleoChart ? [...window.oleoChart.data.labels] : [],
        graficoOleoValues: window.oleoChart ? [...window.oleoChart.data.datasets[0].data] : [],
    });

    storageSet(chave, JSON.stringify(ciclos));
    cicloAtualId++;
}

// =============================================
//  HELPER: gráfico no PDF
// =============================================
function desenharGraficoPDF(doc, x, y, w, h, labels, values, yMin, yMax, titulo, corLinha) {
    corLinha = corLinha || [50, 80, 180];
    doc.setFillColor(248, 248, 248); doc.rect(x, y, w, h, 'F');
    doc.setDrawColor(210, 210, 210); doc.rect(x, y, w, h);
    doc.setFontSize(7); doc.setTextColor(90, 90, 90); doc.text(titulo, x + 2, y + 5);
    if (!values || values.length < 2) { doc.setFontSize(7); doc.setTextColor(150); doc.text('Sem dados registrados', x + w / 2, y + h / 2, { align: 'center' }); return; }
    const padL = 8, padR = 4, padT = 9, padB = 9, gW = w - padL - padR, gH = h - padT - padB, range = yMax - yMin || 1;
    doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.15);
    for (let i = 0; i <= 3; i++) { const gy = y + padT + (i / 3) * gH; doc.line(x + padL, gy, x + padL + gW, gy); doc.setFontSize(5); doc.setTextColor(150); doc.text((yMax - (i / 3) * range).toFixed(0), x + padL - 1, gy + 1, { align: 'right' }); }
    doc.setDrawColor(...corLinha); doc.setLineWidth(0.5);
    const pts = values.map((v, i) => ({ px: x + padL + (i / (values.length - 1)) * gW, py: y + padT + gH - ((Math.min(Math.max(v, yMin), yMax) - yMin) / range) * gH }));
    for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1].px, pts[i - 1].py, pts[i].px, pts[i].py);
    doc.setFontSize(5); doc.setTextColor(130);
    [0, Math.floor((values.length - 1) / 2), values.length - 1].forEach(idx => { if (labels[idx]) { const px = x + padL + (idx / (values.length - 1)) * gW; doc.text(labels[idx], px, y + padT + gH + 5, { align: 'center' }); } });
}

// =============================================
//  HELPER: enviar PDF para API
// =============================================
async function enviarPDFParaAPI(doc, filename) {
    try {
        const pdfBlob = doc.output('blob');
        const formData = new FormData();
        formData.append('file', pdfBlob, filename);
        const response = await fetch(`${API_URL}/relatorios/upload`, { method: 'POST', body: formData });
        if (response.ok) { const data = await response.json(); console.log('PDF enviado para S3:', data.url || filename); }
        else console.warn('Falha ao enviar PDF:', response.status);
    } catch (err) { console.warn('Erro ao enviar PDF (ignorado):', err.message); }
}

// =============================================
//  RELATÓRIO PDF
// =============================================
async function gerarRelatorioPDF(isEmergencia = false, snapshotDados = null) {
    if (!window.jspdf) { console.warn('jsPDF nao carregou.'); return; }
    salvarCicloNoHistorico(isEmergencia);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const corHeader = isEmergencia ? [160, 10, 10] : [18, 18, 20];
    doc.setFillColor(...corHeader); doc.rect(0, 0, 210, 44, 'F');
    doc.setTextColor(232, 232, 232); doc.setFontSize(isEmergencia ? 16 : 17);
    if (isEmergencia) { doc.setFont(undefined, 'bold'); doc.text('*** RELATORIO DE EMERGENCIA ***', 105, 13, { align: 'center' }); doc.setFont(undefined, 'normal'); doc.text('SISTEMA DE VACUO - TSEA ENERGY', 105, 22, { align: 'center' }); }
    else { doc.text('RELATORIO - SISTEMA DE VACUO', 105, 14, { align: 'center' }); doc.setFontSize(10); doc.setTextColor(170, 170, 170); doc.text('TSEA Energy', 105, 24, { align: 'center' }); }
    doc.setFontSize(10); doc.setTextColor(170, 170, 170);
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 105, isEmergencia ? 30 : 31, { align: 'center' });
    if (isEmergencia) { doc.setTextColor(255, 180, 180); doc.text('PROCESSO INTERROMPIDO POR EMERGENCIA', 105, 38, { align: 'center' }); }

    let y = 54;
    doc.setTextColor(0, 0, 0);
    if (isEmergencia) { doc.setFillColor(255, 228, 228); doc.rect(15, y - 3, 180, 9, 'F'); doc.setFont(undefined, 'bold'); doc.setTextColor(150, 0, 0); doc.setFontSize(10); doc.text('EMERGENCIA ATIVADA — CICLO INTERROMPIDO', 105, y + 3, { align: 'center' }); doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); y += 14; }

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');
    const dadosRef = snapshotDados || dadosAtual;

    doc.setFontSize(12); doc.text('DADOS DO CICLO', 20, y); y += 10; doc.setFontSize(10);
    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, y); y += 7;
    doc.text(`Ciclo ID: ${cicloAtualId}`, 20, y); y += 7;
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 20, y); y += 7;
    doc.text(`Tempo de Operacao: ${lh}:${lm}:${ls}`, 20, y); y += 7;
    const statusEl = document.getElementById('status-estado');
    doc.text(`Estado: ${statusEl ? statusEl.textContent : '--'}`, 20, y); y += 7;
    if (isEmergencia) { doc.setFont(undefined, 'bold'); doc.setTextColor(150, 0, 0); doc.text('Motivo de encerramento: EMERGENCIA', 20, y); doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); }
    y += 12;

    doc.setFontSize(12); doc.text('PRESSOES E FLUXOS', 20, y); y += 10; doc.setFontSize(10);
    if (dadosRef) {
        doc.text(`Camara: ${dadosRef.pressaoCamaraMbar.toFixed(2)} mBar`, 20, y); y += 7;
        doc.text(`Tubo 1: ${dadosRef.pressaoTubo1Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosRef.fluxoTubo1LPM.toFixed(1)} LPM`, 20, y); y += 7;
        doc.text(`Tubo 2: ${dadosRef.pressaoTubo2Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosRef.fluxoTubo2LPM.toFixed(1)} LPM`, 20, y); y += 7;
        doc.text(`Tubo 3: ${dadosRef.pressaoTubo3Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosRef.fluxoTubo3LPM.toFixed(1)} LPM`, 20, y); y += 7;
        doc.text(`Temperatura Oleo: ${dadosRef.temperaturaOleo ? dadosRef.temperaturaOleo.toFixed(1) : dadosOleo.temperatura.toFixed(1)} C`, 20, y); y += 7;
    } else { doc.text('Nenhum dado disponivel.', 20, y); y += 7; }
    y += 5;

    doc.setFontSize(12); doc.text('STATUS DOS COMPONENTES', 20, y); y += 10; doc.setFontSize(10);
    doc.text(`Bomba: ${dadosRef ? (dadosRef.bombaLigada ? 'LIGADA' : 'DESLIGADA') : '--'}`, 20, y); y += 7;
    doc.text(`Servo: ${dadosRef ? dadosRef.servoAngulo + ' graus' : '--'}`, 20, y); y += 7;
    doc.text(`Tubo 1: ${mangueiras[1] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 7;
    doc.text(`Tubo 2: ${mangueiras[2] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 7;
    doc.text(`Tubo 3: ${mangueiras[3] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 14;

    doc.setFontSize(12); doc.setTextColor(0); doc.text('GRAFICOS DO CICLO', 20, y); y += 8;
    if (y + 55 > 270) { doc.addPage(); y = 20; }
    desenharGraficoPDF(doc, 15, y, 180, 50, historicoVacuo.labels, historicoVacuo.values, SENSOR_MBAR_MIN, SENSOR_MBAR_MAX, 'Pressao Camara (mBar)', [50, 80, 180]); y += 58;
    if (y + 55 > 270) { doc.addPage(); y = 20; }
    const oleoLabels = window.oleoChart ? window.oleoChart.data.labels : [];
    const oleoValues = window.oleoChart ? window.oleoChart.data.datasets[0].data : [];
    desenharGraficoPDF(doc, 15, y, 87, 50, oleoLabels, oleoValues, 0, 10, 'Pressao Oleo (Bar)', [189, 2, 2]);
    desenharGraficoPDF(doc, 108, y, 87, 50, historicoTemp.labels, historicoTemp.values, 20, 65, 'Temperatura Oleo (C)', [200, 120, 0]); y += 58;

    doc.setTextColor(100, 100, 100); doc.setFontSize(8);
    doc.text('Relatorio gerado automaticamente - TSEA Energy', 105, 285, { align: 'center' });

    const data = new Date().toISOString().slice(0, 10);
    const filename = isEmergencia
        ? `EMERGENCIA_${cicloAtualId}_${usuarioAtual || 'anonimo'}_${data}.pdf`
        : `ciclo_${cicloAtualId}_${usuarioAtual || 'anonimo'}_${data}.pdf`;
    doc.save(filename);
    await enviarPDFParaAPI(doc, filename);
}

// =============================================
//  RELATÓRIO MENSAL
// =============================================
async function gerarRelatorioMensal() {
    if (!window.jspdf) { console.warn('jsPDF nao carregou.'); return; }
    const { jsPDF } = window.jspdf;
    const agora = new Date();
    const ano = agora.getFullYear(), mes = agora.getMonth() + 1;
    const chave = `ciclos_vacuo_${ano}_${String(mes).padStart(2, '00')}`;
    let ciclos = [];
    try { ciclos = JSON.parse(storageGet(chave) || '[]'); } catch { }
    const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = meses[mes - 1];
    const doc = new jsPDF();

    doc.setFillColor(18, 18, 20); doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(232, 232, 232); doc.setFontSize(15);
    doc.text('RELATORIO MENSAL - SISTEMA DE VACUO', 105, 14, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(160, 160, 160);
    doc.text('TSEA Energy', 105, 23, { align: 'center' });
    doc.text(`${nomeMes} / ${ano}   —   Gerado em: ${agora.toLocaleString('pt-BR')}`, 105, 30, { align: 'center' });
    doc.text(`Operador solicitante: ${usuarioAtual || 'Nao identificado'}`, 105, 38, { align: 'center' });

    let y = 55;
    doc.setTextColor(0, 0, 0); doc.setFontSize(11);
    if (ciclos.length === 0) {
        doc.text(`Nenhum ciclo registrado em ${nomeMes} de ${ano}.`, 20, y);
    } else {
        doc.text(`Total de ciclos em ${nomeMes}: ${ciclos.length}`, 20, y); y += 14;
        ciclos.forEach((c) => {
            if (y + 80 > 270) { doc.addPage(); y = 20; }
            if (c.emergencia) { doc.setFillColor(255, 218, 218); doc.rect(15, y - 4, 180, 8, 'F'); doc.setTextColor(150, 0, 0); doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.text(`[EMERGENCIA] CICLO #${c.id}   —   ${c.dataHora}   —   Op: ${c.operador}`, 18, y + 1); doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); }
            else { doc.setFillColor(232, 232, 235); doc.rect(15, y - 4, 180, 8, 'F'); doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.text(`CICLO #${c.id}   —   ${c.dataHora}   —   Operador: ${c.operador}`, 18, y + 1); doc.setFont(undefined, 'normal'); }
            y += 11; doc.setTextColor(60, 60, 60); doc.setFontSize(9);
            doc.text(`Duracao: ${c.tempoOperacao}`, 20, y); y += 6;
            doc.text(`Pressao Camara: ${c.pressaoCamara} mBar   |   Temperatura: ${c.temperatura} C`, 20, y); y += 6;
            doc.text(`T1: ${c.pressaoT1} mBar / ${c.fluxoT1} LPM   |   T2: ${c.pressaoT2} mBar / ${c.fluxoT2} LPM   |   T3: ${c.pressaoT3} mBar / ${c.fluxoT3} LPM`, 20, y); y += 6;
            doc.text(`Conexoes: T1 ${c.tubo1}  |  T2 ${c.tubo2}  |  T3 ${c.tubo3}   |   Servo: ${c.servo}`, 20, y); y += 8;
            if (c.graficoPressaoValues && c.graficoPressaoValues.length > 1) {
                if (y + 42 > 270) { doc.addPage(); y = 20; }
                desenharGraficoPDF(doc, 15, y, 57, 38, c.graficoPressaoLabels, c.graficoPressaoValues, SENSOR_MBAR_MIN, SENSOR_MBAR_MAX, 'Pressao Vacuo (mBar)', [50, 80, 180]);
                if (c.graficoOleoValues?.length > 1) desenharGraficoPDF(doc, 80, y, 57, 38, c.graficoOleoLabels, c.graficoOleoValues, 0, 10, 'Pressao Oleo (Bar)', [189, 2, 2]);
                if (c.graficoTempValues?.length > 1) desenharGraficoPDF(doc, 145, y, 57, 38, c.graficoTempLabels, c.graficoTempValues, 20, 65, 'Temperatura (C)', [200, 120, 0]);
                y += 44;
            }
            y += 6;
        });
    }

    doc.setTextColor(130, 130, 130); doc.setFontSize(8);
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) { doc.setPage(p); doc.text(`TSEA Energy  —  Relatorio Mensal ${nomeMes}/${ano}  —  Pagina ${p} de ${totalPages}`, 105, 292, { align: 'center' }); }

    const filename = `relatorio_mensal_${ano}_${String(mes).padStart(2, '0')}_${usuarioAtual || 'anonimo'}.pdf`;
    doc.save(filename);
    await enviarPDFParaAPI(doc, filename);
}

// =============================================
//  RELÓGIO
// =============================================
function atualizarRelogio() {
    const agora = new Date();
    const dd = String(agora.getDate()).padStart(2, '0');
    const mm = String(agora.getMonth() + 1).padStart(2, '0');
    const yy = String(agora.getFullYear()).slice(-2);
    const hh = String(agora.getHours()).padStart(2, '0');
    const mi = String(agora.getMinutes()).padStart(2, '0');
    const ss = String(agora.getSeconds()).padStart(2, '0');
    const el = document.getElementById('relogioDisplay');
    if (el) el.textContent = `TSEA Energy  |  ${dd}/${mm}/${yy}  ${hh}:${mi}:${ss}`;
}