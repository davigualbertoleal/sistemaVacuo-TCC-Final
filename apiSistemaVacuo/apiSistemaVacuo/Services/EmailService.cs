// =============================================
//  SERVICE - EmailService.cs
//  Envio de emails via Gmail SMTP
//  Usado pelo CicloController ao iniciar/parar ciclos
// =============================================

using System.Net;
using System.Net.Mail;

namespace SistemaVacuoAPI.Services
{
    public class EmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        // =============================================
        //  Envia email para uma lista de destinatários
        // =============================================
        public async Task EnviarAsync(List<string> destinatarios, string assunto, string corpo)
        {
            var smtpHost   = _config["Email:SmtpHost"]     ?? "smtp.gmail.com";
            var smtpPort   = int.Parse(_config["Email:SmtpPort"] ?? "587");
            var remetente  = _config["Email:Remetente"]    ?? throw new Exception("Email:Remetente não configurado");
            var senhaApp   = _config["Email:SenhaApp"]     ?? throw new Exception("Email:SenhaApp não configurada");
            var nomeExibir = _config["Email:NomeExibido"]  ?? "TSEA Energy - Sistema de Vácuo";

            using var client = new SmtpClient(smtpHost, smtpPort)
            {
                EnableSsl   = true,
                Credentials = new NetworkCredential(remetente, senhaApp)
            };

            foreach (var dest in destinatarios)
            {
                if (string.IsNullOrWhiteSpace(dest)) continue;
                try
                {
                    var mensagem = new MailMessage
                    {
                        From       = new MailAddress(remetente, nomeExibir),
                        Subject    = assunto,
                        Body       = corpo,
                        IsBodyHtml = true
                    };
                    mensagem.To.Add(dest);
                    await client.SendMailAsync(mensagem);
                    _logger.LogInformation("[EMAIL] Enviado para {dest}: {assunto}", dest, assunto);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[EMAIL] Falha ao enviar para {dest}: {msg}", dest, ex.Message);
                }
            }
        }

        // =============================================
        //  Template: Processo Iniciado
        // =============================================
        public string TemplateProcessoIniciado(int cicloId, string operadorNome, string operadorId, DateTime dataHora)
        {
            return $@"
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background: #1a1a1a; padding: 24px; border-radius: 8px 8px 0 0;'>
                    <h2 style='color: #ffffff; margin: 0;'>⚙️ TSEA Energy — Sistema de Vácuo</h2>
                </div>
                <div style='background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0;'>
                    <h3 style='color: #1a1a1a;'>Processo Iniciado</h3>
                    <p style='color: #444;'>Um novo ciclo de vácuo foi iniciado no sistema.</p>
                    <table style='width: 100%; border-collapse: collapse; margin-top: 16px;'>
                        <tr style='background: #fff; border-bottom: 1px solid #e0e0e0;'>
                            <td style='padding: 10px; font-weight: bold; color: #555; width: 40%;'>Ciclo ID</td>
                            <td style='padding: 10px; color: #1a1a1a;'>#{cicloId}</td>
                        </tr>
                        <tr style='background: #f5f5f5; border-bottom: 1px solid #e0e0e0;'>
                            <td style='padding: 10px; font-weight: bold; color: #555;'>Operador</td>
                            <td style='padding: 10px; color: #1a1a1a;'>{operadorNome} ({operadorId})</td>
                        </tr>
                        <tr style='background: #fff;'>
                            <td style='padding: 10px; font-weight: bold; color: #555;'>Data/Hora</td>
                            <td style='padding: 10px; color: #1a1a1a;'>{dataHora:dd/MM/yyyy HH:mm:ss}</td>
                        </tr>
                    </table>
                </div>
                <div style='background: #e8e8e8; padding: 12px 24px; border-radius: 0 0 8px 8px;'>
                    <p style='color: #888; font-size: 12px; margin: 0;'>Email automático — TSEA Energy Sistema de Vácuo v2.0</p>
                </div>
            </div>";
        }

        // =============================================
        //  Template: Processo Parado / Emergência
        // =============================================
        public string TemplateProcessoParado(int cicloId, string motivo, DateTime dataHora)
        {
            var corHeader  = motivo == "EMERGENCIA" ? "#c00000" : "#1a1a1a";
            var icone      = motivo == "EMERGENCIA" ? "🚨" : "⛔";
            var titulo     = motivo == "EMERGENCIA" ? "EMERGÊNCIA ATIVADA" : "Processo Encerrado";

            return $@"
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background: {corHeader}; padding: 24px; border-radius: 8px 8px 0 0;'>
                    <h2 style='color: #ffffff; margin: 0;'>{icone} TSEA Energy — {titulo}</h2>
                </div>
                <div style='background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0;'>
                    <p style='color: #444;'>O ciclo de vácuo foi encerrado.</p>
                    <table style='width: 100%; border-collapse: collapse; margin-top: 16px;'>
                        <tr style='background: #fff; border-bottom: 1px solid #e0e0e0;'>
                            <td style='padding: 10px; font-weight: bold; color: #555; width: 40%;'>Ciclo ID</td>
                            <td style='padding: 10px; color: #1a1a1a;'>#{cicloId}</td>
                        </tr>
                        <tr style='background: #f5f5f5; border-bottom: 1px solid #e0e0e0;'>
                            <td style='padding: 10px; font-weight: bold; color: #555;'>Motivo</td>
                            <td style='padding: 10px; color: {corHeader}; font-weight: bold;'>{motivo}</td>
                        </tr>
                        <tr style='background: #fff;'>
                            <td style='padding: 10px; font-weight: bold; color: #555;'>Data/Hora</td>
                            <td style='padding: 10px; color: #1a1a1a;'>{dataHora:dd/MM/yyyy HH:mm:ss}</td>
                        </tr>
                    </table>
                </div>
                <div style='background: #e8e8e8; padding: 12px 24px; border-radius: 0 0 8px 8px;'>
                    <p style='color: #888; font-size: 12px; margin: 0;'>Email automático — TSEA Energy Sistema de Vácuo v2.0</p>
                </div>
            </div>";
        }
    }
}