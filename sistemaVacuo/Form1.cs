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
        private static HttpClient httpClient = new HttpClient();
        private const string API_URL = "http://localhost:5000/api/leiturasSensores";

        // --- MYSQL (XAMPP) ---
        private const string CONN_STRING =
            "Server=localhost;Database=ProcessoVacuo;Uid=root;Pwd=;";

        private Timer timerLeitura;
        private int cicloAtualId = 1;

        public Form1()
        {
            InitializeComponent();
            this.FormBorderStyle = FormBorderStyle.None;
            this.WindowState = FormWindowState.Maximized;

            InicializarWebView();
            InicializarTimer();
        }

        // =============================================
        //  WEBVIEW - CARREGA HTML
        // =============================================
        private async void InicializarWebView()
        {
            try
            {
                // Aguarda a inicialização do ambiente do WebView2
                await webView.EnsureCoreWebView2Async(null);

                webView.WebMessageReceived += RecebeuMensagemDoHtml;

                // Monta o caminho completo até o arquivo HTML
                string caminhoHtml = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory, "frontend", "dashboard.html");

                if (File.Exists(caminhoHtml))
                {
                    // ✅ MUDANÇA AQUI: 
                    // Em vez de NavigateToString (que perde a referência do CSS),
                    // usamos Navigate com uma URI de arquivo. Isso permite que o 
                    // navegador encontre o CSS na mesma pasta ou subpastas.
                    webView.CoreWebView2.Navigate(new Uri(caminhoHtml).AbsoluteUri);

                    Console.WriteLine("✅ Dashboard carregado via URI local.");
                }
                else
                {
                    MessageBox.Show($"❌ Arquivo não encontrado em:\n{caminhoHtml}",
                        "Erro de Caminho", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"❌ Erro ao inicializar WebView:\n{ex.Message}",
                    "Erro Crítico", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void RecebeuMensagemDoHtml(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string mensagem = e.TryGetWebMessageAsString();

            if (mensagem == "fechar_app")
            {
                FinalizarCiclo();
                Application.Exit();
            }
            else if (mensagem == "iniciar_ciclo")
            {
                IniciarNovoCiclo();
            }
            else if (mensagem == "parar_ciclo")
            {
                FinalizarCiclo();
            }
        }

        // =============================================
        //  TIMER - Lê API a cada 1 segundo
        // =============================================
        private void InicializarTimer()
        {
            timerLeitura = new Timer();
            timerLeitura.Interval = 1000; // 1 segundo
            timerLeitura.Tick += (s, e) => LerDadosDaAPI();
            timerLeitura.Start();
        }

        // =============================================
        //  LÊ DADOS DA API
        // =============================================
        private async void LerDadosDaAPI()
        {
            try
            {
                HttpResponseMessage response = await httpClient.GetAsync(API_URL + "?limit=1");

                if (response.IsSuccessStatusCode)
                {
                    string json = await response.Content.ReadAsStringAsync();

                    // Parse JSON
                    var dados = ParseJsonSimples(json);

                    if (dados.Count > 0)
                    {
                        // Atualiza dashboard
                        AtualizarDashboard(json);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Erro ao ler API: {ex.Message}");
            }
        }

        // =============================================
        //  HELPER: Parse JSON simples
        // =============================================
        private Dictionary<string, object> ParseJsonSimples(string json)
        {
            var dict = new Dictionary<string, object>();

            // Remove [ ] se for array
            json = json.Trim('[', ']');

            // Se tem { }, remove
            string conteudo = json.Trim('{', '}');
            var pares = conteudo.Split(',');

            foreach (var par in pares)
            {
                var kv = par.Split(':');
                if (kv.Length < 2) continue;

                string chave = kv[0].Trim().Trim('"');
                string valor = kv[1].Trim().Trim('"');

                if (float.TryParse(valor, out float numVal))
                    dict[chave] = numVal;
                else if (valor == "true")
                    dict[chave] = true;
                else if (valor == "false")
                    dict[chave] = false;
                else
                    dict[chave] = valor;
            }

            return dict;
        }

        // =============================================
        //  WEBVIEW → JavaScript
        // =============================================
        private void AtualizarDashboard(string json)
        {
            try
            {
                // Se for array, pega o primeiro elemento
                if (json.StartsWith("["))
                {
                    json = json.Substring(1); // Remove [
                    int indexFechar = json.LastIndexOf("]");
                    json = json.Substring(0, indexFechar); // Remove ]
                }

                string script = $"if (typeof atualizarDados === 'function') {{ atualizarDados({json}); }}";
                webView.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Erro ao atualizar dashboard: {ex.Message}");
            }
        }

        // =============================================
        //  CICLOS DE PROCESSO
        // =============================================
        private void IniciarNovoCiclo()
        {
            try
            {
                using (var conn = new MySqlConnection(CONN_STRING))
                {
                    conn.Open();

                    var cmd = new MySqlCommand(
                        "INSERT INTO ciclosProcesso (operadorResponsavelId, status) " +
                        "VALUES (NULL, 'Em Andamento')", conn);

                    cmd.ExecuteNonQuery();

                    cmd.CommandText = "SELECT LAST_INSERT_ID()";
                    cicloAtualId = (int)(long)cmd.ExecuteScalar();

                    MessageBox.Show($"✅ Ciclo {cicloAtualId} iniciado!", "Ciclo", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"❌ Erro ao iniciar ciclo: {ex.Message}");
            }
        }

        private void FinalizarCiclo()
        {
            try
            {
                using (var conn = new MySqlConnection(CONN_STRING))
                {
                    conn.Open();

                    var cmd = new MySqlCommand(
                        "UPDATE ciclosProcesso SET dataFim = NOW(), status = 'Concluído' " +
                        "WHERE id = @id", conn);

                    cmd.Parameters.AddWithValue("@id", cicloAtualId);
                    cmd.ExecuteNonQuery();
                }
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            timerLeitura?.Stop();
            timerLeitura?.Dispose();
        }
    }
}