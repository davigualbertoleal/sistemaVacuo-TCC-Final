// =============================================
//  SCRIPT - Sistema de Vácuo
//  VERSÃO CORRIGIDA v2
// =============================================

const API_URL = "http://localhost:5000/api";
let usuarioAtual = null;
let timerInterval = null;
let tempoDecorrido = 0;
let processoEmAndamento = false;
let dashboardCarregado = false;

const mangueiras = { 1: true, 2: true, 3: true };
const servos = { 1: 0, 2: 0, 3: 0 };
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

    // Sem botão Sair — sessão dura até o app fechar/reiniciar
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
}

function mostrarDadosIniciais() {
    const pressaoEl = document.getElementById('pressaoValue');
    if (pressaoEl) pressaoEl.textContent = '-- MBarr';

    const infoPressaoEl = document.getElementById('infoPressao');
    if (infoPressaoEl) infoPressaoEl.textContent = '-- MBarr';

    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = '--°C';

    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = 'AGUARDANDO';

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = '00:00:00';

    [1, 2, 3].forEach(n => {
        const p = document.getElementById(`valvePressure${n}`);
        const f = document.getElementById(`valveFlow${n}`);
        if (p) p.textContent = '-- mBar';
        if (f) f.textContent = '-- LPM';
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
            servos[num] = servos[num] === 0 ? 90 : 0;
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

    // X vermelho → modal bonito de confirmação
    if (btnFechar) {
        btnFechar.addEventListener('click', () => {
            abrirModalFechar();
        });
    }

    // Botões do modal de confirmação
    const btnCancelar = document.getElementById('btnCancelarFechar');
    const btnConfirmar = document.getElementById('btnConfirmarFechar');

    if (btnCancelar) btnCancelar.addEventListener('click', fecharModalFechar);
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', () => {
            // Envia mensagem pro C# fechar o app
            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage('fechar_app');
            } else {
                // Fallback no navegador
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
    const btnIniciar = document.getElementById('btnIniciar');
    if (!btnIniciar) return;

    const todasConectadas = mangueiras[1] && mangueiras[2] && mangueiras[3];
    btnIniciar.disabled = !todasConectadas;
}

// =============================================
//  VÁLVULAS
// =============================================
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

    const status = angulo < 90 ? 'FECHADA' : 'ABERTA';
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = 'valve-status ' + (status === 'ABERTA' ? 'on' : 'off');
    }
}

// =============================================
//  PROCESSO E TIMER
// =============================================
function iniciarProcesso() {
    if (!mangueiras[1] || !mangueiras[2] || !mangueiras[3]) {
        alert('⚠️ Conecte todas as 3 mangueiras!');
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

    // Limpa o gráfico ao iniciar
    if (window.vacuoChart) {
        window.vacuoChart.data.labels = [];
        window.vacuoChart.data.datasets[0].data = [];
        window.vacuoChart.update();
    }

    // Timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        tempoDecorrido++;
        const h = Math.floor(tempoDecorrido / 3600).toString().padStart(2, '0');
        const m = Math.floor((tempoDecorrido % 3600) / 60).toString().padStart(2, '0');
        const s = (tempoDecorrido % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timerDisplay');
        if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
    }, 1000);

    // Simulação só começa aqui
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

    servos[1] = 0;
    servos[2] = 0;
    servos[3] = 0;
    atualizarValvulaVisual(1, 0);
    atualizarValvulaVisual(2, 0);
    atualizarValvulaVisual(3, 0);

    mostrarDadosIniciais();
    console.log('🚨 EMERGÊNCIA ATIVADA');
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
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: {
                    target: 'origin',
                    above: 'rgba(232, 232, 232, 0.04)'
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
                    grid: { color: '#1e1e1e' },
                    ticks: { color: '#444', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#444', font: { size: 9 }, maxTicksLimit: 8 }
                }
            }
        }
    });
}

