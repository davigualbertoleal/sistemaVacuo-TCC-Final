// =============================================
//  SISTEMA DE VÁCUO - Form1.cs
//  Login unificado → roteamento por papel
// =============================================

using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using MySql.Data.MySqlClient;

namespace sistemaVacuo
{
    public partial class Form1 : Form
    {
        // --- API ---
        private static readonly HttpClient httpClient = new HttpClient();
        private const string API_URL = "https://kg6l3t40-5000.brs.devtunnels.ms/api/leiturasSensores";

        // --- MySQL ---
        private const string CONN_STRING =
            "Server=localhost;Database=ProcessoVacuo;Uid=root;Pwd=;";

        private Timer timerLeitura;
        private int cicloAtualId = 1;

        private string papelAtual = null;
        private string usuarioId = null;
        private string usuarioNome = null;

        private bool dashboardPronto = false;

        public Form1()
        {
            InitializeComponent();
            this.FormBorderStyle = FormBorderStyle.None;
            this.WindowState = FormWindowState.Maximized;

            InicializarWebView();
            InicializarTimer();
        }

        // =============================================
        //  WEBVIEW — começa no LOGIN
        // =============================================
        private async void InicializarWebView()
        {
            // Permite que páginas file:// acessem localStorage e recursos locais
            var env = await CoreWebView2Environment.CreateAsync(null, null,
                new CoreWebView2EnvironmentOptions("--allow-file-access-from-files --disable-web-security"));

            await webView.EnsureCoreWebView2Async(env);
            webView.WebMessageReceived += RecebeuMensagemDoHtml;
            NavegaParaHtml("login.html");
        }

        // =============================================
        //  NAVEGAÇÃO SEGURA
        // =============================================
        private void NavegaParaHtml(string nomeArquivo)
        {
            string caminho = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory, "frontend", nomeArquivo);

