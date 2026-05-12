// =============================================
//  SCRIPT - Sistema de Vácuo
//  VERSÃO FINAL - SEM REGULADORES E COM GAUGES
// =============================================

const API_URL = "http://localhost:5000/api";
let usuarioAtual = null;
let timerInterval = null;
let tempoDecorrido = 0;
let processoEmAndamento = false;
let dashboardCarregado = false;

const mangueiras = { 1: true, 2: true, 3: true };
const servos = { 1: 155, 2: 155, 3: 155 };  // VÁLVULAS COMEÇAM FECHADAS (155°)
let dadosAtual = null;
let cicloAtualId = 1;

// =============================================
//  INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM carregado');
    verificarSessao();
    configurarEventosLogin();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();
});

// =============================================
//  AUTENTICAÇÃO
// =============================================
function verificarSessao() {
    const idArmazenado = localStorage.getItem('usuarioId');

    if (idArmazenado) {
        usuarioAtual = idArmazenado;
        console.log('✅ Usuário encontrado:', usuarioAtual);
        mostrarDashboard();
    } else {
        console.log('❌ Sem usuário, mostrando modal');
        mostrarModalLogin();
    }
}

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
        mostrarErro('Digite um ID válido!', errorMsg);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/operadores?identificador=${id}`);
        const data = await response.json();

        if (response.ok && data && data.id) {
            usuarioAtual = id;
            localStorage.setItem('usuarioId', id);
            localStorage.setItem('usuarioNome', data.nome);
            localStorage.setItem('usuarioDbId', data.id);
            inputId.value = '';
            mostrarDashboard();
        } else {
            mostrarErro('❌ ID não encontrado!', errorMsg);
            inputId.value = '';
        }
    } catch (error) {
        console.log('⚠️ API offline, validação local');
        if (id === 'OP-001' || id === 'OP-002') {
            usuarioAtual = id;
            localStorage.setItem('usuarioId', id);
            localStorage.setItem('usuarioNome', 'Operador');
            inputId.value = '';
            mostrarDashboard();
        } else {
            mostrarErro('❌ ID não encontrado!', errorMsg);
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
    if (el) el.textContent = `${usuarioAtual}  —  ${nome}`;
}

function mostrarDashboard() {
    ocultarModalLogin();
    atualizarNomeUsuario();

    if (!dashboardCarregado) {
        dashboardCarregado = true;
        console.log('✅ Inicializando dashboard');
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
    mostrarDadosIniciais();
    validarMangueiras();
    atualizarStatusValvulas();
}

function mostrarDadosIniciais() {
    const infoPressaoEl = document.getElementById('infoPressao');
    if (infoPressaoEl) infoPressaoEl.textContent = '-- MBarr';

    const pressaoValueEl = document.getElementById('pressaoValue');
    if (pressaoValueEl) pressaoValueEl.textContent = '--';

    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = '--°C';

    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = 'AGUARDANDO';

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';

    // Inicializar gauges
    atualizarGauges(0, 0, 0, 0, 0);

    // Inicializar pressões das mangueiras
    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`infoPressaoM${n}`);
        if (p) p.textContent = '-- mBar';
    });

    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`valvePressure${n}`);
        const f = document.getElementById(`valveFlow${n}`);
        if (p) p.textContent = '-- mBar';
        if (f) f.textContent = '-- LPM';
    });
}

// =============================================
//  GRÁFICO
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
                label: 'Pressão (mBar)',
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
                btn.textContent = `🔗 Mangueira ${num}`;
            } else {
                btn.classList.remove('conectada');
                btn.textContent = `⚫ Mangueira ${num}`;
            }

            validarMangueiras();
        });
    });
}

function configurarServos() {
    document.querySelectorAll('.servo-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = btn.getAttribute('data-servo');
            // Se está aberta (80°), fecha em 155° — Se está fechada (155°), abre em 80°
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

    if (btnIniciar) btnIniciar.addEventListener('click', iniciarProcesso);
    if (btnEmergencia) btnEmergencia.addEventListener('click', emergencia);
    if (btnRelatorio) btnRelatorio.addEventListener('click', gerarRelatorioPDF);

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
}

// =============================================
//  MODAL DE CONFIRMAÇÃO FECHAR
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
//  MANGUEIRAS
// =============================================
function validarMangueiras() {
    validarBotaoIniciar();
}

// =============================================
//  VÁLVULAS
// =============================================
function atualizarStatusValvulas() {
    // Verificar e atualizar visual das válvulas
    [1, 2, 3].forEach(n => {
        atualizarValvulaVisual(n, servos[n]);
    });
    validarBotaoIniciar();
}

function validarBotaoIniciar() {
    const btnIniciar = document.getElementById('btnIniciar');
    if (!btnIniciar) return;

    const todasConectadas = mangueiras[1] && mangueiras[2] && mangueiras[3];
    const umaAberta = servos[1] === 80 || servos[2] === 80 || servos[3] === 80;  // Apenas UMA precisa estar aberta

    btnIniciar.disabled = !(todasConectadas && umaAberta);
}

function atualizarValvulaVisual(num, angulo) {
    const angleEl = document.getElementById(`valveAngle${num}`);
    const angleTxtEl = document.getElementById(`valveAngleTxt${num}`);
    const indicatorEl = document.getElementById(`valveIndicator${num}`);
    const pressureEl = document.getElementById(`valvePressure${num}`);
    const flowEl = document.getElementById(`valveFlow${num}`);
    const statusEl = document.getElementById(`valveStatus${num}`);

    if (angleEl) angleEl.textContent = angulo + '°';
    if (angleTxtEl) angleTxtEl.textContent = angulo + '°';
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
    if (!mangueiras[1] || !mangueiras[2] || !mangueiras[3]) {
        alert('⚠️ Conecte todas as 3 mangueiras!');
        return;
    }

    // Validar se pelo menos UMA válvula está aberta
    if (servos[1] !== 80 && servos[2] !== 80 && servos[3] !== 80) {
        alert('⚠️ Abra pelo menos 1 válvula para iniciar!');
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

    // Limpar gráfico
    if (window.vacuoChart) {
        window.vacuoChart.data.labels = [];
        window.vacuoChart.data.datasets[0].data = [];
        window.vacuoChart.update();
    }

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        tempoDecorrido++;
        const h = Math.floor(tempoDecorrido / 3600).toString().padStart(2, '0');
        const m = Math.floor((tempoDecorrido % 3600) / 60).toString().padStart(2, '0');
        const s = (tempoDecorrido % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timerDisplay');
        if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
    }, 1000);

    if (window.simInterval) clearInterval(window.simInterval);
    window.simInterval = setInterval(simularDados, 1000);

    console.log('▶️ Processo iniciado');
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

function emergencia() {
    pararProcesso();
    tempoDecorrido = 0;

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';

    const statusEl = document.getElementById('status-estado');
    if (statusEl) {
        statusEl.textContent = 'EMERGÊNCIA';
        statusEl.style.color = '#ff6b6b';
    }

    servos[1] = 155;
    servos[2] = 155;
    servos[3] = 155;
    atualizarValvulaVisual(1, 155);
    atualizarValvulaVisual(2, 155);
    atualizarValvulaVisual(3, 155);

    mostrarDadosIniciais();
    console.log('🚨 EMERGÊNCIA ATIVADA');
}

// =============================================
//  GAUGES (BARRAS VERTICAIS)
// =============================================
function atualizarGauges(temp, fluxo1, fluxo2, fluxo3, diferencial) {
    // Gauge 2: Temperatura (0-100°C)
    const percentTemp = Math.min((temp / 100) * 100, 100);
    const gauge2 = document.getElementById('gaugeBar2');
    if (gauge2) gauge2.style.height = percentTemp + '%';
    const value2 = document.getElementById('gaugeValue2');
    if (value2) value2.textContent = temp.toFixed(1) + ' °C';

    // Gauge 3: Fluxo M1 (0-20 LPM)
    const percentFluxo1 = Math.min((fluxo1 / 20) * 100, 100);
    const gauge3 = document.getElementById('gaugeBar3');
    if (gauge3) gauge3.style.height = percentFluxo1 + '%';
    const value3 = document.getElementById('gaugeValue3');
    if (value3) value3.textContent = fluxo1.toFixed(1) + ' LPM';

    // Gauge 4: Fluxo M2 (0-20 LPM)
    const percentFluxo2 = Math.min((fluxo2 / 20) * 100, 100);
    const gauge4 = document.getElementById('gaugeBar4');
    if (gauge4) gauge4.style.height = percentFluxo2 + '%';
    const value4 = document.getElementById('gaugeValue4');
    if (value4) value4.textContent = fluxo2.toFixed(1) + ' LPM';

    // Gauge 5: Fluxo M3 (0-20 LPM)
    const percentFluxo3 = Math.min((fluxo3 / 20) * 100, 100);
    const gauge5 = document.getElementById('gaugeBar5');
    if (gauge5) gauge5.style.height = percentFluxo3 + '%';
    const value5 = document.getElementById('gaugeValue5');
    if (value5) value5.textContent = fluxo3.toFixed(1) + ' LPM';

    // Gauge 6: Pressão Diferencial (0-5 mBar)
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

    // DIFERENÇA DE 0.4 mBar ENTRE MANGUEIRAS
    const pressaoM1 = pressaoCamara * 0.6;
    const pressaoM2 = (pressaoCamara * 0.5) - 0.4;  // 0.4 mBar menor que M1
    const pressaoM3 = (pressaoCamara * 0.55) + 0.4;  // 0.4 mBar maior que M1

    const fluxoM1 = (pressaoM1 / 1000) * 5;
    const fluxoM2 = (pressaoM2 / 1000) * 4.5;
    const fluxoM3 = (pressaoM3 / 1000) * 4.8;

    // Diferencial: maior pressão - menor pressão
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

    const fase = dados.pressaoCamaraMbar < 200 ? 'SUCÇÃO' :
        dados.pressaoCamaraMbar <= 500 ? 'ESTÁVEL' : 'PRESSÃO ALTA';
    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = fase;

    // Atualizar gráfico de pressão
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

    // Calcular diferencial
    const maiorPressao = Math.max(dados.pressaoTubo1Mbar, dados.pressaoTubo2Mbar, dados.pressaoTubo3Mbar);
    const menorPressao = Math.min(dados.pressaoTubo1Mbar, dados.pressaoTubo2Mbar, dados.pressaoTubo3Mbar);
    const diferencial = maiorPressao - menorPressao;

    // Atualizar gauges com TODOS os 5 parâmetros
    atualizarGauges(
        dados.temperaturaOleo,
        dados.fluxoTubo1LPM,
        dados.fluxoTubo2LPM,
        dados.fluxoTubo3LPM,
        diferencial
    );

    // Atualizar valores das válvulas
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
//  RELATÓRIO PDF
// =============================================
async function gerarRelatorioPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(232, 232, 232);
    doc.setFontSize(20);
    doc.text('RELATÓRIO — SISTEMA DE VÁCUO', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);
    doc.text('TSEA Energy', 105, 25, { align: 'center' });
    doc.text(`Operador: ${usuarioAtual || 'Não identificado'}`, 105, 31, { align: 'center' });

    let yPos = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('DADOS DO CICLO', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, yPos); yPos += 8;
    doc.text(`Ciclo ID: ${cicloAtualId}`, 20, yPos); yPos += 8;
    doc.text(`Operador: ${usuarioAtual || 'Não identificado'}`, 20, yPos); yPos += 8;

    const timerEl = document.getElementById('timerDisplay');
    doc.text(`Tempo de Operação: ${timerEl ? timerEl.textContent : '00:00:00'}`, 20, yPos); yPos += 8;

    const statusEl = document.getElementById('status-estado');
    doc.text(`Estado: ${statusEl ? statusEl.textContent : '--'}`, 20, yPos);

    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('PRESSÕES E FLUXOS', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    if (dadosAtual) {
        doc.text(`Câmara: ${dadosAtual.pressaoCamaraMbar.toFixed(2)} mBar`, 20, yPos); yPos += 8;
        doc.text(`Tubo 1: ${dadosAtual.pressaoTubo1Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo1LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Tubo 2: ${dadosAtual.pressaoTubo2Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo2LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Tubo 3: ${dadosAtual.pressaoTubo3Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo3LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Temperatura Óleo: ${dadosAtual.temperaturaOleo.toFixed(1)} °C`, 20, yPos);
    } else {
        doc.text('Câmara: --  (processo não iniciado)', 20, yPos); yPos += 8;
        doc.text('Tubo 1: --  |  Fluxo: --', 20, yPos); yPos += 8;
        doc.text('Tubo 2: --  |  Fluxo: --', 20, yPos); yPos += 8;
        doc.text('Tubo 3: --  |  Fluxo: --', 20, yPos); yPos += 8;
        doc.text('Temperatura Óleo: -- °C', 20, yPos);
    }

    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('STATUS DOS COMPONENTES', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.text(`Bomba: ${dadosAtual ? (dadosAtual.bombaLigada ? 'LIGADA' : 'DESLIGADA') : '--'}`, 20, yPos); yPos += 8;
    doc.text(`Válvula: ${dadosAtual ? (dadosAtual.valvulaAberta ? 'ABERTA' : 'FECHADA') : '--'}`, 20, yPos); yPos += 8;
    doc.text(`Servo: ${dadosAtual ? dadosAtual.servoAngulo + '°' : '--'}`, 20, yPos); yPos += 8;
    doc.text(`Mangueira 1: ${mangueiras[1] ? 'CONECTADA' : 'DESCONECTADA'}`, 20, yPos); yPos += 8;
    doc.text(`Mangueira 2: ${mangueiras[2] ? 'CONECTADA' : 'DESCONECTADA'}`, 20, yPos); yPos += 8;
    doc.text(`Mangueira 3: ${mangueiras[3] ? 'CONECTADA' : 'DESCONECTADA'}`, 20, yPos);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text('Relatório gerado automaticamente — TSEA Energy', 105, 280, { align: 'center' });

    const filename = `relatorio_vacuo_${usuarioAtual || 'anonimo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);

    console.log('📄 PDF gerado:', filename);
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
    if (relogio) {
        relogio.textContent = `TSEA Energy  |  ${dia}/${mes}/${ano}  ${hora}:${min}:${seg}`;
    }
}