// =============================================
//  SCRIPT - Sistema de Vacuo
//  Compatível com XGZP6847D (-100~0 kPa)
//  API já retorna valores em mBar (float)
//  Não há conversão necessária no frontend
// =============================================

const API_URL = "http://localhost:5000/api";

let usuarioAtual = null;
let timerInterval = null;
let tempoDecorrido = 0;
let tempoLimite = 0;
let processoEmAndamento = false;
let dashboardCarregado = false;
let cicloAtualId = 1;
let modoEmergencia = false;

// Tubos iniciam DESCONECTADOS (false)
const mangueiras = { 1: false, 2: false, 3: false };
const servos = { 1: 155, 2: 155, 3: 155 };

let dadosAtual = null;

// =============================================
//  FAIXA DO SENSOR  (-100 kPa ~ 0 kPa = -1000 ~ 0 mBar)
//  Usada apenas para limites do gráfico e gauges
// =============================================
const SENSOR_MBAR_MIN = -1000;
const SENSOR_MBAR_MAX = 0;

// =============================================
//  INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado — sensor XGZP6847D (-100~0 kPa)');
    mostrarModalLogin();
    configurarEventosLogin();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();
});

// =============================================
//  AUTENTICAÇÃO
// =============================================
function configurarEventosLogin() {
    const btnConfirmar = document.getElementById('btnConfirmarId');
    const inputId = document.getElementById('inputId');

    if (btnConfirmar) btnConfirmar.addEventListener('click', validarId);
    if (inputId) {
        inputId.addEventListener('keypress', (e) => { if (e.key === 'Enter') validarId(); });
        inputId.focus();
    }
}

function mostrarModalLogin() {
    const modal = document.getElementById('modalLogin');
    if (modal) modal.classList.remove('hidden');
}

function ocultarModalLogin() {
    const modal = document.getElementById('modalLogin');
    if (modal) modal.classList.add('hidden');
}

async function validarId() {
    const inputId = document.getElementById('inputId');
    const errorMsg = document.getElementById('errorMsg');
    const id = inputId.value.trim().toUpperCase();

    if (!id) { mostrarErro('Digite um ID valido!', errorMsg); return; }

    try {
        const response = await fetch(`${API_URL}/operadores?identificador=${id}`);
        const data = await response.json();

        if (response.ok && data && data.id) {
            usuarioAtual = id;
            localStorage.setItem('usuarioNome', data.nome);
            localStorage.setItem('usuarioDbId', data.id);
            inputId.value = '';
            mostrarDashboard();
        } else {
            mostrarErro('ID nao encontrado!', errorMsg);
            inputId.value = '';
        }
    } catch (error) {
        console.warn('API offline, validacao local');
        if (id === 'OP-001' || id === 'OP-002') {
            usuarioAtual = id;
            localStorage.setItem('usuarioNome', 'Operador');
            inputId.value = '';
            mostrarDashboard();
        } else {
            mostrarErro('ID nao encontrado!', errorMsg);
            inputId.value = '';
        }
    }
}

function mostrarErro(msg, elemento) {
    if (!elemento) return;
    elemento.textContent = msg;
    elemento.classList.add('show');
    setTimeout(() => elemento.classList.remove('show'), 4000);
}

function atualizarNomeUsuario() {
    const nome = localStorage.getItem('usuarioNome') || usuarioAtual;
    const el = document.getElementById('usuarioLogado');
    if (el) el.textContent = `${usuarioAtual}  -  ${nome}`;
}

