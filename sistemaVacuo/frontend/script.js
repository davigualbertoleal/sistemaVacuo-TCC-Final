// =============================================
//  SCRIPT - Sistema de Vacuo
//  VERSAO ATUALIZADA
// =============================================

const API_URL = "http://localhost:5000/api";
let usuarioAtual = null;
let timerInterval = null;
let tempoDecorrido = 0;
let tempoLimite = 0; // 0 = indeterminado
let processoEmAndamento = false;
let dashboardCarregado = false;

// Tubos iniciam DESCONECTADOS (false)
const mangueiras = { 1: false, 2: false, 3: false };
const servos = { 1: 155, 2: 155, 3: 155 };
let dadosAtual = null;
let cicloAtualId = 1;

// =============================================
//  INICIALIZACAO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado');
    // Login sempre obrigatorio — ignora qualquer sessao salva
    mostrarModalLogin();
    configurarEventosLogin();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();
});

// =============================================
//  AUTENTICACAO
// =============================================
function configurarEventosLogin() {
    const btnConfirmar = document.getElementById('btnConfirmarId');
    const inputId = document.getElementById('inputId');

    if (btnConfirmar) btnConfirmar.addEventListener('click', validarId);

    if (inputId) {
        inputId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validarId();
        });
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
    const id = inputId.value.trim().toUpperCase();
    const errorMsg = document.getElementById('errorMsg');

    if (!id) {
        mostrarErro('Digite um ID valido!', errorMsg);
        return;
    }

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
        console.log('API offline, validacao local');
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
        console.log('Inicializando dashboard');
        inicializarDashboard();
    } else {
        // Relogin: apenas atualiza nome, nao reinicia tudo
        console.log('Relogin detectado, atualizando usuario');
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
    const infoPressaoEl = document.getElementById('infoPressao');
    if (infoPressaoEl) infoPressaoEl.textContent = '--';

    const pressaoValueEl = document.getElementById('pressaoValue');
    if (pressaoValueEl) pressaoValueEl.textContent = '--';

    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = '--';

    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = 'AGUARDANDO';

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';

    const timerLimitEl = document.getElementById('timerLimit');
    if (timerLimitEl) timerLimitEl.textContent = '';

    // Inicializar gauges
    atualizarGauges(0, 0, 0, 0, 0);

    // Inicializar pressoes dos tubos
    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`infoPressaoM${n}`);
        if (p) p.textContent = '--';
    });

    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`valvePressure${n}`);
        const f = document.getElementById(`valveFlow${n}`);
        if (p) p.textContent = '-- mBar';
        if (f) f.textContent = '-- LPM';
    });

    // Garantir que tubos mostram estado desligado
    [1, 2, 3].forEach(n => {
        const btn = document.getElementById(`btnMangueira${n}`);
        if (btn) {
            btn.classList.remove('conectada');
            btn.textContent = `Tubo ${n}`;
        }
    });
}

