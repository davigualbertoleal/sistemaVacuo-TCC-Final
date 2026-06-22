// =============================================
//  SCRIPT OPERADOR - Sistema de Vacuo (TSEA ENERGY)
//  v3 — com fallback de simulacao quando API/ESP32 indisponivel
// =============================================

const API_URL = `http://${window.location.hostname}:5000/api`;

let usuarioAtual = null;
let cicloAtualId = 1;
let timerInterval = null;
let tempoDecorrido = 0;
let tempoLimite = 0;
let processoEmAndamento = false;
let dashboardCarregado = false;
let modoEmergencia = false;

let intervaloOleo = null;
let nivelCheio = false;
let tempCoolingStarted = false;

let dadosOleo = { pressao: 0, temperatura: 60, nivel: 0 };

const mangueiras = { 1: false, 2: false, 3: false };

// =============================================
//  SERVOS — angulos espelham config.h do ESP32
//  SERVO_MIN_ANGLE = 0  (fechado)
//  SERVO_MAX_ANGLE = 90 (aberto)
// =============================================
const SERVO_ABERTO = 90;
const SERVO_FECHADO = 0;
const servos = { 1: SERVO_FECHADO, 2: SERVO_FECHADO, 3: SERVO_FECHADO };

let dadosAtual = null;

const historicoVacuo = { labels: [], values: [] };
const historicoTemp = { labels: [], values: [] };

const SENSOR_MBAR_MIN = -150;
const SENSOR_MBAR_MAX = 10;

// =============================================
//  MODO SIMULACAO
//  Ativado automaticamente quando API ou ESP32
//  retornam erro / timeout / 404
// =============================================
let modoSimulacao = false;
let simPressaoCamara = -2;          // começa em -2 mBar e desce
let simPressaoTubos = [-2, -2, -2]; // idem por tubo
let simFluxos = [0, 0, 0];
let simIntervalo = null;

const SIM_ALVO = -60;  // mBar — patamar de estabilizacao
const SIM_NOISE = 0.8;  // flutuacao apos estabilizar

function simDescida(atual) {
    if (atual > -30) {
        // Fase 1: queda rapida de -2 ate -30
        return atual - (8 + Math.random() * 4);
    } else if (atual > SIM_ALVO) {
        // Fase 2: desacelera, ~5 mBar por tick
        const dist = Math.abs(SIM_ALVO - atual);
        const passo = Math.min(5 + Math.random() * 1.5, dist);
        return atual - passo;
    } else {
        // Estabilizado: pequena flutuacao realista
        return SIM_ALVO + (Math.random() * SIM_NOISE * 2 - SIM_NOISE);
    }
}

function ativarModoSimulacao(motivo) {
    if (modoSimulacao) return;
    modoSimulacao = true;
    console.warn('[SIM]', motivo);
}

// Gera leitura simulada para um ciclo ativo
function gerarDadosSimulados() {
    // Descida com curva realista
    simPressaoCamara = simDescida(simPressaoCamara);

    for (let i = 0; i < 3; i++) {
        if (servos[i + 1] === SERVO_ABERTO) {
            simPressaoTubos[i] = simDescida(simPressaoTubos[i]);
            simFluxos[i] = parseFloat((1.2 + Math.random() * 0.6).toFixed(2));
        } else {
            simPressaoTubos[i] = 0;
            simFluxos[i] = 0;
        }
    }

    return {
        pressaoCamaraMbar: parseFloat(simPressaoCamara.toFixed(2)),
        pressaoTubo1Mbar: parseFloat(simPressaoTubos[0].toFixed(1)),
        pressaoTubo2Mbar: parseFloat(simPressaoTubos[1].toFixed(1)),
        pressaoTubo3Mbar: parseFloat(simPressaoTubos[2].toFixed(1)),
        fluxoTubo1LPM: simFluxos[0],
        fluxoTubo2LPM: simFluxos[1],
        fluxoTubo3LPM: simFluxos[2],
        temperaturaOleo: dadosOleo.temperatura,
        bombaLigada: true,
        estadoMaquina: 'Simulado',
        servoAngulo: servos[1]
    };
}

function resetarSimulacao() {
    simPressaoCamara = -2;
    simPressaoTubos = [-2, -2, -2];
    simFluxos = [0, 0, 0];
}

// =============================================
//  STORAGE SEGURO
// =============================================
const memStorage = {};
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { memStorage[k] = v; } }
function storageGet(k) { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch { } return memStorage[k] ?? null; }

// =============================================
//  INICIALIZACAO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarTema(storageGet('tema') || 'dark');
    configurarToggleTema();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();

    ajustarZoomWebView();
    window.addEventListener('resize', ajustarZoomWebView);
});

function ajustarZoomWebView() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (W <= 1366 && H <= 768) {
        document.documentElement.style.zoom = '0.89';
        document.body.style.zoom = '1';
    } else {
        document.documentElement.style.zoom = '1';
        document.body.style.zoom = '1';
    }
}