function mostrarDashboard() {
    ocultarModalLogin();
    atualizarNomeUsuario();
    if (!dashboardCarregado) {
        dashboardCarregado = true;
        inicializarDashboard();
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
//  GRÁFICO
//  Faixa Y: -1000 ~ 0 mBar (sensor -100~0 kPa)
// =============================================
function inicializarGrafico() {
    const canvas = document.getElementById('vacuoChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    window.vacuoChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Pressao (mBar)',
                data: [],
                borderColor: '#e8e8e8',
                borderWidth: 2.5,
                tension: 0.4,
                pointRadius: 0,
                fill: { target: 'origin', above: 'rgba(232,232,232,0.08)' }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: SENSOR_MBAR_MIN,   // -1000
                    max: SENSOR_MBAR_MAX,   //     0
                    grid: { color: '#222' },
                    ticks: { color: '#888', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#888', font: { size: 9 }, maxTicksLimit: 8 }
                }
            }
        }
    });
}

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
    const btnIniciar = document.getElementById('btnIniciar');
    const btnEmergencia = document.getElementById('btnEmergencia');
    const btnRelatorio = document.getElementById('btnRelatorio');
    const btnFechar = document.getElementById('btnFechar');

    if (btnIniciar) btnIniciar.addEventListener('click', abrirModalTimer);
    if (btnEmergencia) btnEmergencia.addEventListener('click', emergencia);
    if (btnRelatorio) btnRelatorio.addEventListener('click', gerarRelatorioMensal);

    if (btnFechar) btnFechar.addEventListener('click', abrirModalFechar);

    const btnCancelarFechar = document.getElementById('btnCancelarFechar');
    const btnConfirmarFechar = document.getElementById('btnConfirmarFechar');
    if (btnCancelarFechar) btnCancelarFechar.addEventListener('click', fecharModalFechar);
    if (btnConfirmarFechar) btnConfirmarFechar.addEventListener('click', () => {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage('fechar_app');
        } else {
            window.close();
        }
    });

    const btnCancelarTimer = document.getElementById('btnCancelarTimer');
    const btnConfirmarTimer = document.getElementById('btnConfirmarTimer');
    if (btnCancelarTimer) btnCancelarTimer.addEventListener('click', fecharModalTimer);
    if (btnConfirmarTimer) btnConfirmarTimer.addEventListener('click', confirmarTimer);

    const btnFecharTempoEncerrado = document.getElementById('btnFecharTempoEncerrado');
    if (btnFecharTempoEncerrado) btnFecharTempoEncerrado.addEventListener('click', fecharModalTempoEncerrado);

    const btnCancelarEmergencia = document.getElementById('btnCancelarEmergencia');
    const btnConfirmarDesativar = document.getElementById('btnConfirmarDesativarEmergencia');
    if (btnCancelarEmergencia) btnCancelarEmergencia.addEventListener('click', fecharModalDesativarEmergencia);
    if (btnConfirmarDesativar) btnConfirmarDesativar.addEventListener('click', desativarEmergencia);
}

// =============================================
//  MODAIS GENÉRICOS
// =============================================
function abrirModalFechar() { const m = document.getElementById('modalFechar'); if (m) m.classList.remove('hidden'); }
function fecharModalFechar() { const m = document.getElementById('modalFechar'); if (m) m.classList.add('hidden'); }

function mostrarModalTempoEncerrado() { const m = document.getElementById('modalTempoEncerrado'); if (m) m.classList.remove('hidden'); }
function fecharModalTempoEncerrado() { const m = document.getElementById('modalTempoEncerrado'); if (m) m.classList.add('hidden'); }

function abrirModalDesativarEmergencia() { const m = document.getElementById('modalDesativarEmergencia'); if (m) m.classList.remove('hidden'); }
function fecharModalDesativarEmergencia() { const m = document.getElementById('modalDesativarEmergencia'); if (m) m.classList.add('hidden'); }

// =============================================
//  DRUM PICKER
// =============================================
const drumState = { horas: 0, minutos: 0, segundos: 0 };