// =============================================
//  GRAFICO
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
                fill: {
                    target: 'origin',
                    above: 'rgba(232, 232, 232, 0.08)'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: 0,
                    max: 1000,
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

            if (mangueiras[num]) {
                btn.classList.add('conectada');
                btn.textContent = `Tubo ${num}`;
            } else {
                btn.classList.remove('conectada');
                btn.textContent = `Tubo ${num}`;
            }

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

    // Iniciar abre o modal de timer primeiro
    if (btnIniciar) btnIniciar.addEventListener('click', abrirModalTimer);
    if (btnEmergencia) btnEmergencia.addEventListener('click', emergencia);
    if (btnRelatorio) btnRelatorio.addEventListener('click', gerarRelatorioMensal);

    if (btnFechar) {
        btnFechar.addEventListener('click', () => {
            abrirModalFechar();
        });
    }

    const btnCancelar = document.getElementById('btnCancelarFechar');
    const btnConfirmar = document.getElementById('btnConfirmarFechar');

    if (btnCancelar) btnCancelar.addEventListener('click', fecharModalFechar);
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', () => {
            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage('fechar_app');
            } else {
                window.close();
            }
        });
    }

    // Botoes do modal de timer
    const btnCancelarTimer = document.getElementById('btnCancelarTimer');
    const btnConfirmarTimer = document.getElementById('btnConfirmarTimer');

    if (btnCancelarTimer) btnCancelarTimer.addEventListener('click', fecharModalTimer);
    if (btnConfirmarTimer) btnConfirmarTimer.addEventListener('click', confirmarTimer);

    // Botoes do modal de tempo encerrado
    const btnFecharTempoEncerrado = document.getElementById('btnFecharTempoEncerrado');
    if (btnFecharTempoEncerrado) btnFecharTempoEncerrado.addEventListener('click', fecharModalTempoEncerrado);

    // Botoes do modal de desativar emergencia
    const btnCancelarEmergencia = document.getElementById('btnCancelarEmergencia');
    const btnConfirmarDesativar = document.getElementById('btnConfirmarDesativarEmergencia');

    if (btnCancelarEmergencia) btnCancelarEmergencia.addEventListener('click', fecharModalDesativarEmergencia);
    if (btnConfirmarDesativar) btnConfirmarDesativar.addEventListener('click', desativarEmergencia);
}

// =============================================
//  MODAL DE CONFIRMACAO FECHAR
// =============================================
function abrirModalFechar() {
    const modal = document.getElementById('modalFechar');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalFechar() {
    const modal = document.getElementById('modalFechar');
    if (modal) modal.classList.add('hidden');
}

// =============================================
//  DRUM PICKER
// =============================================
const drumState = { horas: 0, minutos: 0, segundos: 0 };

function criarDrum(elId, max, loop) {
    const el = document.getElementById(elId);
    if (!el) return;

    const ITEM_H = 36;
    const VISIBLE = 3; // itens visíveis acima/abaixo do centro
    let current = 0;
    let startY = 0;
    let isDragging = false;
    let startOffset = 0;
    let currentOffset = 0;

    // Preenche itens: para loop (min/seg), duplica 3x para scroll infinito suave
    const count = max + 1; // 0..max
    el.innerHTML = '';

    // Padding fantasma no topo
    for (let i = 0; i < VISIBLE; i++) {
        const pad = document.createElement('div');
        pad.className = 'drum-item';
        el.appendChild(pad);
    }

    for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'drum-item';
        item.textContent = String(i).padStart(2, '0');
        if (i === 0) item.classList.add('selected');
        el.appendChild(item);
    }

    // Padding fantasma no fundo
    for (let i = 0; i < VISIBLE; i++) {
        const pad = document.createElement('div');
        pad.className = 'drum-item';
        el.appendChild(pad);
    }

    function getOffset(index) {
        return -(index + VISIBLE) * ITEM_H + (120 / 2) - ITEM_H / 2;
    }

    function snapTo(index, animate) {
        if (loop) {
            current = ((index % count) + count) % count;
        } else {
            current = Math.max(0, Math.min(max, index));
        }
        if (animate) {
            el.style.transition = 'transform 0.18s ease';
        } else {
            el.style.transition = 'none';
        }
        el.style.transform = `translateY(${getOffset(current)}px)`;

        // Atualiza visual selected
        el.querySelectorAll('.drum-item').forEach((item, i) => {
            item.classList.toggle('selected', i === current + VISIBLE);
        });

        // Salva valor
        if (elId === 'drumHoras') drumState.horas = current;
        if (elId === 'drumMinutos') drumState.minutos = current;
        if (elId === 'drumSegundos') drumState.segundos = current;
    }

    snapTo(0, false);

    // Mouse
    el.parentElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startOffset = getOffset(current);
        el.style.transition = 'none';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = e.clientY - startY;
        currentOffset = startOffset + delta;
        el.style.transform = `translateY(${currentOffset}px)`;
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const delta = e.clientY - startY;
        const steps = Math.round(-delta / ITEM_H);
        snapTo(current + steps, true);
    });

    // Touch
    el.parentElement.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startOffset = getOffset(current);
        el.style.transition = 'none';
    }, { passive: true });

    el.parentElement.addEventListener('touchmove', (e) => {
        const delta = e.touches[0].clientY - startY;
        currentOffset = startOffset + delta;
        el.style.transform = `translateY(${currentOffset}px)`;
    }, { passive: true });

    el.parentElement.addEventListener('touchend', (e) => {
        const delta = e.changedTouches[0].clientY - startY;
        const steps = Math.round(-delta / ITEM_H);
        snapTo(current + steps, true);
    });

    // Scroll de roda do mouse
    el.parentElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const steps = e.deltaY > 0 ? 1 : -1;
        snapTo(current + steps, true);
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
    drumState.horas = 0;
    drumState.minutos = 0;
    drumState.segundos = 0;
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
//  MANGUEIRAS
// =============================================
function validarMangueiras() {
    validarBotaoIniciar();
}