// =============================================
//  DADOS
// =============================================
function simularDados() {
    if (!processoEmAndamento) return;

    const pressao = 100 + Math.random() * 600;
    dadosAtual = {
        cicloId: cicloAtualId,
        estadoMaquina: "Ligado",
        pressaoCamaraMbar: pressao,
        pressaoTubo1Mbar: pressao * 0.6,
        fluxoTubo1LPM: (pressao / 1000) * 5,
        pressaoTubo2Mbar: pressao * 0.5,
        fluxoTubo2LPM: (pressao / 1000) * 4.5,
        pressaoTubo3Mbar: pressao * 0.55,
        fluxoTubo3LPM: (pressao / 1000) * 4.8,
        bombaLigada: true,
        valvulaAberta: true,
        servoAngulo: servos[1] || 0
    };

    atualizarDados(dadosAtual);
}

function atualizarDados(dados) {
    const pressaoEl = document.getElementById('pressaoValue');
    if (pressaoEl) pressaoEl.textContent = dados.pressaoCamaraMbar.toFixed(2) + ' MBarr';

    const infoPressaoEl = document.getElementById('infoPressao');
    if (infoPressaoEl) infoPressaoEl.textContent = dados.pressaoCamaraMbar.toFixed(1) + ' MBarr';

    const infoTempEl = document.getElementById('infoTemp');
    if (infoTempEl) infoTempEl.textContent = '65.0°C';

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

    const fase = dados.pressaoCamaraMbar < 200 ? 'SUCÇÃO' :
        dados.pressaoCamaraMbar <= 500 ? 'ESTÁVEL' : 'PRESSÃO ALTA';
    const infoFaseEl = document.getElementById('infoFase');
    if (infoFaseEl) infoFaseEl.textContent = fase;
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
    doc.setTextColor(232, 232, 232);
    doc.setFontSize(12);
    doc.text('DADOS DO CICLO', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);

    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, yPos); yPos += 8;
    doc.text(`Ciclo ID: ${cicloAtualId}`, 20, yPos); yPos += 8;
    doc.text(`Operador: ${usuarioAtual || 'Não identificado'}`, 20, yPos); yPos += 8;

    const timerEl = document.getElementById('timerDisplay');
    doc.text(`Tempo de Operação: ${timerEl ? timerEl.textContent : '00:00:00'}`, 20, yPos); yPos += 8;

    const statusEl = document.getElementById('status-estado');
    doc.text(`Estado: ${statusEl ? statusEl.textContent : '--'}`, 20, yPos);

    yPos += 15;
    doc.setTextColor(232, 232, 232);
    doc.setFontSize(12);
    doc.text('PRESSÕES E FLUXOS', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);

    if (dadosAtual) {
        doc.text(`Câmara: ${dadosAtual.pressaoCamaraMbar.toFixed(2)} mBar`, 20, yPos); yPos += 8;
        doc.text(`Tubo 1: ${dadosAtual.pressaoTubo1Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo1LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Tubo 2: ${dadosAtual.pressaoTubo2Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo2LPM.toFixed(1)} LPM`, 20, yPos); yPos += 8;
        doc.text(`Tubo 3: ${dadosAtual.pressaoTubo3Mbar.toFixed(2)} mBar  |  Fluxo: ${dadosAtual.fluxoTubo3LPM.toFixed(1)} LPM`, 20, yPos);
    } else {
        doc.text('Câmara: --  (processo não iniciado)', 20, yPos); yPos += 8;
        doc.text('Tubo 1: --  |  Fluxo: --', 20, yPos); yPos += 8;
        doc.text('Tubo 2: --  |  Fluxo: --', 20, yPos); yPos += 8;
        doc.text('Tubo 3: --  |  Fluxo: --', 20, yPos);
    }

    yPos += 15;
    doc.setTextColor(232, 232, 232);
    doc.setFontSize(12);
    doc.text('STATUS DOS COMPONENTES', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);

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