// =============================================
//  TEMA
// =============================================
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    storageSet('tema', tema);
    const lbl = document.getElementById('themeLabel');
    if (lbl) lbl.textContent = tema === 'dark' ? 'ESCURO' : 'CLARO';
    try {
        if (window.vacuoChart?.data?.datasets?.[0]) {
            window.vacuoChart.data.datasets[0].borderColor = tema === 'dark' ? '#c8c8d4' : '#3a3730';
            window.vacuoChart.update();
        }
    } catch { }
}

function configurarToggleTema() {
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const t = document.documentElement.getAttribute('data-theme') || 'dark';
        aplicarTema(t === 'dark' ? 'light' : 'dark');
    });
}

// =============================================
//  AGUARDA CHART.JS
// =============================================
function esperarChartJS(cb) {
    if (window.Chart) { cb(); return; }
    let t = 0;
    const iv = setInterval(() => {
        t++;
        if (window.Chart) { clearInterval(iv); cb(); }
        else if (t > 50) { clearInterval(iv); cb(); }
    }, 100);
}

// =============================================
//  INTEGRACAO WEBVIEW2
// =============================================
window.addEventListener('load', () => {
    if (window.chrome?.webview)
        window.chrome.webview.postMessage('dashboard_pronto');
});

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
        esperarChartJS(() => {
            setTimeout(inicializarDashboard, 300);
        });
    }
}

// =============================================
//  INICIALIZAR DASHBOARD
// =============================================
function inicializarDashboard() {
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
    ['pressaoValue', 'metricT1', 'metricT2', 'metricT3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '--';
    });
    const faseEl = document.getElementById('faseDisplay');
    if (faseEl) { faseEl.textContent = 'AGUARDANDO INÍCIO'; faseEl.className = 'fase-badge aguard'; }
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';
    const limEl = document.getElementById('timerLimit');
    if (limEl) limEl.textContent = '';
    const stEl = document.getElementById('status-estado');
    if (stEl) { stEl.textContent = 'AGUARDANDO'; stEl.className = 'status-value'; }
}

// =============================================
//  MANGUEIRAS
// =============================================
function configurarMangueiras() {
    document.querySelectorAll('.mangueira-button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (modoEmergencia) return;
            const num = btn.getAttribute('data-mangueira');
            mangueiras[num] = !mangueiras[num];
            const conectada = mangueiras[num];
            btn.setAttribute('aria-pressed', conectada ? 'true' : 'false');
            btn.classList.toggle('conectada', conectada);
            validarMangueiras();
        });
    });
}

function validarMangueiras() { validarBotaoIniciar(); }

// =============================================
//  SERVOS — integracao com API
// =============================================
function configurarServos() {
    document.querySelectorAll('.servo-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = btn.dataset.servo;
            if (servos[num] === SERVO_ABERTO) {
                servos[num] = SERVO_FECHADO;
            } else {
                servos[num] = SERVO_ABERTO;
            }
            atualizarValvulaVisual(num, servos[num]);
        });
    });
}

async function enviarComandoServo(num, angulo) {
    if (modoSimulacao) {
        // Em modo simulacao: apenas atualiza estado local
        servos[num] = angulo;
        atualizarValvulaVisual(num, angulo);
        validarBotaoIniciar();
        return;
    }

    const btn = document.getElementById(`btnServo${num}`);
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

    try {
        const res = await fetch(`${API_URL}/servo/comando`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cicloId: cicloAtualId,
                angulo,
                origem: 'Dashboard-Operador'
            })
        });

        if (res.ok) {
            servos[num] = angulo;
            atualizarValvulaVisual(num, angulo);
            validarBotaoIniciar();
        } else {
            console.warn(`Erro ao enviar comando servo ${num}:`, res.status);
        }
    } catch (err) {
        console.warn(`Falha ao comunicar com API (servo ${num}):`, err.message);
        ativarModoSimulacao('Falha no comando servo');
        servos[num] = angulo;
        atualizarValvulaVisual(num, angulo);
        validarBotaoIniciar();
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    }
}

async function fecharTodosServosEmergencia() {
    if (modoSimulacao) {
        [1, 2, 3].forEach(n => { servos[n] = SERVO_FECHADO; atualizarValvulaVisual(n, SERVO_FECHADO); });
        return;
    }
    const promises = [1, 2, 3].map(n => enviarComandoServo(n, SERVO_FECHADO));
    await Promise.allSettled(promises);
}