function criarDrum(elId, max, loop) {
    const el = document.getElementById(elId);
    if (!el) return;

    const ITEM_H = 36;
    const VISIBLE = 3;
    let current = 0, startY = 0, isDragging = false, startOffset = 0, currentOffset = 0;
    const count = max + 1;

    el.innerHTML = '';
    for (let i = 0; i < VISIBLE; i++) { const p = document.createElement('div'); p.className = 'drum-item'; el.appendChild(p); }
    for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'drum-item';
        item.textContent = String(i).padStart(2, '0');
        if (i === 0) item.classList.add('selected');
        el.appendChild(item);
    }
    for (let i = 0; i < VISIBLE; i++) { const p = document.createElement('div'); p.className = 'drum-item'; el.appendChild(p); }

    function getOffset(index) { return -(index + VISIBLE) * ITEM_H + (120 / 2) - ITEM_H / 2; }

    function snapTo(index, animate) {
        if (loop) current = ((index % count) + count) % count;
        else current = Math.max(0, Math.min(max, index));

        el.style.transition = animate ? 'transform 0.18s ease' : 'none';
        el.style.transform = `translateY(${getOffset(current)}px)`;

        el.querySelectorAll('.drum-item').forEach((item, i) => {
            item.classList.toggle('selected', i === current + VISIBLE);
        });

        if (elId === 'drumHoras') drumState.horas = current;
        if (elId === 'drumMinutos') drumState.minutos = current;
        if (elId === 'drumSegundos') drumState.segundos = current;
    }

    snapTo(0, false);

    el.parentElement.addEventListener('mousedown', (e) => {
        isDragging = true; startY = e.clientY; startOffset = getOffset(current);
        el.style.transition = 'none'; e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentOffset = startOffset + (e.clientY - startY);
        el.style.transform = `translateY(${currentOffset}px)`;
    });
    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        snapTo(current + Math.round(-(e.clientY - startY) / ITEM_H), true);
    });

    el.parentElement.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY; startOffset = getOffset(current); el.style.transition = 'none';
    }, { passive: true });
    el.parentElement.addEventListener('touchmove', (e) => {
        currentOffset = startOffset + (e.touches[0].clientY - startY);
        el.style.transform = `translateY(${currentOffset}px)`;
    }, { passive: true });
    el.parentElement.addEventListener('touchend', (e) => {
        snapTo(current + Math.round(-(e.changedTouches[0].clientY - startY) / ITEM_H), true);
    });
    el.parentElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        snapTo(current + (e.deltaY > 0 ? 1 : -1), true);
    }, { passive: false });

    return { snapTo };
}

let drumInstances = {};

function inicializarDrums() {
    drumInstances.horas = criarDrum('drumHoras', 99, false);
    drumInstances.minutos = criarDrum('drumMinutos', 59, true);
    drumInstances.segundos = criarDrum('drumSegundos', 59, true);
}

function resetarDrums() {
    if (drumInstances.horas) drumInstances.horas.snapTo(0, false);
    if (drumInstances.minutos) drumInstances.minutos.snapTo(0, false);
    if (drumInstances.segundos) drumInstances.segundos.snapTo(0, false);
    drumState.horas = drumState.minutos = drumState.segundos = 0;
}

// =============================================
//  MODAL DE TIMER
// =============================================
function abrirModalTimer() {
    resetarDrums();
    const modal = document.getElementById('modalTimer');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalTimer() {
    const modal = document.getElementById('modalTimer');
    if (modal) modal.classList.add('hidden');
}

function confirmarTimer() {
    tempoLimite = (drumState.horas * 3600) + (drumState.minutos * 60) + drumState.segundos;

    if (tempoLimite <= 0) {
        const hint = document.getElementById('drumHint');
        if (hint) {
            hint.textContent = 'Defina um tempo antes de iniciar.';
            hint.style.display = 'block';
            setTimeout(() => { hint.style.display = 'none'; }, 3000);
        }
        return;
    }
    fecharModalTimer();
    iniciarProcesso();
}

// =============================================
//  MANGUEIRAS / VÁLVULAS
// =============================================
function validarMangueiras() { validarBotaoIniciar(); }

function atualizarStatusValvulas() {
    [1, 2, 3].forEach(n => atualizarValvulaVisual(n, servos[n]));
    validarBotaoIniciar();
}

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

    if (angleEl) angleEl.textContent = angulo + '\u00B0';
    if (angleTxtEl) angleTxtEl.textContent = angulo + '\u00B0';
    if (indicatorEl) indicatorEl.style.transform = `rotate(${angulo}deg)`;

    // Pressão/fluxo mostrados apenas durante processo, via dados reais da API
    if (!processoEmAndamento) {
        if (pressureEl) pressureEl.textContent = '-- mBar';
        if (flowEl) flowEl.textContent = '-- LPM';
    }

    const status = angulo > 100 ? 'FECHADA' : 'ABERTA';
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = 'valve-status ' + (status === 'ABERTA' ? 'on' : 'off');
    }

    validarBotaoIniciar();
}

