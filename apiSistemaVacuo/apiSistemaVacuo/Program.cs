using MySql.Data.MySqlClient;
using Amazon.S3;
using Amazon.Runtime;
using SistemaVacuoAPI.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20 * 1024 * 1024;
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

// Credenciais explícitas do Learning Lab
var awsCredentials = new SessionAWSCredentials(
    builder.Configuration["AWS:AccessKey"],
    builder.Configuration["AWS:SecretKey"],
    builder.Configuration["AWS:SessionToken"]
);

builder.Services.AddSingleton<IAmazonS3>(new AmazonS3Client(
    awsCredentials,
    Amazon.RegionEndpoint.GetBySystemName(builder.Configuration["AWS:Region"])
));

var connectionString = "Server=localhost;Database=ProcessoVacuo;Uid=root;Pwd=;";
builder.Services.AddScoped<MySqlConnection>(_ => new MySqlConnection(connectionString));

// Serviço de email
builder.Services.AddScoped<EmailService>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseCors("AllowAll");
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "API rodando!", timestamp = DateTime.UtcNow }));

app.Run("http://0.0.0.0:5000");