Códigos do ESP32 (simulado no Wokwi)

sketch.ino:

---------
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ==========================================
//  CONFIGURAÇÕES DE REDE E API
// ==========================================
const char* SSID = "Wokwi-GUEST";
const char* PASSWORD = "";
const char* API_URL = "https://pj9njgnt-5000.brs.devtunnels.ms/api/leiturasSensores";

// ==========================================
//  MAPEAMENTO DE PINOS (Reflete o diagram.json)
// ==========================================
#define PINO_LED        2   // LED Vermelho de WiFi OK
#define PINO_POT_CAMARA 34
#define PINO_POT_TUBO1  35
#define PINO_POT_TUBO2  36
#define PINO_POT_TUBO3  39
#define PINO_SERVO      18
#define PINO_VALVULA    26
#define PINO_BOMBA      27

#define INTERVALO_LEITURA 2000

Servo meuServo;
unsigned long ultimaLeitura = 0;
unsigned long cicloId = 1;

// Variáveis de Estado
bool bombaLigada = false;
bool valvulaAberta = false;
bool maquinaLigada = true;
int servoAngulo = 0;

void setup() {
  Serial.begin(115200);

  // 1. Configuração dos Pinos de Saída
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_BOMBA, OUTPUT);
  pinMode(PINO_VALVULA, OUTPUT);
  
  // Inicia com tudo desligado (Relés geralmente desligam em HIGH)
  digitalWrite(PINO_BOMBA, HIGH);
  digitalWrite(PINO_VALVULA, HIGH);
  digitalWrite(PINO_LED, LOW);

  // 2. Inicializa Servo
  meuServo.attach(PINO_SERVO);
  meuServo.write(0);

  // 3. Conexão WiFi
  Serial.println("\n🌐 Conectando ao WiFi...");
  WiFi.begin(SSID, PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\n✅ WiFi Conectado!");
  digitalWrite(PINO_LED, HIGH); // Acende o LED pra avisar que a internet tá ON!
}

void loop() {
  if (millis() - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = millis();

    // Lendo as pressões dos 4 potenciômetros
    float pressaoCamara = lerPressao(PINO_POT_CAMARA);
    float pressaoTubo1  = lerPressao(PINO_POT_TUBO1);
    float pressaoTubo2  = lerPressao(PINO_POT_TUBO2);
    float pressaoTubo3  = lerPressao(PINO_POT_TUBO3);

    // Lógica de Segurança e Acionamento
    if (pressaoCamara < 20) {
      desligarTudo();
    } else {
      maquinaLigada = true;
      bombaLigada = (pressaoCamara > 100);
      valvulaAberta = (pressaoCamara > 500);
      
      digitalWrite(PINO_BOMBA, bombaLigada ? LOW : HIGH);
      digitalWrite(PINO_VALVULA, valvulaAberta ? LOW : HIGH);
      
      servoAngulo = map(analogRead(PINO_POT_CAMARA), 0, 4095, 0, 180);
      meuServo.write(servoAngulo);
    }

    // Calculando Fluxos (a mesma matemática que você fez)
    float fluxoTubo1 = calcularFluxo(pressaoCamara, pressaoTubo1);
    float fluxoTubo2 = calcularFluxo(pressaoCamara, pressaoTubo2);
    float fluxoTubo3 = calcularFluxo(pressaoCamara, pressaoTubo3);

    // Montando o JSON Completo para a sua API
    StaticJsonDocument<512> doc;
    // doc["cicloId"] = cicloId++;
    doc["estadoMaquina"] = maquinaLigada ? "Ligado" : "Desligado";
    doc["pressaoCamaraMbar"] = round(pressaoCamara * 100) / 100.0;
    doc["pressaoTubo1Mbar"] = round(pressaoTubo1 * 100) / 100.0;
    doc["fluxoTubo1LPM"] = round(fluxoTubo1 * 10) / 10.0;
    doc["pressaoTubo2Mbar"] = round(pressaoTubo2 * 100) / 100.0;
    doc["fluxoTubo2LPM"] = round(fluxoTubo2 * 10) / 10.0;
    doc["pressaoTubo3Mbar"] = round(pressaoTubo3 * 100) / 100.0;
    doc["fluxoTubo3LPM"] = round(fluxoTubo3 * 10) / 10.0;
    doc["bombaLigada"] = bombaLigada;
    doc["valvulaAberta"] = valvulaAberta;
    doc["servoAngulo"] = servoAngulo;

    String jsonString;
    serializeJson(doc, jsonString);
    Serial.println(jsonString);

    // Enviando para o Dev Tunnel
    enviarDados(jsonString);
  }
}

// ==========================================
//  FUNÇÕES AUXILIARES
// ==========================================

float lerPressao(int pino) {
  int leituraBruta = analogRead(pino);
  float pressao = (leituraBruta / 4095.0) * 1000.0;
  pressao = constrain(pressao, 0, 1000);
  pressao += (random(-5, 6) * 0.1); 
  return pressao;
}

float calcularFluxo(float pressaoFonte, float pressaoDestino) {
  float deltaPressao = abs(pressaoFonte - pressaoDestino);
  float fluxo = sqrt(deltaPressao) * 0.5;
  if (!bombaLigada) fluxo = 0;
  return fluxo;
}

