// OPERADORESCONTROLLER.CS

using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace SistemaVacuoAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OperadoresController : ControllerBase
    {
        private readonly MySqlConnection _connection;

        public OperadoresController(MySqlConnection connection)
        {
            _connection = connection;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string identificador)
        {
            if (string.IsNullOrEmpty(identificador))
                return BadRequest(new { error = "Identificador obrigatório" });

            try
            {
                await _connection.OpenAsync();

                var cmd = new MySqlCommand(
                    "SELECT id, nome, identificador, papel FROM operadores WHERE UPPER(identificador) = @id LIMIT 1",
                    _connection);

                // Busca sempre em uppercase — funciona independente de como está no banco
                cmd.Parameters.AddWithValue("@id", identificador.ToUpper());
                var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    return Ok(new
                    {
                        id       = reader["id"],
                        nome     = reader["nome"],
                        identificador = reader["identificador"],
                        papel    = reader["papel"]
                    });
                }

                return NotFound(new { error = "Operador não encontrado" });
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
}