// =============================================
//  PROCESSO E TIMER
// =============================================
function iniciarProcesso() {
    if (!mangueiras[1] && !mangueiras[2] && !mangueiras[3]) {
        alert('Conecte pelo menos 1 tubo para iniciar!');
        return;
    }
    if (servos[1] !== 80 && servos[2] !== 80 && servos[3] !== 80) {
        alert('Abra pelo menos 1 valvula para iniciar!');
        return;
    }

    processoEmAndamento = true;
    tempoDecorrido = 0;

    const btnIniciar = document.getElementById('btnIniciar');
    if (btnIniciar) btnIniciar.disabled = true;

    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'PROCESSANDO'; statusEl.style.color = ''; }

    const timerLimitEl = document.getElementById('timerLimit');
    if (timerLimitEl) timerLimitEl.textContent = '';

    // Exibe contagem regressiva inicial
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) {
        const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
        const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
        const ls = (tempoLimite % 60).toString().padStart(2, '0');
        timerEl.textContent = `${lh}:${lm}:${ls}`;
    }

    // Limpa gráfico
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
            const tEl2 = document.getElementById('timerDisplay');
            if (tEl2) tEl2.textContent = '00:00:00';

            const sEl2 = document.getElementById('status-estado');
            if (sEl2) { sEl2.textContent = 'CONCLUIDO'; sEl2.style.color = '#6a9'; }

            const lEl2 = document.getElementById('timerLimit');
            if (lEl2) lEl2.textContent = 'TEMPO ENCERRADO';

            gerarRelatorioPDF();
            mostrarModalTempoEncerrado();
        }
    }, 1000);

    if (window.apiInterval) clearInterval(window.apiInterval);
    window.apiInterval = setInterval(buscarDadosDaAPI, 1000);

    console.log('Processo iniciado. Limite:', tempoLimite + 's');
}

function pararProcesso() {
    processoEmAndamento = false;
    if (timerInterval) clearInterval(timerInterval);
    if (window.apiInterval) clearInterval(window.apiInterval);

    const btnIniciar = document.getElementById('btnIniciar');
    if (btnIniciar) btnIniciar.disabled = false;

    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'OPERACIONAL'; statusEl.style.color = ''; }
}

// =============================================
//  EMERGÊNCIA
// =============================================
function emergencia() {
    if (modoEmergencia) { abrirModalDesativarEmergencia(); return; }

    modoEmergencia = true;
    pararProcesso();
    tempoDecorrido = tempoLimite = 0;

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';

    const timerLimitEl = document.getElementById('timerLimit');
    if (timerLimitEl) timerLimitEl.textContent = '';

    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'EMERGENCIA'; statusEl.style.color = '#ff6b6b'; }

    servos[1] = servos[2] = servos[3] = 155;
    [1, 2, 3].forEach(n => atualizarValvulaVisual(n, 155));
    mostrarDadosIniciais();
    bloquearInterface(true);

    const btnEmergencia = document.getElementById('btnEmergencia');
    if (btnEmergencia) {
        btnEmergencia.textContent = 'DESATIVAR EMERGENCIA';
        btnEmergencia.classList.add('btn-emergency-ativa');
    }

    console.log('EMERGENCIA ATIVADA');
}

function bloquearInterface(bloquear) {
    const opacity = bloquear ? '0.3' : '';
    const cursor = bloquear ? 'not-allowed' : '';

    document.querySelectorAll('.mangueira-button, .servo-button').forEach(btn => {
        btn.disabled = bloquear;
        btn.style.opacity = opacity;
        btn.style.cursor = cursor;
    });

    ['btnIniciar', 'btnRelatorio'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.disabled = bloquear; el.style.opacity = opacity; }
    });

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.style.pointerEvents = bloquear ? 'none' : '';
        btn.style.opacity = opacity;
    });
}

function desativarEmergencia() {
    modoEmergencia = false;
    fecharModalDesativarEmergencia();

    const statusEl = document.getElementById('status-estado');
    if (statusEl) { statusEl.textContent = 'OPERACIONAL'; statusEl.style.color = ''; }

    const btnEmergencia = document.getElementById('btnEmergencia');
    if (btnEmergencia) {
        btnEmergencia.textContent = 'EMERGENCIA';
        btnEmergencia.classList.remove('btn-emergency-ativa');
    }

    bloquearInterface(false);
    validarBotaoIniciar();
    console.log('EMERGENCIA DESATIVADA');
}

