// =============================================
//  SISTEMA DE VÁCUO - Form1.cs (C#)
//  Lê Serial do ESP32, salva no MySQL,
//  e atualiza o dashboard HTML em tempo real.
// =============================================

using System;
using System.IO;
using System.IO.Ports;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using MySql.Data.MySqlClient;

namespace sistemaVacuo
{
    public partial class Form1 : Form
    {
        // --- CONFIGURAÇÕES DA PORTA SERIAL ---
        // Mude "COM3" para a porta que aparecer no Gerenciador de Dispositivos
        // quando plugar o ESP32 (ex: COM4, COM5...)
        private const string PORTA_SERIAL = "COM3";
        private const int BAUD_RATE = 115200;

        // --- CONFIGURAÇÕES DO MYSQL (XAMPP) ---
        // Usuário padrão do XAMPP é "root" sem senha
        private const string CONN_STRING =
            "Server=localhost;Database=sistema_vacuo;Uid=root;Pwd=;";

        private SerialPort portaSerial;

        public Form1()
        {
            InitializeComponent();

            this.FormBorderStyle = FormBorderStyle.None;
            this.WindowState = FormWindowState.Maximized;

            InicializarWebView();
            InicializarSerial();
        }

        // =============================================
        //  WEBVIEW - Carrega o dashboard HTML
        // =============================================
        private async void InicializarWebView()
        {
            await webView.EnsureCoreWebView2Async(null);
            webView.WebMessageReceived += RecebeuMensagemDoHtml;

            string caminhoHtml = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory, "frontend", "dashboard.html");
            webView.CoreWebView2.Navigate(caminhoHtml);
        }

        private void RecebeuMensagemDoHtml(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string mensagem = e.TryGetWebMessageAsString();

            if (mensagem == "fechar_app")
            {
                Application.Exit();
            }
            // Comandos vindos dos botões do dashboard para o ESP32
            else if (mensagem.StartsWith("cmd:"))
            {
                string comando = mensagem.Substring(4); // ex: "bomba:on"
                EnviarComandoEsp(comando);
            }
        }

        // =============================================
        //  SERIAL - Inicializa e lê dados do ESP32
        // =============================================
        private void InicializarSerial()
        {
            try
            {
                portaSerial = new SerialPort(PORTA_SERIAL, BAUD_RATE);
                portaSerial.NewLine = "\n";           // JSON termina com \n no sketch
                portaSerial.DataReceived += Serial_DataReceived;
                portaSerial.Open();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Erro ao abrir a porta serial {PORTA_SERIAL}:\n{ex.Message}\n\n" +
                    "Verifique se o ESP32 está conectado e a porta está correta.",
                    "Erro de Conexão Serial",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }

        // Chamado automaticamente quando o ESP32 envia uma linha
        private void Serial_DataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            try
            {
                string linha = portaSerial.ReadLine().Trim();

                // Ignora linhas que não são JSON
                if (!linha.StartsWith("{")) return;

                // Salva no banco de dados
                SalvarNoBanco(linha);

                // Atualiza o dashboard (precisa chamar na thread da UI)
                this.Invoke((Action)(() =>
                {
                    AtualizarDashboard(linha);
                }));
            }
            catch { /* ignora erros de leitura parcial */ }
        }

        // =============================================
        //  MYSQL - Salva os dados recebidos
        // =============================================
        private void SalvarNoBanco(string jsonBruto)
        {
            // Parse manual simples (evita dependência extra de JSON no C#)
            // Para algo mais robusto, instale Newtonsoft.Json pelo NuGet
            try
            {
                // Remove chaves e divide por vírgula
                string conteudo = jsonBruto.Trim('{', '}');
                var pares = conteudo.Split(',');

                float pressao = 0;
                bool bomba = false, valvula = false;
                int servo = 0;

                foreach (var par in pares)
                {
                    var kv = par.Split(':');
                    if (kv.Length < 2) continue;
                    string chave = kv[0].Trim().Trim('"');
                    string valor = kv[1].Trim().Trim('"');

                    if (chave == "pressao") float.TryParse(valor, out pressao);
                    else if (chave == "bomba") bomba = valor == "true";
                    else if (chave == "valvula") valvula = valor == "true";
                    else if (chave == "servo") int.TryParse(valor, out servo);
                }

                using (var conn = new MySqlConnection(CONN_STRING))
                {
                    conn.Open();
                    var cmd = new MySqlCommand(
                        "INSERT INTO leituras (pressao, bomba_ligada, valvula_aberta, servo_angulo, registrado_em) " +
                        "VALUES (@p, @b, @v, @s, NOW())", conn);

                    cmd.Parameters.AddWithValue("@p", pressao);
                    cmd.Parameters.AddWithValue("@b", bomba);
                    cmd.Parameters.AddWithValue("@v", valvula);
                    cmd.Parameters.AddWithValue("@s", servo);
                    cmd.ExecuteNonQuery();
                }
            }
            catch { /* Banco offline, continua exibindo na tela */ }
        }

        // =============================================
        //  WEBVIEW - Manda o JSON pro JavaScript
        // =============================================
        private void AtualizarDashboard(string json)
        {
            // Chama a função atualizarDados() que está no script.js
            // passando o JSON direto como objeto JavaScript
            string script = $"atualizarDados({json});";
            webView.CoreWebView2.ExecuteScriptAsync(script);
        }

        // =============================================
        //  SERIAL - Envia comando para o ESP32
        // =============================================
        private void EnviarComandoEsp(string comando)
        {
            if (portaSerial != null && portaSerial.IsOpen)
            {
                portaSerial.WriteLine(comando);
            }
        }

        // Fecha a porta serial ao fechar o app
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            if (portaSerial != null && portaSerial.IsOpen)
                portaSerial.Close();
        }
    }
}