            if (!File.Exists(caminho))
            {
                MessageBox.Show(
                    $"Arquivo não encontrado:\n{caminho}",
                    "Erro de navegação",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            webView.CoreWebView2.Navigate(new Uri(caminho).AbsoluteUri);
        }

        // =============================================
        //  MENSAGENS DO HTML
        // =============================================
        private void RecebeuMensagemDoHtml(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string mensagem = e.TryGetWebMessageAsString();

            // ── LOGIN ──────────────────────────────────────────────────────
            if (mensagem.StartsWith("navegar:"))
            {
                string payload = mensagem.Substring("navegar:".Length);
                string[] partes = payload.Split('|');

                string arquivoHtml = partes.Length > 0 ? partes[0] : "dashboard.html";
                usuarioId = partes.Length > 1 ? partes[1] : "??";
                usuarioNome = partes.Length > 2 ? partes[2] : usuarioId;
                papelAtual = partes.Length > 3 ? partes[3] : "operador";

                dashboardPronto = false;
                NavegaParaHtml(arquivoHtml);
                return;
            }

            // ── DASHBOARD PRONTO ───────────────────────────────────────────
            if (mensagem == "dashboard_pronto")
            {
                dashboardPronto = true;
                string script = $"receberContextoUsuario('{usuarioId}','{EscapeJs(usuarioNome)}','{papelAtual}');";
                webView.CoreWebView2.ExecuteScriptAsync(script);
                return;
            }

            // ── LOGOUT (X na tela do dashboard) ───────────────────────────
            if (mensagem == "logout")
            {
                dashboardPronto = false;
                usuarioId = null;
                usuarioNome = null;
                papelAtual = null;
                NavegaParaHtml("login.html");
                return;
            }

            // ── FECHAR APP ─────────────────────────────────────────────────
            if (mensagem == "fechar_app")
            {
                FinalizarCiclo();
                Application.Exit();
                return;
            }

            // ── CICLOS ─────────────────────────────────────────────────────
            if (mensagem == "iniciar_ciclo") { IniciarNovoCiclo(); return; }
            if (mensagem == "parar_ciclo") { FinalizarCiclo(); return; }

            // ── EMERGÊNCIA ─────────────────────────────────────────────────
            if (mensagem == "emergencia_ativada") { RegistrarEmergencia(); return; }
        }

        // =============================================
        //  TIMER — lê API a cada 1 segundo
        // =============================================
        private void InicializarTimer()
        {
            timerLeitura = new Timer();
            timerLeitura.Interval = 1000;
            timerLeitura.Tick += (s, ev) => { if (dashboardPronto) LerDadosDaAPI(); };
            timerLeitura.Start();
        }

        private async void LerDadosDaAPI()
        {
            try
            {
                var response = await httpClient.GetAsync(API_URL + "?limit=1");
                if (!response.IsSuccessStatusCode) return;
                string json = await response.Content.ReadAsStringAsync();
                var dados = ParseJsonSimples(json);
                if (dados.Count == 0) return;
                AtualizarDashboard(json);
            }
            catch (Exception ex) { Console.WriteLine($"Erro API: {ex.Message}"); }
        }

        private void AtualizarDashboard(string json)
        {
            if (!dashboardPronto) return;
            if (json.StartsWith("["))
            {
                json = json.Substring(1);
                int idx = json.LastIndexOf("]");
                if (idx >= 0) json = json.Substring(0, idx);
            }
            string script = $"if(typeof atualizarDados==='function') atualizarDados({json});";
            webView.CoreWebView2.ExecuteScriptAsync(script);
        }

        // =============================================
        //  EMERGÊNCIA
        // =============================================
        private void RegistrarEmergencia()
        {
            try
            {
                using (var conn = new MySqlConnection(CONN_STRING))
                {
                    conn.Open();
                    var cmd = new MySqlCommand(
                        @"INSERT INTO alertasseguranca (cicloId, nivelGravidade, descricao)
                          VALUES (@ciclo, 'Grave', @desc)", conn);
                    cmd.Parameters.AddWithValue("@ciclo", cicloAtualId);
                    cmd.Parameters.AddWithValue("@desc",
                        $"Emergência acionada pelo operador {usuarioId} ({usuarioNome})");
                    cmd.ExecuteNonQuery();
                }
            }
            catch { }
        }

        // =============================================
        //  CICLOS
        // =============================================
        private void IniciarNovoCiclo()
        {
            try
            {
                using (var conn = new MySqlConnection(CONN_STRING))
                {
                    conn.Open();
                    var cmd = new MySqlCommand(
                        "INSERT INTO ciclosProcesso (operadorResponsavelId, status) VALUES (NULL, 'Em Andamento')", conn);
                    cmd.ExecuteNonQuery();
                    cmd.CommandText = "SELECT LAST_INSERT_ID()";
                    cicloAtualId = Convert.ToInt32(cmd.ExecuteScalar());
                }
            }
            catch (Exception ex) { MessageBox.Show($"Erro ao iniciar ciclo: {ex.Message}"); }
        }

        private void FinalizarCiclo()
        {
            try
            {
                using (var conn = new MySqlConnection(CONN_STRING))
                {
                    conn.Open();
                    var cmd = new MySqlCommand(
                        "UPDATE ciclosProcesso SET dataFim=NOW(), status='Concluído' WHERE id=@id", conn);
                    cmd.Parameters.AddWithValue("@id", cicloAtualId);
                    cmd.ExecuteNonQuery();
                }
            }
            catch { }
        }

        // =============================================
        //  HELPERS
        // =============================================
        private static string EscapeJs(string s)
            => s?.Replace("\\", "\\\\").Replace("'", "\\'") ?? "";

        private Dictionary<string, object> ParseJsonSimples(string json)
        {
            var dict = new Dictionary<string, object>();
            json = json.Trim('[', ']').Trim('{', '}');
            foreach (var par in json.Split(','))
            {
                var kv = par.Split(':');
                if (kv.Length < 2) continue;
                string chave = kv[0].Trim().Trim('"');
                string valor = kv[1].Trim().Trim('"');
                if (float.TryParse(valor,
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out float numVal))
                    dict[chave] = numVal;
                else if (valor == "true") dict[chave] = true;
                else if (valor == "false") dict[chave] = false;
                else dict[chave] = valor;
            }
            return dict;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            timerLeitura?.Stop();
            timerLeitura?.Dispose();
        }
    }
}