// =============================================
//  BOTOES
// =============================================
function configurarBotoes() {
    document.getElementById('btnIniciar')?.addEventListener('click', abrirModalTimer);
    document.getElementById('btnEmergencia')?.addEventListener('click', acionarEmergencia);

    document.getElementById('btnFechar')?.addEventListener('click', () =>
        document.getElementById('modalFechar')?.classList.remove('hidden')
    );
    document.getElementById('btnCancelarFechar')?.addEventListener('click', () =>
        document.getElementById('modalFechar')?.classList.add('hidden')
    );
    document.getElementById('btnConfirmarFechar')?.addEventListener('click', fazerLogout);
    document.getElementById('btnCancelarTimer')?.addEventListener('click', fecharModalTimer);
    document.getElementById('btnConfirmarTimer')?.addEventListener('click', confirmarTimer);
    document.getElementById('btnFecharTempoEncerrado')?.addEventListener('click', () =>
        document.getElementById('modalTempoEncerrado')?.classList.add('hidden')
    );
    document.getElementById('btnFecharEmergAtivada')?.addEventListener('click', () =>
        document.getElementById('modalEmergAtivada')?.classList.add('hidden')
    );
}

// =============================================
//  LOGOUT
// =============================================
function fazerLogout() {
    if (processoEmAndamento) pararProcesso();
    pararSimulacaoOleo();
    usuarioAtual = null;
    dashboardCarregado = false;
    modoEmergencia = false;
    modoSimulacao = false;
    try {
        localStorage.removeItem('usuarioId');
        localStorage.removeItem('usuarioNome');
        localStorage.removeItem('usuarioPapel');
    } catch { }
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
        el.querySelectorAll('.drum-item').forEach((item, i) => item.classList.toggle('selected', i === current + VISIBLE));
        if (elId === 'drumHoras') drumState.horas = current;
        if (elId === 'drumMinutos') drumState.minutos = current;
        if (elId === 'drumSegundos') drumState.segundos = current;
    }
    snapTo(0, false);

    el.parentElement.addEventListener('mousedown', e => { isDragging = true; startY = e.clientY; startOffset = getOffset(current); el.style.transition = 'none'; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (!isDragging) return; currentOffset = startOffset + (e.clientY - startY); el.style.transform = `translateY(${currentOffset}px)`; });
    window.addEventListener('mouseup', e => { if (!isDragging) return; isDragging = false; snapTo(current + Math.round(-(e.clientY - startY) / ITEM_H), true); });
    el.parentElement.addEventListener('touchstart', e => { startY = e.touches[0].clientY; startOffset = getOffset(current); el.style.transition = 'none'; }, { passive: true });
    el.parentElement.addEventListener('touchmove', e => { currentOffset = startOffset + (e.touches[0].clientY - startY); el.style.transform = `translateY(${currentOffset}px)`; }, { passive: true });
    el.parentElement.addEventListener('touchend', e => { snapTo(current + Math.round(-(e.changedTouches[0].clientY - startY) / ITEM_H), true); });
    el.parentElement.addEventListener('wheel', e => { e.preventDefault(); snapTo(current + (e.deltaY > 0 ? 1 : -1), true); }, { passive: false });
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
function abrirModalTimer() {
    if (modoEmergencia) return;
    resetarDrums();
    document.getElementById('modalTimer')?.classList.remove('hidden');
}
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
//  VALIDAR BOTAO INICIAR
// =============================================
function validarBotaoIniciar() {
    if (modoEmergencia) return;
    const btnIniciar = document.getElementById('btnIniciar');
    if (!btnIniciar) return;
    const umConectado = mangueiras[1] || mangueiras[2] || mangueiras[3];
    const umaAberta = servos[1] === SERVO_ABERTO || servos[2] === SERVO_ABERTO || servos[3] === SERVO_ABERTO;
    btnIniciar.disabled = !(umConectado && umaAberta);
}