// =============================================
//  GAUGES
//  gauge1 = pressão câmara  (mBar, -1000~0)
//  gauge2 = temperatura     (°C,   0~100)
//  gauge3/4/5 = fluxo 1/2/3 (LPM,  0~20)
//  gauge6 = diferencial     (mBar, 0~5)
// =============================================
function atualizarGauges(temp, fluxo1, fluxo2, fluxo3, diferencial) {
    const percentTemp = Math.min((temp / 100) * 100, 100);
    const g2 = document.getElementById('gaugeBar2');
    const v2 = document.getElementById('gaugeValue2');
    if (g2) g2.style.height = percentTemp + '%';
    if (v2) v2.textContent = temp.toFixed(1) + ' C';

    const percentF1 = Math.min((fluxo1 / 20) * 100, 100);
    const g3 = document.getElementById('gaugeBar3');
    const v3 = document.getElementById('gaugeValue3');
    if (g3) g3.style.height = percentF1 + '%';
    if (v3) v3.textContent = fluxo1.toFixed(1) + ' LPM';

    const percentF2 = Math.min((fluxo2 / 20) * 100, 100);
    const g4 = document.getElementById('gaugeBar4');
    const v4 = document.getElementById('gaugeValue4');
    if (g4) g4.style.height = percentF2 + '%';
    if (v4) v4.textContent = fluxo2.toFixed(1) + ' LPM';

    const percentF3 = Math.min((fluxo3 / 20) * 100, 100);
    const g5 = document.getElementById('gaugeBar5');
    const v5 = document.getElementById('gaugeValue5');
    if (g5) g5.style.height = percentF3 + '%';
    if (v5) v5.textContent = fluxo3.toFixed(1) + ' LPM';

    const percentDif = Math.min((Math.abs(diferencial) / 5) * 100, 100);
    const g6 = document.getElementById('gaugeBar6');
    const v6 = document.getElementById('gaugeValue6');
    if (g6) g6.style.height = percentDif + '%';
    if (v6) v6.textContent = diferencial.toFixed(2) + ' mBar';
}

// =============================================
//  BUSCAR DADOS DA API
//  A API já retorna os valores em mBar (float).
//  Nenhuma conversão é necessária aqui.
// =============================================
async function buscarDadosDaAPI() {
    if (!processoEmAndamento) return;

    try {
        const response = await fetch(`${API_URL}/leiturasSensores?limit=1`);
        if (!response.ok) { console.error('Erro API:', response.status); return; }

        const leituras = await response.json();
        if (!leituras || leituras.length === 0) { console.warn('Nenhuma leitura disponível'); return; }

        const leitura = leituras[0];

        // Campos pressaoCamaraMbar, pressaoTuboNMbar e fluxoTuboNLPM
        // já chegam em mBar e LPM diretamente do banco de dados.
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

    } catch (error) {
        console.error('Erro ao conectar com API:', error.message);
    }
}

// =============================================
//  ATUALIZAR DASHBOARD COM DADOS REAIS
// =============================================
function atualizarDados(dados) {
    // Pressão câmara
    const infoPressaoEl = document.getElementById('infoPressao');
    if (infoPressaoEl) infoPressaoEl.textContent = dados.pressaoCamaraMbar.toFixed(2);

    const pressaoValueEl = document.getElementById('pressaoValue');
    if (pressaoValueEl) pressaoValueEl.textContent = dados.pressaoCamaraMbar.toFixed(2) + ' mBar';

    // Temperatura
    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = dados.temperaturaOleo.toFixed(1);

    // Pressões por tubo
    [1, 2, 3].forEach(n => {
        const el = document.getElementById(`infoPressaoM${n}`);
        if (el) el.textContent = dados[`pressaoTubo${n}Mbar`].toFixed(2);
    });

    // Fase baseada na pressão da câmara (sensor -100~0 kPa = -1000~0 mBar)
    // -1000 ~ -600 mBar: vácuo alto (sucção intensa)
    // -600  ~ -200 mBar: vácuo estável
    // -200  ~    0 mBar: pressão baixa
    const p = dados.pressaoCamaraMbar;
    const fase = p < -600 ? 'SUCCAO' : p <= -200 ? 'ESTAVEL' : 'PRESSAO BAIXA';
    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = fase;

    // Gráfico
    if (window.vacuoChart) {
        const agora = new Date().toLocaleTimeString();
        window.vacuoChart.data.labels.push(agora);
        window.vacuoChart.data.datasets[0].data.push(dados.pressaoCamaraMbar);
        if (window.vacuoChart.data.labels.length > 30) {
            window.vacuoChart.data.labels.shift();
            window.vacuoChart.data.datasets[0].data.shift();
        }
        window.vacuoChart.update();
    }

    // Diferencial entre tubos
    const pressoes = [dados.pressaoTubo1Mbar, dados.pressaoTubo2Mbar, dados.pressaoTubo3Mbar];
    const diferencial = Math.max(...pressoes) - Math.min(...pressoes);

    atualizarGauges(
        dados.temperaturaOleo,
        dados.fluxoTubo1LPM,
        dados.fluxoTubo2LPM,
        dados.fluxoTubo3LPM,
        diferencial
    );

    // Painel de válvulas
    [1, 2, 3].forEach(n => {
        const pEl = document.getElementById(`valvePressure${n}`);
        const fEl = document.getElementById(`valveFlow${n}`);
        if (pEl) pEl.textContent = dados[`pressaoTubo${n}Mbar`].toFixed(1) + ' mBar';
        if (fEl) fEl.textContent = dados[`fluxoTubo${n}LPM`].toFixed(1) + ' LPM';
    });
}

