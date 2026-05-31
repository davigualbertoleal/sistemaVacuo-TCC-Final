// =============================================
//  CONTROLLER - BombaController.cs
//  Comandos para controle do relay (bomba de vácuo)
//  Endpoints consumidos pela API → ESP32
// =============================================

using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace SistemaVacuoAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BombaController : ControllerBase
    {
        private readonly MySqlConnection _connection;

        public BombaController(MySqlConnection connection)
        {
            _connection = connection;
        }

        // =============================================
        //  POST /api/bomba/comando
        //  Envia um comando liga/desliga para a bomba
        //  Body: { "ligar": true, "cicloId": 1 }
        // =============================================
        [HttpPost("comando")]
        public async Task<IActionResult> PostComando([FromBody] BombaComandoRequest request)
        {
            if (request == null)
                return BadRequest(new { error = "Dados inválidos" });

            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"INSERT INTO comandosBomba (cicloId, dataHora, ligar, origem)
                      VALUES (@ciclo, NOW(), @ligar, @origem)",
                    _connection);

                cmd.Parameters.AddWithValue("@ciclo", request.cicloId ?? 0);
                cmd.Parameters.AddWithValue("@ligar", request.ligar);
                cmd.Parameters.AddWithValue("@origem", request.origem ?? "API");

                await cmd.ExecuteNonQueryAsync();

                return Ok(new
                {
                    status    = "ok",
                    ligar     = request.ligar,
                    cicloId   = request.cicloId,
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
        //  GET /api/bomba/pendente
        //  ESP32 consulta se há um comando pendente
        //  Retorna o mais recente não executado
        // =============================================
        [HttpGet("pendente")]
        public async Task<IActionResult> GetComandoPendente()
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"SELECT id, cicloId, ligar, dataHora
                      FROM comandosBomba
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
                        ligar    = Convert.ToBoolean(reader["ligar"]),
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
        //  PATCH /api/bomba/executado/{id}
        //  ESP32 confirma execução do comando
        // =============================================
        [HttpPatch("executado/{id}")]
        public async Task<IActionResult> MarcarExecutado(int id)
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    "UPDATE comandosBomba SET executado = TRUE, dataExecucao = NOW() WHERE id = @id",
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
        //  GET /api/bomba/historico?cicloId=1&limit=20
        //  Histórico de comandos da bomba
        // =============================================
        [HttpGet("historico")]
        public async Task<IActionResult> GetHistorico([FromQuery] int? cicloId = null, [FromQuery] int limit = 20)
        {
            try
            {
                await _connection.OpenAsync();

                string query = "SELECT id, cicloId, dataHora, ligar, origem, executado, dataExecucao FROM comandosBomba";

                if (cicloId.HasValue)
                    query += " WHERE cicloId = @ciclo";

                query += " ORDER BY id DESC LIMIT " + limit;

                var cmd = new MySqlCommand(query, _connection);

                if (cicloId.HasValue)
                    cmd.Parameters.AddWithValue("@ciclo", cicloId.Value);

                var reader = await cmd.ExecuteReaderAsync();

                var historico = new List<object>();
                while (await reader.ReadAsync())
                {
                    historico.Add(new
                    {
                        id           = Convert.ToInt32(reader["id"]),
                        cicloId      = Convert.ToInt32(reader["cicloId"]),
                        dataHora     = reader.GetDateTime(reader.GetOrdinal("dataHora")),
                        ligar        = Convert.ToBoolean(reader["ligar"]),
                        origem       = reader["origem"].ToString(),
                        executado    = Convert.ToBoolean(reader["executado"]),
                        dataExecucao = reader["dataExecucao"] == DBNull.Value
                                       ? (DateTime?)null
                                       : reader.GetDateTime(reader.GetOrdinal("dataExecucao"))
                    });
                }

                return Ok(historico);
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
    }

    // =============================================
    //  MODEL
    // =============================================
    public class BombaComandoRequest
    {
        public int? cicloId { get; set; }

        /// <summary>true = liga bomba (RELAY_ON), false = desliga (RELAY_OFF)</summary>
        public bool ligar { get; set; }

        /// <summary>Quem originou o comando: "API", "Manual", "Automático"</summary>
        public string? origem { get; set; }
    }
}