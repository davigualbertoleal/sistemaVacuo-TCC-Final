// =============================================
//  CONTROLLER - ServoController.cs
//  Comandos para controle do servo motor (válvula)
//  Endpoints consumidos pela API → ESP32
// =============================================

using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace SistemaVacuoAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ServoController : ControllerBase
    {
        private readonly MySqlConnection _connection;

        public ServoController(MySqlConnection connection)
        {
            _connection = connection;
        }

        [HttpPost("comando")]
        public async Task<IActionResult> PostComando([FromBody] ServoComandoRequest request)
        {
            if (request == null)
                return BadRequest(new { error = "Dados inválidos" });

            // ✏️ Alterado: 90 → 180
            if (request.angulo < 0 || request.angulo > 180)
                return BadRequest(new { error = "Ângulo deve estar entre 0 e 180 graus" });

            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"INSERT INTO comandosServo (cicloId, dataHora, angulo, origem)
                      VALUES (@ciclo, NOW(), @angulo, @origem)",
                    _connection);

                cmd.Parameters.AddWithValue("@ciclo", request.cicloId ?? 0);
                cmd.Parameters.AddWithValue("@angulo", request.angulo);
                cmd.Parameters.AddWithValue("@origem", request.origem ?? "API");

                await cmd.ExecuteNonQueryAsync();

                return Ok(new
                {
                    status = "ok",
                    angulo = request.angulo,
                    cicloId = request.cicloId,
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

        [HttpGet("pendente")]
        public async Task<IActionResult> GetComandoPendente()
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"SELECT id, cicloId, angulo, dataHora
                      FROM comandosServo
                      WHERE executado = FALSE
                      ORDER BY id DESC
                      LIMIT 1",
                    _connection);

                var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    return Ok(new
                    {
                        id        = Convert.ToInt32(reader["id"]),
                        cicloId   = Convert.ToInt32(reader["cicloId"]),
                        angulo    = Convert.ToSingle(reader["angulo"]),
                        dataHora  = reader.GetDateTime(reader.GetOrdinal("dataHora"))
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

        [HttpPatch("executado/{id}")]
        public async Task<IActionResult> MarcarExecutado(int id)
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    "UPDATE comandosServo SET executado = TRUE, dataExecucao = NOW() WHERE id = @id",
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

        [HttpGet("historico")]
        public async Task<IActionResult> GetHistorico([FromQuery] int? cicloId = null, [FromQuery] int limit = 20)
        {
            try
            {
                await _connection.OpenAsync();

                string query = "SELECT id, cicloId, dataHora, angulo, origem, executado, dataExecucao FROM comandosServo";

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
                        angulo       = Convert.ToSingle(reader["angulo"]),
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

    public class ServoComandoRequest
    {
        public int? cicloId { get; set; }

        // ✏️ Alterado: "0 a 90" → "0 a 180"
        /// <summary>Ângulo desejado: 0 a 180. Igual a SERVO_MIN/MAX_ANGLE no config.h</summary>
        public float angulo { get; set; }

        /// <summary>Quem originou o comando: "API", "Manual", "Automático"</summary>
        public string? origem { get; set; }
    }
}