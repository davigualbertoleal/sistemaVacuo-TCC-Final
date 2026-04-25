// =============================================
//  SISTEMA DE VÁCUO - script.js
//  Recebe dados do ESP32 via C# e atualiza
//  o dashboard em tempo real.
// =============================================

// --- GRÁFICO DE PRESSÃO ---
const MAX_PONTOS_GRAFICO = 20; // Quantos pontos o gráfico exibe ao mesmo tempo

const ctx = document.getElementById('vacuoChart').getContext('2d');
const vacuoChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Pressão (kPa)',
            data: [],
            borderColor: '#ffffff',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 }, // Animação suave a cada atualização
        plugins: { legend: { display: false } },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'darkgray' }
            },
            y: {
                min: 0,
                max: 200, // Ajuste conforme a faixa esperada do seu sistema
                grid: { color: '#282828' },
                ticks: { color: 'darkgray' }
            }
        }
    }
});

// =============================================
//  FUNÇÃO PRINCIPAL - Chamada pelo C# com os
//  dados do ESP32 a cada 500ms
//  Exemplo de chamada: atualizarDados({pressao:65.2, bomba:true, valvula:false, servo:90})
// =============================================
function atualizarDados(dados) {
    // --- Atualiza o valor principal de pressão ---
    const pressaoFormatada = dados.pressao.toFixed(1);
    document.querySelector('.chart-main-value').textContent = pressaoFormatada + ' kPa';
    document.querySelector('.info-value').textContent = pressaoFormatada + ' kPa';

    // --- Atualiza o gráfico ---
    const agora = horaAtual();
    vacuoChart.data.labels.push(agora);
    vacuoChart.data.datasets[0].data.push(dados.pressao);

    // Remove pontos antigos para o gráfico não ficar infinito
    if (vacuoChart.data.labels.length > MAX_PONTOS_GRAFICO) {
        vacuoChart.data.labels.shift();
        vacuoChart.data.datasets[0].data.shift();
    }
    vacuoChart.update();

    // --- Atualiza status da Bomba ---
    atualizarStatus('status-bomba', dados.bomba ? 'LIGADO' : 'DESLIGADO', dados.bomba);

    // --- Atualiza status da Válvula ---
    atualizarStatus('status-valvula', dados.valvula ? 'ABERTA' : 'FECHADA', dados.valvula);

    // --- Atualiza ângulo do servo ---
    if (document.getElementById('info-servo')) {
        document.getElementById('info-servo').textContent = dados.servo + '°';
    }

    // --- Alerta visual se pressão cair muito (segurança) ---
    const header = document.querySelector('.header-panel');
    if (dados.pressao < 20) {
        header.style.background = '#c0392b'; // Vermelho de alerta
        header.querySelector('.header-title').textContent = '⚠️ PRESSÃO CRÍTICA';
    } else {
        header.style.background = '';
        header.querySelector('.header-title').textContent = 'Controle de Vácuo';
    }
}

// Atualiza um elemento de status (LIGADO/DESLIGADO) por ID
function atualizarStatus(id, texto, ativo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = texto;
    el.className = 'status-value ' + (ativo ? 'on' : 'off');
}

// =============================================
//  CONTROLES DO DASHBOARD → manda comandos
//  de volta pro ESP32 via C#
// =============================================

// Ligue os botões do HTML com IDs "btnBomba" e "btnValvula"
// O C# intercepta essas mensagens e envia pro ESP32 via Serial
document.addEventListener('DOMContentLoaded', () => {
    const btnBomba = document.getElementById('btnBomba');
    if (btnBomba) {
        btnBomba.addEventListener('click', () => {
            const ligada = btnBomba.dataset.estado === 'on';
            const novoComando = ligada ? 'bomba:off' : 'bomba:on';
            btnBomba.dataset.estado = ligada ? 'off' : 'on';
            // Envia mensagem pro C# no formato "cmd:bomba:on"
            window.chrome.webview.postMessage('cmd:' + novoComando);
        });
    }

    const btnValvula = document.getElementById('btnValvula');
    if (btnValvula) {
        btnValvula.addEventListener('click', () => {
            const aberta = btnValvula.dataset.estado === 'on';
            const novoComando = aberta ? 'valvula:off' : 'valvula:on';
            btnValvula.dataset.estado = aberta ? 'off' : 'on';
            window.chrome.webview.postMessage('cmd:' + novoComando);
        });
    }
});

// =============================================
//  BOTÃO FECHAR
// =============================================
document.getElementById('btnFechar').addEventListener('click', function () {
    const usuarioQuerSair = confirm("⚠️ ATENÇÃO: Tem certeza que deseja encerrar o Controle de Vácuo?");
    if (usuarioQuerSair) {
        window.chrome.webview.postMessage('fechar_app');
    }
});

// =============================================
//  RELÓGIO
// =============================================
function horaAtual() {
    const agora = new Date();
    return String(agora.getHours()).padStart(2, '0') + ':' +
        String(agora.getMinutes()).padStart(2, '0') + ':' +
        String(agora.getSeconds()).padStart(2, '0');
}

function atualizarRelogio() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = String(agora.getFullYear()).slice(-2);
    const hora = horaAtual();
    document.getElementById('relogio').innerText =
        `TSEA Energy | ${dia}/${mes}/${ano} | ${hora}`;
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);