void desligarTudo() {
  bombaLigada = false;
  valvulaAberta = false;
  maquinaLigada = false;
  servoAngulo = 0;
  digitalWrite(PINO_BOMBA, HIGH);
  digitalWrite(PINO_VALVULA, HIGH);
  meuServo.write(servoAngulo);
  Serial.println("\n⚠️ PARADO - Pressão crítica!");
}

void enviarDados(String json) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    
    // O pulo do gato pro Dev Tunnels:
    http.addHeader("X-Tunnel-Skip-Anti-Phishing-Page", "true"); 

    int code = http.POST(json);
    
    Serial.print("📤 Status API: ");
    if (code > 0) {
      Serial.println(code);
    } else {
      Serial.println(http.errorToString(code));
    }
    http.end();
  }
}
---------

diagram.json:

---------
{
  "version": 1,
  "author": "MARIA EDUARDA COIMBRA DE OLIVEIRA",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-devkit-c-v4", "id": "esp", "top": -96, "left": -14.36, "attrs": {} },
    { "type": "wokwi-servo", "id": "servo1", "top": 26.8, "left": 280, "attrs": {} },
    {
      "type": "wokwi-relay-module",
      "id": "relay_bomba",
      "top": 134.6,
      "left": 172.8,
      "attrs": { "label": "Bomba (Pin 27)" }
    },
    {
      "type": "wokwi-relay-module",
      "id": "relay_valvula",
      "top": 201.8,
      "left": 172.8,
      "attrs": { "label": "Válvula (Pin 26)" }
    },
    {
      "type": "wokwi-potentiometer",
      "id": "pot_camara",
      "top": -116.5,
      "left": 191.8,
      "attrs": { "label": "Câmara (34)" }
    },
    {
      "type": "wokwi-potentiometer",
      "id": "pot_tubo1",
      "top": -116.5,
      "left": 350,
      "attrs": { "label": "Tubo 1 (35)" }
    },
    {
      "type": "wokwi-potentiometer",
      "id": "pot_tubo2",
      "top": -116.5,
      "left": 489.4,
      "attrs": { "label": "Tubo 2 (36)" }
    },
    {
      "type": "wokwi-potentiometer",
      "id": "pot_tubo3",
      "top": -116.5,
      "left": 643,
      "attrs": { "label": "Tubo 3 (39)" }
    },
    {
      "type": "wokwi-led",
      "id": "led1",
      "top": -51.6,
      "left": -140.2,
      "attrs": { "color": "red", "label": "WiFi OK" }
    },
    {
      "type": "wokwi-resistor",
      "id": "r1",
      "top": 51.95,
      "left": -115.2,
      "attrs": { "value": "220" }
    }
  ],
  "connections": [
    [ "esp:TX", "$serialMonitor:RX", "", [] ],
    [ "esp:RX", "$serialMonitor:TX", "", [] ],
    [ "pot_camara:GND", "esp:GND.2", "black", [ "v0" ] ],
    [ "pot_camara:SIG", "esp:34", "green", [ "v0" ] ],
    [ "pot_camara:VCC", "esp:3V3", "red", [ "v0" ] ],
    [ "pot_tubo1:GND", "esp:GND.2", "black", [ "v0" ] ],
    [ "pot_tubo1:SIG", "esp:35", "green", [ "v0" ] ],
    [ "pot_tubo1:VCC", "esp:3V3", "red", [ "v0" ] ],
    [ "pot_tubo2:GND", "esp:GND.2", "black", [ "v0" ] ],
    [ "pot_tubo2:SIG", "esp:36", "green", [ "v0" ] ],
    [ "pot_tubo2:VCC", "esp:3V3", "red", [ "v0" ] ],
    [ "pot_tubo3:GND", "esp:GND.2", "black", [ "v0" ] ],
    [ "pot_tubo3:SIG", "esp:39", "green", [ "v0" ] ],
    [ "pot_tubo3:VCC", "esp:3V3", "red", [ "v0" ] ],
    [ "servo1:GND", "esp:GND.1", "black", [ "h0" ] ],
    [ "servo1:V+", "esp:5V", "red", [ "h0" ] ],
    [ "servo1:PWM", "esp:18", "orange", [ "h0" ] ],
    [ "relay_bomba:IN", "esp:27", "gold", [ "h0" ] ],
    [ "relay_valvula:IN", "esp:26", "blue", [ "h0" ] ],
    [ "relay_bomba:VCC", "esp:5V", "red", [ "h0" ] ],
    [ "relay_valvula:VCC", "esp:5V", "red", [ "h0" ] ],
    [ "relay_bomba:GND", "esp:GND.2", "black", [ "h0" ] ],
    [ "relay_valvula:GND", "esp:GND.2", "black", [ "h0" ] ],
    [ "esp:2", "led1:A", "green", [ "h0" ] ],
    [ "led1:C", "r1:1", "green", [ "v0" ] ],
    [ "r1:2", "esp:GND.2", "green", [ "v0" ] ]
  ],
  "dependencies": {}
}
---------

libraries.txt

---------
# Wokwi Library List
# See https://docs.wokwi.com/guides/libraries

ArduinoJson
HttpClient
ESP32Servo
---------