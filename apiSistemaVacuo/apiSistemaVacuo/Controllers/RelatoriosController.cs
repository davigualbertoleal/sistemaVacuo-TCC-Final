// =============================================
//  CONTROLLER - RelatoriosController.cs
//  Recebe PDFs gerados pelo frontend e envia para o S3
//  Endpoint: POST /api/relatorios/upload
// =============================================

using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Mvc;

namespace SistemaVacuoAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RelatoriosController : ControllerBase
    {
        private readonly IAmazonS3 _s3;
        private readonly IConfiguration _config;

        public RelatoriosController(IAmazonS3 s3, IConfiguration config)
        {
            _s3 = s3;
            _config = config;
        }

        // =============================================
        //  POST /api/relatorios/upload
        //  Recebe o PDF via multipart/form-data e envia para o S3
        //  Form field: "file" (application/pdf)
        // =============================================
        [HttpPost("upload")]
        [RequestSizeLimit(20 * 1024 * 1024)] // 20 MB
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Nenhum arquivo recebido." });

            if (!file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase)
                && !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "Apenas arquivos PDF são aceitos." });

            var bucketName = _config["AWS:BucketName"];
            if (string.IsNullOrWhiteSpace(bucketName))
                return StatusCode(500, new { error = "BucketName não configurado em appsettings.json." });

            // Organiza no bucket por ano/mês para facilitar listagem futura
            var keyPrefix = $"relatorios/{DateTime.UtcNow:yyyy/MM}";
            var key = $"{keyPrefix}/{file.FileName}";

            try
            {
                using var stream = file.OpenReadStream();

                var request = new PutObjectRequest
                {
                    BucketName  = bucketName,
                    Key         = key,
                    InputStream = stream,
                    ContentType = "application/pdf"
                };

                await _s3.PutObjectAsync(request);

                return Ok(new
                {
                    status    = "ok",
                    key,
                    bucket    = bucketName,
                    filename  = file.FileName,
                    tamanhoKB = Math.Round(file.Length / 1024.0, 1),
                    timestamp = DateTime.UtcNow
                });
            }
            catch (AmazonS3Exception ex)
            {
                return StatusCode(502, new { error = $"Erro ao enviar para o S3: {ex.Message}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // =============================================
        //  GET /api/relatorios
        //  Lista os PDFs armazenados no S3 (prefixo relatorios/)
        // =============================================
        [HttpGet]
        public async Task<IActionResult> Listar([FromQuery] int limit = 50)
        {
            var bucketName = _config["AWS:BucketName"];
            if (string.IsNullOrWhiteSpace(bucketName))
                return StatusCode(500, new { error = "BucketName não configurado em appsettings.json." });

            try
            {
                var request = new ListObjectsV2Request
                {
                    BucketName = bucketName,
                    Prefix     = "relatorios/",
                    MaxKeys    = limit
                };

                var response = await _s3.ListObjectsV2Async(request);

                var arquivos = response.S3Objects.Select(o => new
                {
                    key          = o.Key,
                    filename     = o.Key.Split('/').Last(),
                    tamanhoKB    = Math.Round((o.Size ?? 0) / 1024.0, 1),
                    ultimaAlteracao = o.LastModified
                });

                return Ok(arquivos);
            }
            catch (AmazonS3Exception ex)
            {
                return StatusCode(502, new { error = $"Erro ao listar S3: {ex.Message}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}