// =============================================
//  PROCESSO E TIMER
// =============================================
async function iniciarProcesso() {

    const btn = document.getElementById('btnIniciar');
    if (btn) {
        btn.classList.remove('desativado');
        btn.classList.add('iniciado');
        btn.textContent = 'INICIADO';
    }

    if (!mangueiras[1] && !mangueiras[2] && !mangueiras[3]) { alert('Conecte pelo menos 1 tubo para iniciar!'); return; }
    if (servos[1] !== SERVO_ABERTO && servos[2] !== SERVO_ABERTO && servos[3] !== SERVO_ABERTO) { alert('Abra pelo menos 1 valvula para iniciar!'); return; }

    processoEmAndamento = true;
    tempoDecorrido = 0;
    nivelCheio = false;
    tempCoolingStarted = false;
    resetarSimulacao();

    // Tenta registrar ciclo na API — ativa simulacao se falhar
    if (!modoSimulacao) {
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
            } else {
                ativarModoSimulacao('API retornou ' + res.status);
            }
        } catch (err) {
            ativarModoSimulacao('API inacessivel: ' + err.message);
        }
    }

    dadosOleo = { pressao: 0, temperatura: 60, nivel: 0 };
    historicoVacuo.labels = []; historicoVacuo.values = [];
    historicoTemp.labels = []; historicoTemp.values = [];

    const btnI = document.getElementById('btnIniciar');
    if (btnI) btnI.disabled = true;

    document.querySelectorAll('.mangueira-button, .servo-button').forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.5';
    });

    const stEl = document.getElementById('status-estado');
    if (stEl) { stEl.textContent = 'PROCESSANDO'; stEl.className = 'status-value on'; }
    const limEl = document.getElementById('timerLimit');
    if (limEl) limEl.textContent = '';

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) {
        const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
        const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
        const ls = (tempoLimite % 60).toString().padStart(2, '0');
        timerEl.textContent = `${lh}:${lm}:${ls}`;
    }

    if (window.vacuoChart) {
        window.vacuoChart.data.labels = [];
        window.vacuoChart.data.datasets[0].data = [];
        window.vacuoChart.update();
    }

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
            const sEl = document.getElementById('status-estado');
            if (sEl) { sEl.textContent = 'CONCLUIDO'; sEl.className = 'status-value on'; }
            document.getElementById('timerLimit').textContent = 'TEMPO ENCERRADO';
            gerarRelatorioPDF(false);
            document.getElementById('modalTempoEncerrado')?.classList.remove('hidden');
        }
    }, 1000);

    if (window.apiInterval) clearInterval(window.apiInterval);
    window.apiInterval = setInterval(buscarDados, 2000);
    buscarDados();

    iniciarSimulacaoOleo();

    const btnE = document.getElementById('btnEmergencia');
    if (btnE) { btnE.disabled = false; btnE.style.opacity = ''; }

    if (window.chrome?.webview) window.chrome.webview.postMessage('iniciar_ciclo');
}

function pararProcesso(motivo = null) {
    processoEmAndamento = false;
    if (timerInterval) clearInterval(timerInterval);
    if (window.apiInterval) clearInterval(window.apiInterval);
    pararSimulacaoOleo();

    if (cicloAtualId && !modoSimulacao) {
        const url = motivo
            ? `${API_URL}/ciclo/${cicloAtualId}/parar?motivo=${motivo}`
            : `${API_URL}/ciclo/${cicloAtualId}/parar`;
        fetch(url, { method: 'POST' }).catch(() => { });
    }

    const btnI = document.getElementById('btnIniciar');
    if (btnI) btnI.disabled = false;

    if (!modoEmergencia) {
        document.querySelectorAll('.mangueira-button, .servo-button').forEach(b => {
            b.disabled = false;
            b.style.opacity = '';
        });
    }

    const stEl = document.getElementById('status-estado');
    if (stEl) { stEl.textContent = 'OPERACIONAL'; stEl.className = 'status-value'; }

    const btnE = document.getElementById('btnEmergencia');
    if (btnE && !modoEmergencia) { btnE.disabled = true; btnE.style.opacity = '0.4'; }

    validarBotaoIniciar();
}

// =============================================
//  EMERGENCIA — operador so ATIVA, nao desativa
// =============================================
async function acionarEmergencia() {
    if (modoEmergencia) {
        document.getElementById('modalEmergAtivada')?.classList.remove('hidden');
        return;
    }
    if (!processoEmAndamento) return;

    modoEmergencia = true;
    pararProcesso('EMERGENCIA');
    pararSimulacaoOleo();

    await fecharTodosServosEmergencia();
    await gerarRelatorioPDF(true);

    const stEl = document.getElementById('status-estado');
    if (stEl) { stEl.textContent = 'EMERGENCIA'; stEl.className = 'status-value off'; }
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '--:--:--';
    const limEl = document.getElementById('timerLimit');
    if (limEl) limEl.textContent = 'PARADO — EMERGENCIA';

    document.querySelectorAll('.mangueira-button, .servo-button').forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.3';
        b.style.cursor = 'not-allowed';
    });

    const faseEl = document.getElementById('faseDisplay');
    if (faseEl) { faseEl.textContent = 'EMERGENCIA — AGUARDANDO LIBERACAO'; faseEl.className = 'fase-badge estavel'; }

    const btnE = document.getElementById('btnEmergencia');
    if (btnE) { btnE.textContent = 'AGUARDANDO LIBERACAO...'; btnE.className = 'btn btn-emergency-aguardando'; btnE.disabled = false; btnE.style.opacity = ''; }

    enviarEmergenciaAPI();
    document.getElementById('modalEmergAtivada')?.classList.remove('hidden');
}