// =============================================
//  VALVULAS
// =============================================
function atualizarStatusValvulas() {
    [1, 2, 3].forEach(n => {
        atualizarValvulaVisual(n, servos[n]);
    });
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

    if (processoEmAndamento) {
        const pressao = (angulo / 180) * 500;
        if (pressureEl) pressureEl.textContent = pressao.toFixed(0) + ' mBar';
        if (flowEl) flowEl.textContent = (pressao / 200).toFixed(1) + ' LPM';
    } else {
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
    if (statusEl) {
        statusEl.textContent = 'PROCESSANDO';
        statusEl.style.color = '';
    }

    // Exibir tempo limite configurado
    const timerLimitEl = document.getElementById('timerLimit');
    if (timerLimitEl) timerLimitEl.textContent = '';

    // Mostrar contagem regressiva imediatamente
    const timerElInicial = document.getElementById('timerDisplay');
    if (timerElInicial) {
        const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
        const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
        const ls = (tempoLimite % 60).toString().padStart(2, '0');
        timerElInicial.textContent = `${lh}:${lm}:${ls}`;
    }

    // Limpar grafico
    if (window.vacuoChart) {
        window.vacuoChart.data.labels = [];
        window.vacuoChart.data.datasets[0].data = [];
        window.vacuoChart.update();
    }

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        tempoDecorrido++;

        // Contagem regressiva
        const restante = Math.max(tempoLimite - tempoDecorrido, 0);
        const h = Math.floor(restante / 3600).toString().padStart(2, '0');
        const m = Math.floor((restante % 3600) / 60).toString().padStart(2, '0');
        const s = (restante % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timerDisplay');
        if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;

        // Verificar se atingiu o limite
        if (tempoDecorrido >= tempoLimite) {
            pararProcesso();

            const timerEl2 = document.getElementById('timerDisplay');
            if (timerEl2) timerEl2.textContent = '00:00:00';

            const statusEl2 = document.getElementById('status-estado');
            if (statusEl2) {
                statusEl2.textContent = 'CONCLUIDO';
                statusEl2.style.color = '#6a9';
            }
            const timerLimitEl2 = document.getElementById('timerLimit');
            if (timerLimitEl2) timerLimitEl2.textContent = 'TEMPO ENCERRADO';

            // Relatório automático
            gerarRelatorioPDF();
            mostrarModalTempoEncerrado();
        }
    }, 1000);

    if (window.simInterval) clearInterval(window.simInterval);
    window.simInterval = setInterval(simularDados, 1000);

    console.log('Processo iniciado. Limite:', tempoLimite > 0 ? tempoLimite + 's' : 'indeterminado');
}

function pararProcesso() {
    processoEmAndamento = false;
    if (timerInterval) clearInterval(timerInterval);
    if (window.simInterval) clearInterval(window.simInterval);

    const btnIniciar = document.getElementById('btnIniciar');
    if (btnIniciar) btnIniciar.disabled = false;

    const statusEl = document.getElementById('status-estado');
    if (statusEl) {
        statusEl.textContent = 'OPERACIONAL';
        statusEl.style.color = '';
    }
}

let modoEmergencia = false;

