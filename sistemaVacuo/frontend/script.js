// =============================================
//  VARIÁVEIS GERAIS E ESTADO
// =============================================
let processoEmAndamento = false;
let tempoSegundos = 0;
let timerInterval = null;
let apiInterval = null;
let chartVacuo = null;

// =============================================
//  INICIALIZAÇÃO QUANDO A PÁGINA CARREGA
// =============================================
document.addEventListener("DOMContentLoaded", () => {
    iniciarRelogio();
    configurarAbas();
    configurarBotoes();
    configurarModalFechar();
    inicializarGrafico();
});

// =============================================
//  RELÓGIO DO TOPO
// =============================================
function iniciarRelogio() {
    const relogioEl = document.getElementById("relogio");
    setInterval(() => {
        const agora = new Date();
        const dataStr = agora.toLocaleDateString("pt-BR");
        const horaStr = agora.toLocaleTimeString("pt-BR");
        relogioEl.textContent = `TSEA Energy | ${dataStr} - ${horaStr}`;
    }, 1000);
}

// =============================================
//  SISTEMA DE ABAS (TABS)
// =============================================
function configurarAbas() {
    const botoesAba = document.querySelectorAll(".tab-button");
    const conteudosAba = document.querySelectorAll(".tab-content");

    botoesAba.forEach(botao => {
        botao.addEventListener("click", () => {
            // Remove a classe active de todos
            botoesAba.forEach(b => b.classList.remove("active"));
            conteudosAba.forEach(c => c.classList.remove("active"));

            // Ativa o botão clicado e seu conteúdo
            botao.classList.add("active");
            const alvo = botao.getAttribute("data-tab");
            document.getElementById(alvo).classList.add("active");
        });
    });
}

// =============================================
//  BOTÕES PRINCIPAIS (INICIAR / EMERGÊNCIA)
// =============================================
function configurarBotoes() {
    const btnIniciar = document.getElementById("btnIniciar");
    const btnEmergencia = document.getElementById("btnEmergencia");
    const statusEstado = document.getElementById("status-estado");

    btnIniciar.addEventListener("click", () => {
        if (!processoEmAndamento) {
            processoEmAndamento = true;
            btnIniciar.disabled = true;
            statusEstado.textContent = "EM PROCESSO";
            statusEstado.className = "status-value on";

            // Inicia o timer e a busca na API
            iniciarTimer();
            // Busca imediatamente a primeira vez, depois a cada 2 seg
            buscarDadosDaAPI();
            apiInterval = setInterval(buscarDadosDaAPI, 2000);
        }
    });

    btnEmergencia.addEventListener("click", () => {
        processoEmAndamento = false;
        btnIniciar.disabled = false;
        statusEstado.textContent = "PARADA DE EMERGÊNCIA";
        statusEstado.className = "status-value off";

        // Para tudo
        clearInterval(timerInterval);
        clearInterval(apiInterval);

        // Pinta a bomba de vermelho pra avisar que parou
        document.getElementById("status-bomba").textContent = "DESLIGADO";
        document.getElementById("status-bomba").className = "status-value off";
    });
}

// =============================================
//  CRONÔMETRO
// =============================================
function iniciarTimer() {
    const timerDisplay = document.getElementById("timerDisplay");

    timerInterval = setInterval(() => {
        tempoSegundos++;
        const horas = Math.floor(tempoSegundos / 3600).toString().padStart(2, "0");
        const minutos = Math.floor((tempoSegundos % 3600) / 60).toString().padStart(2, "0");
        const segundos = (tempoSegundos % 60).toString().padStart(2, "0");
        timerDisplay.textContent = `${horas}:${minutos}:${segundos}`;
    }, 1000);
}