// =============================================
//  HISTÓRICO DE CICLOS (localStorage)
// =============================================
function salvarCicloNoHistorico() {
    const agora = new Date();
    const chave = `ciclos_vacuo_${agora.getFullYear()}_${String(agora.getMonth() + 1).padStart(2, '0')}`;

    let ciclos = [];
    try { ciclos = JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { /* noop */ }

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');

    ciclos.push({
        id: cicloAtualId,
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
        temperatura: dadosAtual ? dadosAtual.temperaturaOleo.toFixed(1) : '--',
        tubo1: mangueiras[1] ? 'CONECTADO' : 'DESCONECTADO',
        tubo2: mangueiras[2] ? 'CONECTADO' : 'DESCONECTADO',
        tubo3: mangueiras[3] ? 'CONECTADO' : 'DESCONECTADO',
        servo: dadosAtual ? dadosAtual.servoAngulo + ' graus' : '--',
    });

    localStorage.setItem(chave, JSON.stringify(ciclos));
    cicloAtualId++;
    console.log('Ciclo salvo. Total no mes:', ciclos.length);
}

// =============================================
//  RELATÓRIO PDF - CICLO
// =============================================
async function gerarRelatorioPDF() {
    salvarCicloNoHistorico();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(232, 232, 232);
    doc.setFontSize(20);
    doc.text('RELATORIO - SISTEMA DE VACUO', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);
    doc.text('TSEA Energy', 105, 25, { align: 'center' });
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 105, 31, { align: 'center' });

    let y = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('DADOS DO CICLO', 20, y); y += 10;
    doc.setFontSize(10);

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');

    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, y); y += 8;
    doc.text(`Ciclo ID: ${cicloAtualId}`, 20, y); y += 8;
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 20, y); y += 8;
    doc.text(`Tempo de Operacao: ${lh}:${lm}:${ls}`, 20, y); y += 8;

    const statusEl = document.getElementById('status-estado');
    doc.text(`Estado: ${statusEl ? statusEl.textContent : '--'}`, 20, y); y += 15;

    doc.setFontSize(12);
    doc.text('PRESSOES E FLUXOS', 20, y); y += 10;
    doc.setFontSize(10);

    if (dadosAtual) {
        doc.text(`Camara: ${dadosAtual.pressaoCamaraMbar.toFixed(2)} mBar`, 20, y); y += 8;
        doc.text(`Tubo 1: ${dadosAtual.pressaoTubo1Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo1LPM.toFixed(1)} LPM`, 20, y); y += 8;
        doc.text(`Tubo 2: ${dadosAtual.pressaoTubo2Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo2LPM.toFixed(1)} LPM`, 20, y); y += 8;
        doc.text(`Tubo 3: ${dadosAtual.pressaoTubo3Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo3LPM.toFixed(1)} LPM`, 20, y); y += 8;
        doc.text(`Temperatura Oleo: ${dadosAtual.temperaturaOleo.toFixed(1)} C`, 20, y); y += 15;
    } else {
        doc.text('Nenhum dado de processo disponivel.', 20, y); y += 15;
    }

    doc.setFontSize(12);
    doc.text('STATUS DOS COMPONENTES', 20, y); y += 10;
    doc.setFontSize(10);
    doc.text(`Bomba: ${dadosAtual ? (dadosAtual.bombaLigada ? 'LIGADA' : 'DESLIGADA') : '--'}`, 20, y); y += 8;
    doc.text(`Servo: ${dadosAtual ? dadosAtual.servoAngulo + ' graus' : '--'}`, 20, y); y += 8;
    doc.text(`Tubo 1: ${mangueiras[1] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 8;
    doc.text(`Tubo 2: ${mangueiras[2] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y); y += 8;
    doc.text(`Tubo 3: ${mangueiras[3] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, y);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text('Relatorio gerado automaticamente - TSEA Energy', 105, 280, { align: 'center' });

    const filename = `ciclo_${cicloAtualId}_${usuarioAtual || 'anonimo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    console.log('PDF ciclo gerado:', filename);
}

// =============================================
//  RELATÓRIO MENSAL
// =============================================
async function gerarRelatorioMensal() {
    const { jsPDF } = window.jspdf;
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const chave = `ciclos_vacuo_${ano}_${String(mes).padStart(2, '0')}`;

    let ciclos = [];
    try { ciclos = JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { /* noop */ }

    const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = meses[mes - 1];

    const doc = new jsPDF();

    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(232, 232, 232);
    doc.setFontSize(18);
    doc.text('RELATORIO MENSAL - SISTEMA DE VACUO', 105, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(170, 170, 170);
    doc.text('TSEA Energy', 105, 23, { align: 'center' });
    doc.text(`${nomeMes} / ${ano}   —   Gerado em: ${agora.toLocaleString('pt-BR')}`, 105, 31, { align: 'center' });
    doc.text(`Operador solicitante: ${usuarioAtual || 'Nao identificado'}`, 105, 38, { align: 'center' });

    let y = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    if (ciclos.length === 0) {
        doc.text(`Nenhum ciclo registrado em ${nomeMes} de ${ano}.`, 20, y);
    } else {
        doc.text(`Total de ciclos em ${nomeMes}: ${ciclos.length}`, 20, y); y += 14;

        ciclos.forEach((c) => {
            if (y > 255) { doc.addPage(); y = 20; }

            doc.setFillColor(235, 235, 235);
            doc.rect(15, y - 4, 180, 7, 'F');
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`CICLO #${c.id}   —   ${c.dataHora}   —   Operador: ${c.operador}`, 18, y + 1);
            doc.setFont(undefined, 'normal');
            y += 11;

            doc.setTextColor(60, 60, 60);
            doc.setFontSize(9);
            doc.text(`Duracao: ${c.tempoOperacao}`, 20, y); y += 6;
            doc.text(`Pressao Camara: ${c.pressaoCamara} mBar   |   Temperatura: ${c.temperatura} C`, 20, y); y += 6;
            doc.text(`Tubo 1: ${c.pressaoT1} mBar / ${c.fluxoT1} LPM   |   Tubo 2: ${c.pressaoT2} mBar / ${c.fluxoT2} LPM   |   Tubo 3: ${c.pressaoT3} mBar / ${c.fluxoT3} LPM`, 20, y); y += 6;
            doc.text(`Conexoes: T1 ${c.tubo1}  |  T2 ${c.tubo2}  |  T3 ${c.tubo3}   |   Servo: ${c.servo}`, 20, y); y += 12;
        });
    }

    doc.setTextColor(140, 140, 140);
    doc.setFontSize(8);
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.text(`TSEA Energy  —  Relatorio Mensal ${nomeMes}/${ano}  —  Pagina ${p} de ${totalPages}`, 105, 290, { align: 'center' });
    }

    const filename = `relatorio_mensal_${ano}_${String(mes).padStart(2, '0')}_${usuarioAtual || 'anonimo'}.pdf`;
    doc.save(filename);
    console.log('Relatorio mensal gerado:', filename, '| Ciclos:', ciclos.length);
}

// =============================================
//  RELÓGIO
// =============================================
function atualizarRelogio() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = String(agora.getFullYear()).slice(-2);
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    const seg = String(agora.getSeconds()).padStart(2, '0');

    const relogio = document.getElementById('relogioDisplay');
    if (relogio) relogio.textContent = `TSEA Energy  |  ${dia}/${mes}/${ano}  ${hora}:${min}:${seg}`;
}