function emergencia() {
    if (modoEmergencia) {
        // Ja em emergencia: abre modal para desativar
        abrirModalDesativarEmergencia();
        return;
    }

    // Ativar emergencia
    modoEmergencia = true;
    pararProcesso();
    tempoDecorrido = 0;
    tempoLimite = 0;

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';

    const timerLimitEl = document.getElementById('timerLimit');
    if (timerLimitEl) timerLimitEl.textContent = '';

    const statusEl = document.getElementById('status-estado');
    if (statusEl) {
        statusEl.textContent = 'EMERGENCIA';
        statusEl.style.color = '#ff6b6b';
    }

    servos[1] = 155;
    servos[2] = 155;
    servos[3] = 155;
    atualizarValvulaVisual(1, 155);
    atualizarValvulaVisual(2, 155);
    atualizarValvulaVisual(3, 155);

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
    // Tubos
    document.querySelectorAll('.mangueira-button').forEach(btn => {
        btn.disabled = bloquear;
        btn.style.opacity = bloquear ? '0.3' : '';
        btn.style.cursor = bloquear ? 'not-allowed' : '';
    });

    // Servos / valvulas
    document.querySelectorAll('.servo-button').forEach(btn => {
        btn.disabled = bloquear;
        btn.style.opacity = bloquear ? '0.3' : '';
        btn.style.cursor = bloquear ? 'not-allowed' : '';
    });

    // Botoes principais (exceto emergencia e relatorio)
    const btnIniciar = document.getElementById('btnIniciar');
    const btnRelatorio = document.getElementById('btnRelatorio');
    if (btnIniciar) {
        btnIniciar.disabled = bloquear;
        btnIniciar.style.opacity = bloquear ? '0.3' : '';
    }
    if (btnRelatorio) {
        btnRelatorio.disabled = bloquear;
        btnRelatorio.style.opacity = bloquear ? '0.3' : '';
    }

    // Abas
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (bloquear) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.3';
        } else {
            btn.style.pointerEvents = '';
            btn.style.opacity = '';
        }
    });
}

