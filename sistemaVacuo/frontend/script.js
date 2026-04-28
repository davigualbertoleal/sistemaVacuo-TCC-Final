const MAX_PONTOS_GRAFICO = 30;

// --- GRÁFICO DE PRESSÃO ---
const ctx = document.getElementById('vacuoChart').getContext('2d');
const vacuoChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Câmara (mBar)',
                data: [],
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true
            },
            {
                label: 'Tubo 1 (mBar)',
                data: [],
                borderColor: '#4ecdc4',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true
            },
            {
                label: 'Tubo 2 (mBar)',
                data: [],
                borderColor: '#ffe66d',
                backgroundColor: 'rgba(255, 230, 109, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true
            },
            {
                label: 'Tubo 3 (mBar)',
                data: [],
                borderColor: '#95e1d3',
                backgroundColor: 'rgba(149, 225, 211, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
            legend: {
                display: true,
                labels: { color: '#999', font: { size: 11 } }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#666', font: { size: 10 } }
            },
            y: {
                min: 0,
                max: 1000,
                grid: { color: '#333' },
                ticks: { color: '#666', font: { size: 10 } }
            }
        }
    }
});

// =============================================
//  FUNÇÃO PRINCIPAL
//  Chamada pelo C# com dados do ESP32
// =============================================
function atualizarDados(dados) {
    console.log("Atualizando com:", dados);

    // --- VALOR PRINCIPAL DA CÂMARA (MBarr) ---
    const pressaoFormatada = dados.pressaoCamaraMbar.toFixed(2);
    document.querySelector('.chart-main-value').textContent = pressaoFormatada + ' MBarr';

    // --- VALOR NO PAINEL DIREITO ---
    const infoValues = document.querySelectorAll('.info-value');
    if (infoValues.length > 0) {
        infoValues[0].textContent = pressaoFormatada + ' MBarr';
    }

    // --- ATUALIZA O GRÁFICO ---
    const agora = horaAtual();
    vacuoChart.data.labels.push(agora);
    vacuoChart.data.datasets[0].data.push(dados.pressaoCamaraMbar);
    vacuoChart.data.datasets[1].data.push(dados.pressaoTubo1Mbar);
    vacuoChart.data.datasets[2].data.push(dados.pressaoTubo2Mbar);
    vacuoChart.data.datasets[3].data.push(dados.pressaoTubo3Mbar);

    // Remove pontos antigos
    if (vacuoChart.data.labels.length > MAX_PONTOS_GRAFICO) {
        vacuoChart.data.labels.shift();
        vacuoChart.data.datasets.forEach(ds => ds.data.shift());
    }
    vacuoChart.update();

    // --- ATUALIZA STATUS NO PAINEL ESQUERDO ---
    // Bomba
    atualizarStatusItem(0, dados.bombaLigada ? 'LIGADO' : 'DESLIGADO');

    // Tubos: mostra "INSERIDO" se tiver pressão, senão "VAZIO"
    atualizarStatusItem(1, dados.pressaoTubo1Mbar > 50 ? 'INSERIDO' : 'VAZIO');
    atualizarStatusItem(2, dados.pressaoTubo2Mbar > 50 ? 'INSERIDO' : 'VAZIO');
    atualizarStatusItem(3, dados.pressaoTubo3Mbar > 50 ? 'INSERIDO' : 'VAZIO');

    // --- VÁLVULAS ---
    atualizarValvulas(dados.valvulaAberta);

    // --- ALERTA VISUAL SE PRESSÃO ANORMAL ---
    const header = document.querySelector('.header-panel');
    if (dados.pressaoCamaraMbar < 20) {
        header.style.background = 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)';
        header.querySelector('.header-title').textContent = '⚠️ PRESSÃO CRÍTICA';
    } else if (dados.pressaoCamaraMbar > 950) {
        header.style.background = 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)';
        header.querySelector('.header-title').textContent = '⚠️ PRESSÃO ALTA';
    } else {
        header.style.background = '';
        header.querySelector('.header-title').textContent = 'Controle de Vácuo';
    }
}

// =============================================
//  ATUALIZA UM STATUS NO PAINEL ESQUERDO
//  índice 0 = Bomba, 1-3 = Tubos, 4-6 = Reguladores
// =============================================
function atualizarStatusItem(indice, novo_valor) {
    const statusItems = document.querySelectorAll('.status-item');
    if (statusItems[indice]) {
        const statusValue = statusItems[indice].querySelector('.status-value');
        statusValue.textContent = novo_valor;

        // Muda cor: LIGADO/INSERIDO = verde (on), DESLIGADO/VAZIO = vermelho (off)
        if (novo_valor === 'LIGADO' || novo_valor === 'INSERIDO') {
            statusValue.className = 'status-value on';
        } else {
            statusValue.className = 'status-value off';
        }
    }
}

// =============================================
//  ATUALIZA AS VÁLVULAS (ABERTA/FECHADA)
// =============================================
function atualizarValvulas(valvulaAberta) {
    const valveItems = document.querySelectorAll('.valve-item');
    const estado = valvulaAberta ? 'ABERTA' : 'FECHADA';

    valveItems.forEach((valve, index) => {
        valve.textContent = `Válvula ${index + 1}: ${estado}`;
        valve.style.color = valvulaAberta ? '#4ecdc4' : '#ff6b6b';
    });
}

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

    const relogioEl = document.getElementById('relogio');
    if (relogioEl) {
        relogioEl.textContent = `TSEA Energy | ${dia}/${mes}/${ano} | ${hora}`;
    }
}

// =============================================
//  BOTÃO FECHAR
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const btnFechar = document.getElementById('btnFechar');
    if (btnFechar) {
        btnFechar.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja encerrar o sistema de vácuo?')) {
                window.chrome.webview.postMessage('fechar_app');
            }
        });
    }
});

// Atualiza relógio a cada segundo
atualizarRelogio();
setInterval(atualizarRelogio, 1000);