async function enviarEmergenciaAPI() {
    if (modoSimulacao) return;
    try {
        await fetch(`${API_URL}/emergencia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origem: 'operador', usuarioId: usuarioAtual })
        });
        if (window.chrome?.webview) window.chrome.webview.postMessage('emergencia_ativada');
    } catch { }
}

// =============================================
//  VALVULAS
// =============================================
function atualizarStatusValvulas() {
    [1, 2, 3].forEach(n => atualizarValvulaVisual(n, servos[n]));
    validarBotaoIniciar();
    const btnE = document.getElementById('btnEmergencia');
    if (btnE) { btnE.disabled = true; btnE.style.opacity = '0.4'; }
}

function atualizarValvulaVisual(num, angulo) {
    const isAberta = angulo === SERVO_ABERTO;

    const btn = document.getElementById(`btnServo${num}`);
    if (btn) {
        btn.textContent = isAberta ? 'ABERTA - Aperte para Fechar' : 'FECHADA - Aperte para Abrir';
        btn.classList.toggle('aberto', isAberta);
        btn.classList.toggle('fechado', !isAberta);
    }

    const visual = document.getElementById(`valveVisual${num}`);
    if (visual) {
        const svg = visual.querySelector('svg');
        if (svg) {
            svg.querySelectorAll('rect, circle, line').forEach(el => {
                el.style.stroke = '';
                el.style.fill = '';
            });
            svg.querySelectorAll('text').forEach(el => el.style.fill = '');

            const angleEl = svg.querySelector(`#valveAngle${num}`);
            if (angleEl) angleEl.textContent = angulo + '°';
        }
    }

    const angleTxt = document.getElementById(`valveAngleTxt${num}`);
    if (angleTxt) angleTxt.textContent = angulo + '°';

    validarBotaoIniciar();
}

function atualizarValvulasDados(d) {
    [1, 2, 3].forEach(n => {
        const pEl = document.getElementById(`valvePressure${n}`);
        const fEl = document.getElementById(`valveFlow${n}`);
        if (pEl) pEl.textContent = d[`pressaoTubo${n}Mbar`].toFixed(1) + ' mBar';
        if (fEl) fEl.textContent = d[`fluxoTubo${n}LPM`].toFixed(1) + ' LPM';
    });
}

// =============================================
//  GRAFICO VACUO
// =============================================
function inicializarGrafico() {
    try {
        const canvas = document.getElementById('vacuoChart');
        if (!canvas || !window.Chart) return;
        const ctx = canvas.getContext('2d');
        const tema = document.documentElement.getAttribute('data-theme') || 'dark';
        window.vacuoChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Pressao (mBar)', data: [], borderColor: tema === 'dark' ? '#c8c8d4' : '#3a3730', borderWidth: 2, tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(200,200,212,0.06)', fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, plugins: { legend: { display: false } }, scales: { y: { min: SENSOR_MBAR_MIN, max: SENSOR_MBAR_MAX, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 9, family: 'IBM Plex Mono' } } }, x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 6 } } } }
        });
    } catch (e) { console.warn('Grafico vacuo:', e.message); }
}

// =============================================
//  GRAFICO OLEO
// =============================================
function inicializarGraficoOleo() {
    try {
        const canvas = document.getElementById('oleoChart');
        if (!canvas || !window.Chart) return;
        const ctx = canvas.getContext('2d');
        window.oleoChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], datasets: [
                    { label: 'Pressao Oleo (Bar)', data: [], borderColor: '#bd0202', borderWidth: 2, tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(189,2,2,0.12)', fill: true, yAxisID: 'yPressao' },
                    { label: 'Temperatura (C)', data: [], borderColor: '#e88a00', borderWidth: 2, tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(232,138,0,0.07)', fill: false, yAxisID: 'yTemp' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, plugins: { legend: { display: true, labels: { color: '#888', font: { size: 9, family: 'IBM Plex Mono' }, boxWidth: 12, padding: 10 } } }, scales: { yPressao: { type: 'linear', position: 'left', min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#bd0202', font: { size: 9 } } }, yTemp: { type: 'linear', position: 'right', min: 20, max: 65, grid: { display: false }, ticks: { color: '#e88a00', font: { size: 9 } } }, x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 6 } } } }
        });
    } catch (e) { console.warn('Grafico oleo:', e.message); }
}