function abrirModalDesativarEmergencia() {
    const modal = document.getElementById('modalDesativarEmergencia');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalDesativarEmergencia() {
    const modal = document.getElementById('modalDesativarEmergencia');
    if (modal) modal.classList.add('hidden');
}

function desativarEmergencia() {
    modoEmergencia = false;
    fecharModalDesativarEmergencia();

    const statusEl = document.getElementById('status-estado');
    if (statusEl) {
        statusEl.textContent = 'OPERACIONAL';
        statusEl.style.color = '';
    }

    const btnEmergencia = document.getElementById('btnEmergencia');
    if (btnEmergencia) {
        btnEmergencia.textContent = 'EMERGENCIA';
        btnEmergencia.classList.remove('btn-emergency-ativa');
    }

    bloquearInterface(false);
    validarBotaoIniciar();

    console.log('EMERGENCIA DESATIVADA');
}

function mostrarModalTempoEncerrado() {
    const modal = document.getElementById('modalTempoEncerrado');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalTempoEncerrado() {
    const modal = document.getElementById('modalTempoEncerrado');
    if (modal) modal.classList.add('hidden');
}

// =============================================
//  GAUGES (BARRAS VERTICAIS)
// =============================================
function atualizarGauges(temp, fluxo1, fluxo2, fluxo3, diferencial) {
    const percentTemp = Math.min((temp / 100) * 100, 100);
    const gauge2 = document.getElementById('gaugeBar2');
    if (gauge2) gauge2.style.height = percentTemp + '%';
    const value2 = document.getElementById('gaugeValue2');
    if (value2) value2.textContent = temp.toFixed(1) + ' C';

    const percentFluxo1 = Math.min((fluxo1 / 20) * 100, 100);
    const gauge3 = document.getElementById('gaugeBar3');
    if (gauge3) gauge3.style.height = percentFluxo1 + '%';
    const value3 = document.getElementById('gaugeValue3');
    if (value3) value3.textContent = fluxo1.toFixed(1) + ' LPM';

    const percentFluxo2 = Math.min((fluxo2 / 20) * 100, 100);
    const gauge4 = document.getElementById('gaugeBar4');
    if (gauge4) gauge4.style.height = percentFluxo2 + '%';
    const value4 = document.getElementById('gaugeValue4');
    if (value4) value4.textContent = fluxo2.toFixed(1) + ' LPM';

    const percentFluxo3 = Math.min((fluxo3 / 20) * 100, 100);
    const gauge5 = document.getElementById('gaugeBar5');
    if (gauge5) gauge5.style.height = percentFluxo3 + '%';
    const value5 = document.getElementById('gaugeValue5');
    if (value5) value5.textContent = fluxo3.toFixed(1) + ' LPM';

    const percentDif = Math.min((diferencial / 5) * 100, 100);
    const gauge6 = document.getElementById('gaugeBar6');
    if (gauge6) gauge6.style.height = percentDif + '%';
    const value6 = document.getElementById('gaugeValue6');
    if (value6) value6.textContent = diferencial.toFixed(2) + ' mBar';
}

// =============================================
//  DADOS
// =============================================
function simularDados() {
    if (!processoEmAndamento) return;

    const pressaoCamara = 100 + Math.random() * 600;
    const tempOleo = 50 + Math.random() * 40;

    const pressaoM1 = pressaoCamara * 0.6;
    const pressaoM2 = (pressaoCamara * 0.5) - 0.4;
    const pressaoM3 = (pressaoCamara * 0.55) + 0.4;

    const fluxoM1 = (pressaoM1 / 1000) * 5;
    const fluxoM2 = (pressaoM2 / 1000) * 4.5;
    const fluxoM3 = (pressaoM3 / 1000) * 4.8;

    const maiorPressao = Math.max(pressaoM1, pressaoM2, pressaoM3);
    const menorPressao = Math.min(pressaoM1, pressaoM2, pressaoM3);
    const diferencialPressao = maiorPressao - menorPressao;

    dadosAtual = {
        cicloId: cicloAtualId,
        estadoMaquina: "Ligado",
        pressaoCamaraMbar: pressaoCamara,
        pressaoTubo1Mbar: pressaoM1,
        fluxoTubo1LPM: fluxoM1,
        pressaoTubo2Mbar: pressaoM2,
        fluxoTubo2LPM: fluxoM2,
        pressaoTubo3Mbar: pressaoM3,
        fluxoTubo3LPM: fluxoM3,
        temperaturaOleo: tempOleo,
        bombaLigada: true,
        valvulaAberta: true,
        servoAngulo: servos[1] || 0
    };

    atualizarDados(dadosAtual);
}

function atualizarDados(dados) {
    const infoPressaoEl = document.getElementById('infoPressao');
    if (infoPressaoEl) infoPressaoEl.textContent = dados.pressaoCamaraMbar.toFixed(2);

    const pressaoValueEl = document.getElementById('pressaoValue');
    if (pressaoValueEl) pressaoValueEl.textContent = dados.pressaoCamaraMbar.toFixed(2) + ' MBarr';

    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = dados.temperaturaOleo.toFixed(1);

    const infoPressaoM1 = document.getElementById('infoPressaoM1');
    if (infoPressaoM1) infoPressaoM1.textContent = dados.pressaoTubo1Mbar.toFixed(2);

    const infoPressaoM2 = document.getElementById('infoPressaoM2');
    if (infoPressaoM2) infoPressaoM2.textContent = dados.pressaoTubo2Mbar.toFixed(2);

    const infoPressaoM3 = document.getElementById('infoPressaoM3');
    if (infoPressaoM3) infoPressaoM3.textContent = dados.pressaoTubo3Mbar.toFixed(2);

    const fase = dados.pressaoCamaraMbar < 200 ? 'SUCCAO' :
        dados.pressaoCamaraMbar <= 500 ? 'ESTAVEL' : 'PRESSAO ALTA';
    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = fase;

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

    const maiorPressao = Math.max(dados.pressaoTubo1Mbar, dados.pressaoTubo2Mbar, dados.pressaoTubo3Mbar);
    const menorPressao = Math.min(dados.pressaoTubo1Mbar, dados.pressaoTubo2Mbar, dados.pressaoTubo3Mbar);
    const diferencial = maiorPressao - menorPressao;

    atualizarGauges(
        dados.temperaturaOleo,
        dados.fluxoTubo1LPM,
        dados.fluxoTubo2LPM,
        dados.fluxoTubo3LPM,
        diferencial
    );

    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`valvePressure${n}`);
        const f = document.getElementById(`valveFlow${n}`);
        const pressaoKey = `pressaoTubo${n}Mbar`;
        const fluxoKey = `fluxoTubo${n}LPM`;
        if (p && dados[pressaoKey]) p.textContent = dados[pressaoKey].toFixed(1) + ' mBar';
        if (f && dados[fluxoKey]) f.textContent = dados[fluxoKey].toFixed(1) + ' LPM';
    });
}

