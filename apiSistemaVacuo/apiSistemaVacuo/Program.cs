using MySql.Data.MySqlClient;
using System.Collections.Generic;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// --- ADICIONA SERVIÇOS ---
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// --- CONEXÃO MYSQL ---
var connectionString = "Server=localhost;Database=ProcessoVacuo;Uid=root;Pwd=;";
builder.Services.AddScoped<MySqlConnection>(_ => new MySqlConnection(connectionString));

var app = builder.Build();

// --- MIDDLEWARE ---
app.UseRouting();
app.UseCors("AllowAll");

app.MapControllers();

// --- HEALTH CHECK ---
app.MapGet("/health", () => Results.Ok(new { status = "API rodando!", timestamp = DateTime.UtcNow }));

app.Run("http://0.0.0.0:5000");