using MySql.Data.MySqlClient;
using Amazon.S3;  // <- adiciona

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Permite upload de PDFs de até 20 MB via multipart/form-data
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20 * 1024 * 1024; // 20 MB
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// <- adiciona essas duas
builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());
builder.Services.AddAWSService<IAmazonS3>();

var connectionString = "Server=localhost;Database=ProcessoVacuo;Uid=root;Pwd=;";
builder.Services.AddScoped<MySqlConnection>(_ => new MySqlConnection(connectionString));

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowAll");
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "API rodando!", timestamp = DateTime.UtcNow }));

app.Run("http://0.0.0.0:5000");