// =============================================
//  HISTORICO DE CICLOS (localStorage)
// =============================================
function salvarCicloNoHistorico() {
    const agora = new Date();
    const chave = `ciclos_vacuo_${agora.getFullYear()}_${String(agora.getMonth() + 1).padStart(2, '0')}`;

    let ciclos = [];
    try { ciclos = JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { }

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
        servo: dadosAtual ? dadosAtual.servoAngulo + 'graus' : '--',
    });

    localStorage.setItem(chave, JSON.stringify(ciclos));
    cicloAtualId++;
    console.log('Ciclo salvo. Total no mes:', ciclos.length);
}

// =============================================
//  RELATORIO PDF — CICLO UNICO (automatico ao fim)
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

    let yPos = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('DADOS DO CICLO', 20, yPos); yPos += 10;
    doc.setFontSize(10);

    const lh = Math.floor(tempoLimite / 3600).toString().padStart(2, '0');
    const lm = Math.floor((tempoLimite % 3600) / 60).toString().padStart(2, '0');
    const ls = (tempoLimite % 60).toString().padStart(2, '0');

    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, yPos); yPos += 8;
    doc.text(`Ciclo ID: ${cicloAtualId}`, 20, yPos); yPos += 8;
    doc.text(`Operador: ${usuarioAtual || 'Nao identificado'}`, 20, yPos); yPos += 8;
    doc.text(`Tempo de Operacao: ${lh}:${lm}:${ls}`, 20, yPos); yPos += 8;

    const statusEl = document.getElementById('status-estado');
    doc.text(`Estado: ${statusEl ? statusEl.textContent : '--'}`, 20, yPos); yPos += 15;

    doc.setFontSize(12);
    doc.text('PRESSOES E FLUXOS', 20, yPos); yPos += 10;
    doc.setFontSize(10);

    if (dadosAtual) {
        doc.text(`Camara: ${dadosAtual.pressaoCamaraMbar.toFixed(2)} mBar`, 20, yPos); yPos += 8;
        doc.text(`Tubo 1: ${dadosAtual.pressaoTubo1Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo1LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Tubo 2: ${dadosAtual.pressaoTubo2Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo2LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Tubo 3: ${dadosAtual.pressaoTubo3Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo3LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Temperatura Oleo: ${dadosAtual.temperaturaOleo.toFixed(1)} C`, 20, yPos); yPos += 15;
    } else {
        doc.text('Nenhum dado de processo disponivel.', 20, yPos); yPos += 15;
    }

    doc.setFontSize(12);
    doc.text('STATUS DOS COMPONENTES', 20, yPos); yPos += 10;
    doc.setFontSize(10);

    doc.text(`Bomba: ${dadosAtual ? (dadosAtual.bombaLigada ? 'LIGADA' : 'DESLIGADA') : '--'}`, 20, yPos); yPos += 8;
    doc.text(`Servo: ${dadosAtual ? dadosAtual.servoAngulo + 'graus' : '--'}`, 20, yPos); yPos += 8;
    doc.text(`Tubo 1: ${mangueiras[1] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, yPos); yPos += 8;
    doc.text(`Tubo 2: ${mangueiras[2] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, yPos); yPos += 8;
    doc.text(`Tubo 3: ${mangueiras[3] ? 'CONECTADO' : 'DESCONECTADO'}`, 20, yPos);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text('Relatorio gerado automaticamente - TSEA Energy', 105, 280, { align: 'center' });

    const filename = `ciclo_${cicloAtualId}_${usuarioAtual || 'anonimo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    console.log('PDF ciclo gerado:', filename);
}

// =============================================
//  RELATORIO MENSAL (botao manual)
// =============================================
async function gerarRelatorioMensal() {
    const { jsPDF } = window.jspdf;
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    const chave = `ciclos_vacuo_${anoAtual}_${String(mesAtual).padStart(2, '0')}`;

    let ciclos = [];
    try { ciclos = JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { }

    const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = meses[mesAtual - 1];

    const doc = new jsPDF();

    // Cabecalho
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(232, 232, 232);
    doc.setFontSize(18);
    doc.text('RELATORIO MENSAL - SISTEMA DE VACUO', 105, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(170, 170, 170);
    doc.text('TSEA Energy', 105, 23, { align: 'center' });
    doc.text(`${nomeMes} / ${anoAtual}   —   Gerado em: ${agora.toLocaleString('pt-BR')}`, 105, 31, { align: 'center' });
    doc.text(`Operador solicitante: ${usuarioAtual || 'Nao identificado'}`, 105, 38, { align: 'center' });

    let yPos = 55;

    if (ciclos.length === 0) {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.text(`Nenhum ciclo registrado em ${nomeMes} de ${anoAtual}.`, 20, yPos);
    } else {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.text(`Total de ciclos em ${nomeMes}: ${ciclos.length}`, 20, yPos); yPos += 14;

        ciclos.forEach((c, i) => {
            // Nova pagina se necessario
            if (yPos > 255) {
                doc.addPage();
                yPos = 20;
            }

            // Separador do ciclo
            doc.setFillColor(235, 235, 235);
            doc.rect(15, yPos - 4, 180, 7, 'F');
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`CICLO #${c.id}   —   ${c.dataHora}   —   Operador: ${c.operador}`, 18, yPos + 1);
            doc.setFont(undefined, 'normal');
            yPos += 11;

            doc.setTextColor(60, 60, 60);
            doc.setFontSize(9);
            doc.text(`Duracao: ${c.tempoOperacao}`, 20, yPos); yPos += 6;
            doc.text(`Pressao Camara: ${c.pressaoCamara} mBar   |   Temperatura: ${c.temperatura} C`, 20, yPos); yPos += 6;
            doc.text(`Tubo 1: ${c.pressaoT1} mBar / ${c.fluxoT1} LPM   |   Tubo 2: ${c.pressaoT2} mBar / ${c.fluxoT2} LPM   |   Tubo 3: ${c.pressaoT3} mBar / ${c.fluxoT3} LPM`, 20, yPos); yPos += 6;
            doc.text(`Conexoes: T1 ${c.tubo1}  |  T2 ${c.tubo2}  |  T3 ${c.tubo3}   |   Servo: ${c.servo}`, 20, yPos); yPos += 12;
        });
    }

    // Rodape
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(8);
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.text(`TSEA Energy  —  Relatorio Mensal ${nomeMes}/${anoAtual}  —  Pagina ${p} de ${totalPages}`, 105, 290, { align: 'center' });
    }

    const filename = `relatorio_mensal_${anoAtual}_${String(mesAtual).padStart(2, '0')}_${usuarioAtual || 'anonimo'}.pdf`;
    doc.save(filename);
    console.log('Relatorio mensal gerado:', filename, '| Ciclos:', ciclos.length);
}

// =============================================
//  RELOGIO
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
    if (relogio) {
        relogio.textContent = `TSEA Energy  |  ${dia}/${mes}/${ano}  ${hora}:${min}:${seg}`;
    }
}