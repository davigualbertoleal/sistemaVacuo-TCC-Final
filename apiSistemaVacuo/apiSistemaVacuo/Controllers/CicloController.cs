// =============================================
//  CONTROLLER - CicloController.cs
//  Gerencia ciclos de vácuo: START / STOP / estado da máquina
//  Espelha os comandos startVacuum() e stopVacuum() do VacuumController.cpp
// =============================================

using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using SistemaVacuoAPI.Services;

namespace SistemaVacuoAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CicloController : ControllerBase
    {
        private readonly MySqlConnection _connection;
        private readonly EmailService    _email;
        private readonly IConfiguration  _config;

        public CicloController(MySqlConnection connection, EmailService email, IConfiguration config)
        {
            _connection = connection;
            _email      = email;
            _config     = config;
        }

        // =============================================
        //  POST /api/ciclo/iniciar
        // =============================================
        [HttpPost("iniciar")]
        public async Task<IActionResult> IniciarCiclo([FromBody] IniciarCicloRequest request)
        {
            try
            {
                await _connection.OpenAsync();

                var checkCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM ciclos WHERE status IN ('iniciando', 'estagio1', 'estagio2', 'holding')",
                    _connection);

                long ativos = (long)(await checkCmd.ExecuteScalarAsync() ?? 0L);
                if (ativos > 0)
                    return Conflict(new { error = "Já existe um ciclo em andamento" });

                var insertCmd = new MySqlCommand(
                    @"INSERT INTO ciclos (operadorId, dataInicio, status)
                      VALUES (@op, NOW(), 'iniciando');
                      SELECT LAST_INSERT_ID();",
                    _connection);

                insertCmd.Parameters.AddWithValue("@op", request?.operadorId ?? 0);
                var cicloId = Convert.ToInt32(await insertCmd.ExecuteScalarAsync());

                var cmdEsp = new MySqlCommand(
                    @"INSERT INTO comandosCiclo (cicloId, dataHora, acao, origem)
                      VALUES (@ciclo, NOW(), 'START', 'API')",
                    _connection);

                cmdEsp.Parameters.AddWithValue("@ciclo", cicloId);
                await cmdEsp.ExecuteNonQueryAsync();

                string operadorNome = "Desconhecido";
                string operadorIdentificador = "N/A";

                if (request?.operadorId > 0)
                {
                    var opCmd = new MySqlCommand(
                        "SELECT nome, identificador FROM operadores WHERE id = @id LIMIT 1",
                        _connection);
                    opCmd.Parameters.AddWithValue("@id", request.operadorId);
                    var opReader = await opCmd.ExecuteReaderAsync();
                    if (await opReader.ReadAsync())
                    {
                        operadorNome          = opReader["nome"].ToString()          ?? operadorNome;
                        operadorIdentificador = opReader["identificador"].ToString() ?? operadorIdentificador;
                    }
                    await opReader.CloseAsync();
                }

                var emails = await BuscarEmailsEngenheiros();
                var emailAdmin = _config["Email:EmailAdmin"];
                if (!string.IsNullOrWhiteSpace(emailAdmin))
                    emails.Add(emailAdmin);

                if (emails.Count > 0)
                {
                    _ = Task.Run(async () =>
                    {
                        var corpo = _email.TemplateProcessoIniciado(
                            cicloId,
                            operadorNome,
                            operadorIdentificador,
                            DateTime.Now);

                        await _email.EnviarAsync(
                            emails,
                            $"[TSEA] Ciclo #{cicloId} iniciado — {DateTime.Now:dd/MM HH:mm}",
                            corpo);
                    });
                }

                return Ok(new
                {
                    status    = "ok",
                    cicloId,
                    acao      = "START",
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  POST /api/ciclo/{id}/parar
        // =============================================
        [HttpPost("{id}/parar")]
        public async Task<IActionResult> PararCiclo(int id, [FromQuery] string? motivo = null)
        {
            try
            {
                await _connection.OpenAsync();

                var checkCmd = new MySqlCommand(
                    "SELECT status FROM ciclos WHERE id = @id LIMIT 1",
                    _connection);

                checkCmd.Parameters.AddWithValue("@id", id);
                var status = await checkCmd.ExecuteScalarAsync() as string;

                if (status == null)
                    return NotFound(new { error = "Ciclo não encontrado" });

                if (status is "parado" or "erro")
                    return BadRequest(new { error = $"Ciclo já está com status '{status}'" });

                var updateCmd = new MySqlCommand(
                    "UPDATE ciclos SET status = 'parando' WHERE id = @id",
                    _connection);

                updateCmd.Parameters.AddWithValue("@id", id);
                await updateCmd.ExecuteNonQueryAsync();

                var cmdEsp = new MySqlCommand(
                    @"INSERT INTO comandosCiclo (cicloId, dataHora, acao, origem)
                      VALUES (@ciclo, NOW(), 'STOP', 'API')",
                    _connection);

                cmdEsp.Parameters.AddWithValue("@ciclo", id);
                await cmdEsp.ExecuteNonQueryAsync();

                var emails = await BuscarEmailsEngenheiros();
                var emailAdmin = _config["Email:EmailAdmin"];
                if (!string.IsNullOrWhiteSpace(emailAdmin))
                    emails.Add(emailAdmin);

                if (emails.Count > 0)
                {
                    var motivoFinal = motivo?.ToUpper() ?? "ENCERRAMENTO NORMAL";
                    _ = Task.Run(async () =>
                    {
                        var corpo = _email.TemplateProcessoParado(id, motivoFinal, DateTime.Now);
                        await _email.EnviarAsync(
                            emails,
                            $"[TSEA] Ciclo #{id} encerrado — {motivoFinal}",
                            corpo);
                    });
                }

                return Ok(new
                {
                    status    = "ok",
                    cicloId   = id,
                    acao      = "STOP",
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  PATCH /api/ciclo/{id}/status
        // =============================================
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> AtualizarStatus(int id, [FromBody] AtualizarStatusRequest request)
        {
            var estadosValidos = new[] { "iniciando", "estagio1", "estagio2", "holding", "parando", "parado", "erro" };

            if (request == null || string.IsNullOrEmpty(request.status))
                return BadRequest(new { error = "Status obrigatório" });

            if (!estadosValidos.Contains(request.status.ToLower()))
                return BadRequest(new { error = $"Status inválido. Use: {string.Join(", ", estadosValidos)}" });

            try
            {
                await _connection.OpenAsync();

                string extra = request.status.ToLower() is "parado" or "erro"
                    ? ", dataFim = NOW()"
                    : "";

                var cmd = new MySqlCommand(
                    $"UPDATE ciclos SET status = @status{extra} WHERE id = @id",
                    _connection);

                cmd.Parameters.AddWithValue("@status", request.status.ToLower());
                cmd.Parameters.AddWithValue("@id", id);

                int rows = await cmd.ExecuteNonQueryAsync();

                if (rows == 0)
                    return NotFound(new { error = "Ciclo não encontrado" });

                return Ok(new
                {
                    status     = "ok",
                    cicloId    = id,
                    novoStatus = request.status,
                    timestamp  = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  GET /api/ciclo/pendente
        // =============================================
        [HttpGet("pendente")]
        public async Task<IActionResult> GetComandoPendente()
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"SELECT id, cicloId, acao, dataHora
                      FROM comandosCiclo
                      WHERE executado = FALSE
                      ORDER BY id DESC
                      LIMIT 1",
                    _connection);

                var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    return Ok(new
                    {
                        id       = Convert.ToInt32(reader["id"]),
                        cicloId  = Convert.ToInt32(reader["cicloId"]),
                        acao     = reader["acao"].ToString(),
                        dataHora = reader.GetDateTime(reader.GetOrdinal("dataHora"))
                    });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  PATCH /api/ciclo/comando/{id}/executado
        // =============================================
        [HttpPatch("comando/{id}/executado")]
        public async Task<IActionResult> MarcarComandoExecutado(int id)
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    "UPDATE comandosCiclo SET executado = TRUE, dataExecucao = NOW() WHERE id = @id",
                    _connection);

                cmd.Parameters.AddWithValue("@id", id);
                int rows = await cmd.ExecuteNonQueryAsync();

                if (rows == 0)
                    return NotFound(new { error = "Comando não encontrado" });

                return Ok(new { status = "ok", id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  GET /api/ciclo
        // =============================================
        [HttpGet]
        public async Task<IActionResult> GetCiclos([FromQuery] int limit = 20)
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"SELECT id, operadorId, dataInicio, dataFim, status
                      FROM ciclos
                      ORDER BY id DESC
                      LIMIT " + limit,
                    _connection);

                var reader = await cmd.ExecuteReaderAsync();
                var ciclos = new List<object>();

                while (await reader.ReadAsync())
                {
                    ciclos.Add(new
                    {
                        id         = Convert.ToInt32(reader["id"]),
                        operadorId = Convert.ToInt32(reader["operadorId"]),
                        dataInicio = reader.GetDateTime(reader.GetOrdinal("dataInicio")),
                        dataFim    = reader["dataFim"] == DBNull.Value
                                     ? (DateTime?)null
                                     : reader.GetDateTime(reader.GetOrdinal("dataFim")),
                        status     = reader["status"].ToString()
                    });
                }

                return Ok(ciclos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  GET /api/ciclo/{id}
        // =============================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetCiclo(int id)
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    "SELECT id, operadorId, dataInicio, dataFim, status FROM ciclos WHERE id = @id LIMIT 1",
                    _connection);

                cmd.Parameters.AddWithValue("@id", id);
                var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    return Ok(new
                    {
                        id         = Convert.ToInt32(reader["id"]),
                        operadorId = Convert.ToInt32(reader["operadorId"]),
                        dataInicio = reader.GetDateTime(reader.GetOrdinal("dataInicio")),
                        dataFim    = reader["dataFim"] == DBNull.Value
                                     ? (DateTime?)null
                                     : reader.GetDateTime(reader.GetOrdinal("dataFim")),
                        status     = reader["status"].ToString()
                    });
                }

                return NotFound(new { error = "Ciclo não encontrado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        // =============================================
        //  HELPER PRIVADO — busca emails de engenheiros/supervisores
        // =============================================
        private async Task<List<string>> BuscarEmailsEngenheiros()
        {
            var emails = new List<string>();
            try
            {
                var cmd = new MySqlCommand(
                    @"SELECT email FROM operadores
                      WHERE papel IN ('engenheiro', 'supervisor')
                      AND email IS NOT NULL
                      AND email != ''",
                    _connection);

                var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var email = reader["email"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(email))
                        emails.Add(email);
                }
                await reader.CloseAsync();
            }
            catch { /* silencioso — email é secundário */ }
            return emails;
        }
    }

    // =============================================
    //  MODELS
    // =============================================
    public class IniciarCicloRequest
    {
        public int? operadorId { get; set; }
    }

    public class AtualizarStatusRequest
    {
        /// <summary>
        /// iniciando | estagio1 | estagio2 | holding | parando | parado | erro
        /// </summary>
        public string? status { get; set; }
    }
}