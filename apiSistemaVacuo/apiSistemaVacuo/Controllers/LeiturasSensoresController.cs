// =============================================
//  CONTROLLER - LeiturasSensoresController.cs
//  Endpoints da API
// =============================================

using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data;

namespace SistemaVacuoAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LeiturasSensoresController : ControllerBase
    {
        private readonly MySqlConnection _connection;

        public LeiturasSensoresController(MySqlConnection connection)
        {
            _connection = connection;
        }

        // =============================================
        //  POST /api/leituras - Recebe dados do ESP32
        // =============================================
        [HttpPost]
        public async Task<IActionResult> PostLeitura([FromBody] LeituraRequest request)
        {
            if (request == null)
                return BadRequest("Dados inválidos");

            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    @"INSERT INTO leiturasSensores 
                    (cicloId, dataHora, estadoMaquina, 
                     pressaoCamaraMbar, 
                     pressaoTubo1Mbar, fluxoTubo1LPM,
                     pressaoTubo2Mbar, fluxoTubo2LPM,
                     pressaoTubo3Mbar, fluxoTubo3LPM,
                     bombaLigada, valvulaAberta, servoAngulo)
                    VALUES 
                    (@ciclo, NOW(), @estado,
                     @pCamara,
                     @p1, @f1,
                     @p2, @f2,
                     @p3, @f3,
                     @bomba, @valvula, @servo)", _connection);

                cmd.Parameters.AddWithValue("@ciclo", request.cicloId ?? 1);
                cmd.Parameters.AddWithValue("@estado", request.estadoMaquina ?? "Desligado");
                cmd.Parameters.AddWithValue("@pCamara", request.pressaoCamaraMbar ?? 0);
                cmd.Parameters.AddWithValue("@p1", request.pressaoTubo1Mbar ?? 0);
                cmd.Parameters.AddWithValue("@f1", request.fluxoTubo1LPM ?? 0);
                cmd.Parameters.AddWithValue("@p2", request.pressaoTubo2Mbar ?? 0);
                cmd.Parameters.AddWithValue("@f2", request.fluxoTubo2LPM ?? 0);
                cmd.Parameters.AddWithValue("@p3", request.pressaoTubo3Mbar ?? 0);
                cmd.Parameters.AddWithValue("@f3", request.fluxoTubo3LPM ?? 0);
                cmd.Parameters.AddWithValue("@bomba", request.bombaLigada ?? false);
                cmd.Parameters.AddWithValue("@valvula", request.valvulaAberta ?? false);
                cmd.Parameters.AddWithValue("@servo", request.servoAngulo ?? 0);

                await cmd.ExecuteNonQueryAsync();

                return Ok(new { status = "ok", cicloId = request.cicloId, timestamp = DateTime.UtcNow });
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
        //  GET /api/leituras - Retorna últimas leituras
        // =============================================
        [HttpGet]
        public async Task<IActionResult> GetLeituras([FromQuery] int? cicloId = null, [FromQuery] int limit = 50)
        {
            try
            {
                await _connection.OpenAsync();

                string query = "SELECT * FROM leiturasSensores";

                if (cicloId.HasValue)
                    query += $" WHERE cicloId = {cicloId}";

                query += " ORDER BY id DESC LIMIT " + limit;

                var cmd = new MySqlCommand(query, _connection);
                var reader = await cmd.ExecuteReaderAsync();

                var leituras = new List<object>();
                while (await reader.ReadAsync())
                {
                    leituras.Add(new
                    {
                        id = reader.GetInt32("id"),
                        cicloId = reader.GetInt32("cicloId"),
                        dataHora = reader.GetDateTime("dataHora"),
                        estadoMaquina = reader.GetString("estadoMaquina"),
                        pressaoCamaraMbar = reader.GetFloat("pressaoCamaraMbar"),
                        pressaoTubo1Mbar = reader.GetFloat("pressaoTubo1Mbar"),
                        fluxoTubo1LPM = reader.GetFloat("fluxoTubo1LPM"),
                        pressaoTubo2Mbar = reader.GetFloat("pressaoTubo2Mbar"),
                        fluxoTubo2LPM = reader.GetFloat("fluxoTubo2LPM"),
                        pressaoTubo3Mbar = reader.GetFloat("pressaoTubo3Mbar"),
                        fluxoTubo3LPM = reader.GetFloat("fluxoTubo3LPM")
                    });
                }

                return Ok(leituras);
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
        //  GET /api/leituras/ciclo/{id} - Leituras de um ciclo
        // =============================================
        [HttpGet("ciclo/{id}")]
        public async Task<IActionResult> GetLeiturasCiclo(int id)
        {
            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    "SELECT * FROM leiturasSensores WHERE cicloId = @id ORDER BY id DESC LIMIT 1",
                    _connection);

                cmd.Parameters.AddWithValue("@id", id);
                var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var leitura = new
                    {
                        id = reader.GetInt32("id"),
                        cicloId = reader.GetInt32("cicloId"),
                        dataHora = reader.GetDateTime("dataHora"),
                        estadoMaquina = reader.GetString("estadoMaquina"),
                        pressaoCamaraMbar = reader.GetFloat("pressaoCamaraMbar"),
                        pressaoTubo1Mbar = reader.GetFloat("pressaoTubo1Mbar"),
                        fluxoTubo1LPM = reader.GetFloat("fluxoTubo1LPM"),
                        pressaoTubo2Mbar = reader.GetFloat("pressaoTubo2Mbar"),
                        fluxoTubo2LPM = reader.GetFloat("fluxoTubo2LPM"),
                        pressaoTubo3Mbar = reader.GetFloat("pressaoTubo3Mbar"),
                        fluxoTubo3LPM = reader.GetFloat("fluxoTubo3LPM")
                    };
                    return Ok(leitura);
                }

                return NotFound("Nenhuma leitura encontrada para este ciclo");
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
    //  MODEL - Estrutura de dados recebida do ESP32
    // =============================================
    public class LeituraRequest
    {
        public int? cicloId { get; set; }
        public string? estadoMaquina { get; set; }
        public float? pressaoCamaraMbar { get; set; }
        public float? pressaoTubo1Mbar { get; set; }
        public float? fluxoTubo1LPM { get; set; }
        public float? pressaoTubo2Mbar { get; set; }
        public float? fluxoTubo2LPM { get; set; }
        public float? pressaoTubo3Mbar { get; set; }
        public float? fluxoTubo3LPM { get; set; }
        public bool? bombaLigada { get; set; }
        public bool? valvulaAberta { get; set; }
        public int? servoAngulo { get; set; }
    }
}