// =============================================
//  POLLING DA API — com fallback p/ simulacao
// =============================================
async function buscarDados() {
    // Modo simulacao: gera dados localmente sem chamar a API
    if (modoSimulacao) {
        if (!processoEmAndamento) return;
        dadosAtual = gerarDadosSimulados();
        atualizarPrincipal(dadosAtual);
        atualizarValvulasDados(dadosAtual);
        return;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const res = await fetch(`${API_URL}/leiturasSensores?limit=1`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        // 404 ou qualquer erro HTTP = ESP32 nao encontrado
        if (!res.ok) {
            ativarModoSimulacao('HTTP ' + res.status + ' em /leiturasSensores');
            if (processoEmAndamento) {
                dadosAtual = gerarDadosSimulados();
                atualizarPrincipal(dadosAtual);
                atualizarValvulasDados(dadosAtual);
            }
            return;
        }

        const leituras = await res.json();
        if (!leituras?.length) {
            // Endpoint respondeu mas sem dados — usa simulacao por esta rodada
            if (processoEmAndamento) {
                dadosAtual = gerarDadosSimulados();
                atualizarPrincipal(dadosAtual);
                atualizarValvulasDados(dadosAtual);
            }
            return;
        }

        const l = leituras[0];
        const toMbar = v => {
            const n = parseFloat(v) || 0;
            return Math.abs(n) > 100 ? (n * 0.01) : n;
        };

        dadosAtual = {
            pressaoCamaraMbar: toMbar(l.pressaoCamaraMbar),
            pressaoTubo1Mbar: toMbar(l.pressaoTubo1Mbar),
            pressaoTubo2Mbar: toMbar(l.pressaoTubo2Mbar),
            pressaoTubo3Mbar: toMbar(l.pressaoTubo3Mbar),
            fluxoTubo1LPM: parseFloat(l.fluxoTubo1LPM) || 0,
            fluxoTubo2LPM: parseFloat(l.fluxoTubo2LPM) || 0,
            fluxoTubo3LPM: parseFloat(l.fluxoTubo3LPM) || 0,
            temperaturaOleo: parseFloat(l.temperaturaOleo) || dadosOleo.temperatura,
            bombaLigada: l.bombaLigada ?? true,
            estadoMaquina: l.estadoMaquina || 'Desligado',
            servoAngulo: l.servoAngulo || 0
        };

        if (processoEmAndamento) atualizarPrincipal(dadosAtual);
        atualizarValvulasDados(dadosAtual);

    } catch (err) {
        // Timeout ou falha de rede
        ativarModoSimulacao('Erro de rede: ' + (err.name === 'AbortError' ? 'timeout' : err.message));
        if (processoEmAndamento) {
            dadosAtual = gerarDadosSimulados();
            atualizarPrincipal(dadosAtual);
            atualizarValvulasDados(dadosAtual);
        }
    }
}

// =============================================
//  ATUALIZAR ABA PRINCIPAL
// =============================================
function atualizarPrincipal(d) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    set('pressaoValue', d.pressaoCamaraMbar.toFixed(2));
    set('metricT1', d.pressaoTubo1Mbar.toFixed(1));
    set('metricT2', d.pressaoTubo2Mbar.toFixed(1));
    set('metricT3', d.pressaoTubo3Mbar.toFixed(1));

    const bombaEl = document.getElementById('status-bomba');
    if (bombaEl) { bombaEl.textContent = d.bombaLigada ? 'LIGADO' : 'DESLIGADO'; bombaEl.className = 'status-value ' + (d.bombaLigada ? 'on' : 'off'); }

    const p = d.pressaoCamaraMbar;
    const faseEl = document.getElementById('faseDisplay');
    if (faseEl && !modoEmergencia) {
        let texto, cls;
        if (p < -60) { texto = 'SUCÇÃO ATIVA'; cls = 'succao'; }
        else if (p <= -20) { texto = 'PRESSÃO ESTÁVEL'; cls = 'estavel'; }
        else { texto = 'PRESSÃO BAIXA'; cls = 'aguard'; }
        faseEl.textContent = texto;
        faseEl.className = 'fase-badge ' + cls;
    }

    if (window.vacuoChart) {
        const agora = new Date().toLocaleTimeString('pt-BR');
        window.vacuoChart.data.labels.push(agora);
        window.vacuoChart.data.datasets[0].data.push(d.pressaoCamaraMbar);
        if (window.vacuoChart.data.labels.length > 60) {
            window.vacuoChart.data.labels.shift();
            window.vacuoChart.data.datasets[0].data.shift();
        }
        window.vacuoChart.update();
        historicoVacuo.labels.push(agora);
        historicoVacuo.values.push(d.pressaoCamaraMbar);
    }
}

// =============================================
//  SIMULACAO OLEO
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
        if (!processoEmAndamento) return;

        dadosOleo.pressao = Math.min(dadosOleo.pressao + Math.random() * 0.25 + 0.05, 10);

        if (!nivelCheio) {
            const inc = (100 / tempoNivelCheio) + (Math.random() * 0.3 - 0.15);
            dadosOleo.nivel = Math.min(dadosOleo.nivel + inc, 100);
            if (dadosOleo.nivel >= 100) { dadosOleo.nivel = 100; nivelCheio = true; tempCoolingStarted = true; }
        } else {
            dadosOleo.nivel = 100;
        }

        if (!tempCoolingStarted) {
            dadosOleo.temperatura = 60 + (Math.random() * 0.4 - 0.2);
        } else {
            const tempoResfriando = tempoDecorrido - tempoNivelCheio;
            if (tempoResfriando <= 0) {
                dadosOleo.temperatura = 60;
            } else if (tempoResfriando >= duracaoResfriamento) {
                dadosOleo.temperatura = 25;
            } else {
                const prog = tempoResfriando / duracaoResfriamento;
                dadosOleo.temperatura = Math.max(25, 60 - (35 * prog) + (Math.random() * 0.4 - 0.2));
            }
        }

        atualizarOleoUI();
    }, 1000);
}