// =============================================
//  GRÁFICO (CHART.JS)
// =============================================
function inicializarGrafico() {
    const ctx = document.getElementById("vacuoChart").getContext("2d");

    // Gradiente pra ficar bonito
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(232, 232, 232, 0.4)");
    gradient.addColorStop(1, "rgba(232, 232, 232, 0.0)");

    chartVacuo = new Chart(ctx, {
        type: "line",
        data: {
            labels: [], // Tempos
            datasets: [{
                label: "Pressão (mBar)",
                data: [],
                borderColor: "#e8e8e8",
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4, // Curva suave
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Tira a animação chata a cada att
            },
            scales: {
                x: { display: false }, // Oculta a linha do tempo embaixo
                y: {
                    grid: { color: "#333" },
                    ticks: { color: "#888" },
                    min: 0
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// =============================================
//  COMUNICAÇÃO REAL COM A API C#
// =============================================
async function buscarDadosDaAPI() {
    if (!processoEmAndamento) return;

    try {
        // Tenta buscar a leitura mais recente do ciclo 1
        const resposta = await fetch('http://localhost:5000/api/LeiturasSensores/ciclo/1');

        if (resposta.ok) {
            const dados = await resposta.json();
            atualizarInterface(dados);
        } else {
            console.log("Aguardando dados ou erro na API. Status:", resposta.status);
        }
    } catch (erro) {
        console.error("Erro de conexão com a API:", erro);
        // Opcional: Mostrar um alerta na tela se a API cair
    }
}

// =============================================
//  ATUALIZAÇÃO DA TELA COM OS DADOS REAIS
// =============================================
function atualizarInterface(dados) {
    // 1. Atualiza Valores Principais
    document.getElementById("pressaoValue").textContent = `${dados.pressaoCamaraMbar.toFixed(2)} mBar`;
    document.getElementById("infoPressao").textContent = `${dados.pressaoCamaraMbar.toFixed(1)} mBar`;

    // Atualiza Status da Bomba (Boleano da API)
    const statusBomba = document.getElementById("status-bomba");
    if (dados.bombaLigada) {
        statusBomba.textContent = "LIGADO";
        statusBomba.className = "status-value on";
    } else {
        statusBomba.textContent = "DESLIGADO";
        statusBomba.className = "status-value off";
    }

    // 2. Atualiza Gráfico
    const chartData = chartVacuo.data;
    const agora = new Date().toLocaleTimeString();

    chartData.labels.push(agora);
    chartData.datasets[0].data.push(dados.pressaoCamaraMbar);

    // Mantém só os últimos 20 pontos no gráfico pra não travar
    if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
    }
    chartVacuo.update();

    // 3. Atualiza Tubos/Mangueiras (Pressão e Fluxo)
    // Tubo 1
    document.getElementById("valvePressure1").textContent = `${dados.pressaoTubo1Mbar.toFixed(1)} mBar`;
    document.getElementById("valveFlow1").textContent = `${dados.fluxoTubo1LPM.toFixed(1)} LPM`;
    document.getElementById("regPressure1").textContent = `${dados.pressaoTubo1Mbar.toFixed(1)} mBar`;
    document.getElementById("regFlow1").textContent = `${dados.fluxoTubo1LPM.toFixed(1)} LPM`;

    // Tubo 2
    document.getElementById("valvePressure2").textContent = `${dados.pressaoTubo2Mbar.toFixed(1)} mBar`;
    document.getElementById("valveFlow2").textContent = `${dados.fluxoTubo2LPM.toFixed(1)} LPM`;
    document.getElementById("regPressure2").textContent = `${dados.pressaoTubo2Mbar.toFixed(1)} mBar`;
    document.getElementById("regFlow2").textContent = `${dados.fluxoTubo2LPM.toFixed(1)} LPM`;

    // Tubo 3
    document.getElementById("valvePressure3").textContent = `${dados.pressaoTubo3Mbar.toFixed(1)} mBar`;
    document.getElementById("valveFlow3").textContent = `${dados.fluxoTubo3LPM.toFixed(1)} LPM`;
    document.getElementById("regPressure3").textContent = `${dados.pressaoTubo3Mbar.toFixed(1)} mBar`;
    document.getElementById("regFlow3").textContent = `${dados.fluxoTubo3LPM.toFixed(1)} LPM`;

    // 4. Atualiza Visuais das Válvulas e Servo
    // Como a API retorna 1 servo e 1 status de válvula geral, vamos aplicar o movimento
    // na Válvula 1 (você pode replicar pras outras se quiser).

    const angulo = dados.servoAngulo; // Vem da API (0 a 180)

    // Gira o ponteiro do SVG em torno do centro (cx=100, cy=130)
    document.getElementById("valveIndicator1").setAttribute("transform", `rotate(${angulo} 100 130)`);
    document.getElementById("valveAngle1").textContent = `${angulo}°`;
    document.getElementById("valveAngleTxt1").textContent = `${angulo}°`;

    const statusValvula1 = document.getElementById("valveStatus1");
    if (dados.valvulaAberta) {
        statusValvula1.textContent = "ABERTA";
        statusValvula1.className = "valve-status on";
    } else {
        statusValvula1.textContent = "FECHADA";
        statusValvula1.className = "valve-status off";
    }
}

// =============================================
//  MODAL DE SAÍDA E WEBVIEW2
// =============================================
function configurarModalFechar() {
    const btnFechar = document.getElementById("btnFechar");
    const modalSair = document.getElementById("modalSair");
    const btnCancelarSair = document.getElementById("btnCancelarSair");
    const btnConfirmarSair = document.getElementById("btnConfirmarSair");

    btnFechar.addEventListener("click", () => {
        modalSair.style.display = "flex";
    });

    btnCancelarSair.addEventListener("click", () => {
        modalSair.style.display = "none";
    });

    btnConfirmarSair.addEventListener("click", () => {
        // Envia mensagem pro WinForms fechar o formulário em C#
        try {
            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage("FECHAR_APP");
            } else {
                alert("Simulação de fechamento (fora do WinForms).");
                modalSair.style.display = "none";
            }
        } catch (e) {
            console.log(e);
        }
    });
}