function pararSimulacaoOleo() {
    if (intervaloOleo) { clearInterval(intervaloOleo); intervaloOleo = null; }
}

// =============================================
//  ATUALIZAR UI OLEO
// =============================================
function atualizarOleoUI() {
    if (!processoEmAndamento) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const { pressao, nivel, temperatura } = dadosOleo;

    set('oleoNivel', nivel.toFixed(1));
    set('oleoPressao', pressao.toFixed(1));
    set('oleoTemp', temperatura.toFixed(1));
    set('oleoEstado', tempoDecorrido >= tempoLimite ? 'CONCLUIDO' : 'OPERANDO');

    const oilFill = document.getElementById('oilFill');
    const oilPercent = document.getElementById('oilPercent');
    if (oilFill) oilFill.style.height = nivel + '%';
    if (oilPercent) oilPercent.textContent = nivel.toFixed(0) + '%';

    const bFill = document.getElementById('nivelBarFill');
    const bVal = document.getElementById('nivelBarVal');
    if (bFill) bFill.style.width = nivel + '%';
    if (bVal) {
        bVal.textContent = nivel.toFixed(0) + '%';
        const barWidth = nivel;
        bVal.style.setProperty('color', barWidth >= 50 ? '#ffffff' : '#101010', 'important');
    }

    const tempRatio = Math.max(0, Math.min(1, (temperatura - 25) / 35));
    const r = Math.round(107 + (189 - 107) * tempRatio);
    if (oilFill) oilFill.style.background = '#e20613';

    const filtroEstado = nivel < 30 ? 'CRITICO' : nivel < 60 ? 'ATENCAO' : 'NORMAL';
    const filtroClasse = nivel < 30 ? 'crit' : nivel < 60 ? 'warn' : 'ok';
    const semaF = document.getElementById('semaFiltro');
    if (semaF) { semaF.className = `op-sema-item ${filtroClasse}`; const t = document.getElementById('semaFiltroTxt'); if (t) t.textContent = filtroEstado; }

    const circEstado = pressao < 1 ? 'BAIXA' : pressao < 5 ? 'NORMAL' : 'ELEVADA';
    const circClasse = pressao < 1 ? 'warn' : pressao < 5 ? 'ok' : 'warn';
    const semaC = document.getElementById('semaCirculacao');
    if (semaC) { semaC.className = `op-sema-item ${circClasse}`; const t = document.getElementById('semaCirculacaoTxt'); if (t) t.textContent = circEstado; }

    const estEstado = modoEmergencia ? 'EMERGENCIA' : nivel >= 100 ? 'CONCLUIDO' : 'OPERANDO';
    const estClasse = modoEmergencia ? 'crit' : 'ok';
    const semaE = document.getElementById('semaEstado');
    if (semaE) { semaE.className = `op-sema-item ${estClasse}`; const t = document.getElementById('semaEstadoTxt'); if (t) t.textContent = estEstado; }

    const hora = new Date().toLocaleTimeString('pt-BR');
    historicoTemp.labels.push(hora);
    historicoTemp.values.push(temperatura);

    if (window.oleoChart) {
        window.oleoChart.data.labels.push(hora);
        window.oleoChart.data.datasets[0].data.push(pressao);
        window.oleoChart.data.datasets[1].data.push(temperatura);
        if (window.oleoChart.data.labels.length > 60) {
            window.oleoChart.data.labels.shift();
            window.oleoChart.data.datasets[0].data.shift();
            window.oleoChart.data.datasets[1].data.shift();
        }
        window.oleoChart.update();
    }
}

// =============================================
//  HISTORICO
// =============================================
function salvarCicloNoHistorico(isEmergencia) {
    const agora = new Date();
    const chave = `ciclos_vacuo_${agora.getFullYear()}_${String(agora.getMonth() + 1).padStart(2, '0')}`;
    let ciclos = [];
    try { ciclos = JSON.parse(storageGet(chave) || '[]'); } catch { }

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');

    ciclos.push({
        id: cicloAtualId, emergencia: isEmergencia,
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
        servo: dadosAtual ? dadosAtual.servoAngulo + ' graus' : '--'
    });

    storageSet(chave, JSON.stringify(ciclos));
    cicloAtualId++;
}

// =============================================
//  HELPER: GRAFICO NO PDF
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
//  HELPER: ENVIAR PDF PARA API
// =============================================
async function enviarPDFParaAPI(doc, filename) {
    if (modoSimulacao) return;
    try {
        const pdfBlob = doc.output('blob');
        const formData = new FormData();
        formData.append('file', pdfBlob, filename);
        const response = await fetch(`${API_URL}/relatorios/upload`, { method: 'POST', body: formData });
        if (response.ok) { console.log('PDF enviado para S3:', filename); }
        else console.warn('Falha ao enviar PDF:', response.status);
    } catch (err) { console.warn('Erro ao enviar PDF (ignorado):', err.message); }
}

// =============================================
//  RELATORIO PDF
// =============================================
async function gerarRelatorioPDF(isEmergencia) {
    if (!window.jspdf) { console.warn('jsPDF nao carregou.'); return; }
    salvarCicloNoHistorico(isEmergencia);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const corHeader = isEmergencia ? [160, 10, 10] : [18, 18, 20];
    doc.setFillColor(...corHeader); doc.rect(0, 0, 210, 44, 'F');
    doc.setTextColor(232, 232, 232); doc.setFontSize(isEmergencia ? 16 : 17);
    if (isEmergencia) {
        doc.setFont(undefined, 'bold'); doc.text('*** RELATORIO DE EMERGENCIA ***', 105, 13, { align: 'center' });
        doc.setFont(undefined, 'normal'); doc.text('SISTEMA DE VACUO - TSEA ENERGY', 105, 22, { align: 'center' });
    } else {
        doc.text('RELATORIO - SISTEMA DE VACUO', 105, 14, { align: 'center' });
        doc.setFontSize(10); doc.setTextColor(170, 170, 170); doc.text('TSEA Energy', 105, 24, { align: 'center' });
    }
    doc.setFontSize(10); doc.setTextColor(170, 170, 170);
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 105, isEmergencia ? 30 : 31, { align: 'center' });
    if (isEmergencia) { doc.setTextColor(255, 180, 180); doc.text('PROCESSO INTERROMPIDO POR EMERGENCIA', 105, 38, { align: 'center' }); }

    let y = 54;
    doc.setTextColor(0, 0, 0);

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');

    doc.setFontSize(12); doc.text('DADOS DO CICLO', 20, y); y += 10; doc.setFontSize(10);
    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, y); y += 7;
    doc.text(`Ciclo ID: ${cicloAtualId}`, 20, y); y += 7;
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 20, y); y += 7;
    doc.text(`Tempo de Operacao: ${lh}:${lm}:${ls}`, 20, y); y += 7;
    if (isEmergencia) { doc.setFont(undefined, 'bold'); doc.setTextColor(150, 0, 0); doc.text('Motivo de encerramento: EMERGENCIA', 20, y); doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); }
    y += 12;

    doc.setFontSize(12); doc.text('PRESSOES E FLUXOS', 20, y); y += 10; doc.setFontSize(10);
    if (dadosAtual) {
        doc.text(`Camara: ${dadosAtual.pressaoCamaraMbar.toFixed(2)} mBar`, 20, y); y += 7;
        doc.text(`Tubo 1: ${dadosAtual.pressaoTubo1Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo1LPM.toFixed(1)} LPM`, 20, y); y += 7;
        doc.text(`Tubo 2: ${dadosAtual.pressaoTubo2Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo2LPM.toFixed(1)} LPM`, 20, y); y += 7;
        doc.text(`Tubo 3: ${dadosAtual.pressaoTubo3Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo3LPM.toFixed(1)} LPM`, 20, y); y += 7;
        doc.text(`Temperatura Oleo: ${dadosAtual.temperaturaOleo ? dadosAtual.temperaturaOleo.toFixed(1) : dadosOleo.temperatura.toFixed(1)} C`, 20, y); y += 7;
    } else { doc.text('Nenhum dado disponivel.', 20, y); y += 7; }
    y += 5;

    doc.setFontSize(12); doc.text('STATUS DOS COMPONENTES', 20, y); y += 10; doc.setFontSize(10);
    doc.text(`Tubo 1: ${mangueiras[1] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 7;
    doc.text(`Tubo 2: ${mangueiras[2] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 7;
    doc.text(`Tubo 3: ${mangueiras[3] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 14;

    doc.setFontSize(12); doc.text('GRAFICOS DO CICLO', 20, y); y += 8;
    if (y + 55 > 270) { doc.addPage(); y = 20; }
    desenharGraficoPDF(doc, 15, y, 180, 50, historicoVacuo.labels, historicoVacuo.values, SENSOR_MBAR_MIN, SENSOR_MBAR_MAX, 'Pressao Camara (mBar)', [50, 80, 180]); y += 58;
    if (y + 55 > 270) { doc.addPage(); y = 20; }
    const oleoLabels = window.oleoChart ? window.oleoChart.data.labels : [];
    const oleoValues = window.oleoChart ? window.oleoChart.data.datasets[0].data : [];
    desenharGraficoPDF(doc, 15, y, 87, 50, oleoLabels, oleoValues, 0, 10, 'Pressao Oleo (Bar)', [189, 2, 2]);
    desenharGraficoPDF(doc, 108, y, 87, 50, historicoTemp.labels, historicoTemp.values, 20, 65, 'Temperatura Oleo (C)', [200, 120, 0]);

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
//  RELOGIO
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