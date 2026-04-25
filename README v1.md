código para o ESP32 no wokwi (de teste)
// =============================================
//  SISTEMA DE VÁCUO - ESP32
//  Envia dados via Serial (USB) em formato JSON
// =============================================

#include <ESP32Servo.h>
#include <ArduinoJson.h>  // Instale pelo Library Manager

// --- PINOS ---
#define PINO_SENSOR_PRESSAO  34   // Analógico (ADC) - MPX5700DP
#define PINO_SERVO           18   // PWM - Servo MG996R
#define PINO_VALVULA         26   // Relay - Válvula Solenóide
#define PINO_BOMBA           27   // Relay - Mini Bomba 12V

// --- CONFIGURAÇÕES ---
#define INTERVALO_LEITURA    500  // Envia dados a cada 500ms
#define PRESSAO_MINIMA       20.0 // kPa - abaixo disso, desliga tudo (segurança)
#define PRESSAO_ALVO         50.0 // kPa - pressão que o sistema tenta manter

Servo servoValvula;
unsigned long ultimaLeitura = 0;

// Estado dos componentes
bool bombaLigada   = false;
bool valvulaAberta = false;

void setup() {
  Serial.begin(115200);  // Velocidade de comunicação com o PC

  // Configura os pinos de relay como saída
  pinMode(PINO_VALVULA, OUTPUT);
  pinMode(PINO_BOMBA,   OUTPUT);

  // Relay normalmente é ATIVO BAIXO (LOW = ligado)
  // Começa com tudo DESLIGADO por segurança
  digitalWrite(PINO_VALVULA, HIGH);
  digitalWrite(PINO_BOMBA,   HIGH);

  // Configura o servo
  servoValvula.attach(PINO_SERVO);
  servoValvula.write(0); // Começa fechado

  Serial.println("Sistema iniciado.");
}

void loop() {
  // --- LEITURA DE COMANDOS VINDOS DO PC ---
  // O C# pode mandar comandos pelo Serial pra controlar a bomba/válvula
  if (Serial.available() > 0) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();
    processarComando(comando);
  }

  // --- ENVIO DE DADOS A CADA INTERVALO ---
  if (millis() - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = millis();

    float pressao = lerPressao();
    int anguloServo = servoValvula.read();

    // Lógica de segurança automática
    if (pressao < PRESSAO_MINIMA) {
      desligarTudo();
    }

    // Monta o JSON e envia pelo Serial
    // Ex: {"pressao":65.2,"bomba":true,"valvula":false,"servo":90}
    StaticJsonDocument<128> doc;
    doc["pressao"] = pressao;
    doc["bomba"]   = bombaLigada;
    doc["valvula"] = valvulaAberta;
    doc["servo"]   = anguloServo;

    serializeJson(doc, Serial);
    Serial.println(); // Quebra de linha = sinal de fim de mensagem pro C#
  }
}

// =============================================
//  LÊ O SENSOR MPX5700DP E CONVERTE PARA kPa
// =============================================
// ATENÇÃO: O MPX5700DP opera com 5V mas o ESP32 lê até 3.3V.
// Use um divisor de tensão (resistores 10kΩ e 20kΩ) no fio de sinal!
// Fórmula do datasheet: Vout = Vs * (0.0018 * P + 0.04)
// Isolando P:          P = (Vout/Vs - 0.04) / 0.0018
float lerPressao() {
  int leituraBruta = analogRead(PINO_SENSOR_PRESSAO); // 0 a 4095

  // Converte leitura para tensão (0 a 3.3V na entrada do ESP)
  // O divisor de tensão escala 4.7V → 3.3V, então Vs efetivo é proporcional
  float vout = (leituraBruta / 4095.0) * 3.3;

  // Tensão de alimentação do sensor (5V)
  float vs = 5.0;

  // Escala o vout de volta para o range real do sensor (3.3V → 4.7V max)
  float voutReal = vout * (4.7 / 3.3);

  // Aplica a fórmula do datasheet para obter pressão em kPa
  float pressao = (voutReal / vs - 0.04) / 0.0018;

  // Limita ao range do sensor (0–700 kPa) por segurança
  pressao = constrain(pressao, 0.0, 700.0);

  return pressao;
}

// =============================================
//  PROCESSA COMANDOS RECEBIDOS DO PC (C#)
//  Formato esperado: "bomba:on", "bomba:off",
//  "valvula:on", "valvula:off", "servo:90"
// =============================================
void processarComando(String cmd) {
  if (cmd == "bomba:on") {
    bombaLigada = true;
    digitalWrite(PINO_BOMBA, LOW); // LOW = ligado (relay ativo baixo)

  } else if (cmd == "bomba:off") {
    bombaLigada = false;
    digitalWrite(PINO_BOMBA, HIGH);

  } else if (cmd == "valvula:on") {
    valvulaAberta = true;
    digitalWrite(PINO_VALVULA, LOW);
    servoValvula.write(90); // Abre o servo junto

  } else if (cmd == "valvula:off") {
    valvulaAberta = false;
    digitalWrite(PINO_VALVULA, HIGH);
    servoValvula.write(0); // Fecha o servo junto

  } else if (cmd.startsWith("servo:")) {
    // Controle manual do servo: "servo:45" move para 45 graus
    int angulo = cmd.substring(6).toInt();
    angulo = constrain(angulo, 0, 180);
    servoValvula.write(angulo);
  }
}

void desligarTudo() {
  bombaLigada   = false;
  valvulaAberta = false;
  digitalWrite(PINO_BOMBA,   HIGH);
  digitalWrite(PINO_VALVULA, HIGH);
  servoValvula.write(0);
}

diagram (wokwi)
{
  "version": 1,
  "author": "Claude",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": 120, "left": 0, "attrs": {} },
    {
      "type": "wokwi-servo",
      "id": "servo1",
      "top": -2,
      "left": 403.2,
      "attrs": { "horn": "cross" }
    },
    {
      "type": "wokwi-potentiometer",
      "id": "pot1",
      "top": 142.7,
      "left": 431.8,
      "attrs": { "label": "MPX5700DP (Pressão)" }
    },
    {
      "type": "wokwi-relay-module",
      "id": "relay_valve",
      "top": 300,
      "left": 380,
      "attrs": { "label": "Válvula" }
    },
    {
      "type": "wokwi-relay-module",
      "id": "relay_pump",
      "top": 420,
      "left": 380,
      "attrs": { "label": "Bomba 12V" }
    }
  ],
  "connections": [
    [ "esp:3V3", "pot1:VCC", "red", [] ],
    [ "esp:GND.2", "pot1:GND", "black", [] ],
    [ "esp:34", "pot1:SIG", "green", [] ],
    [ "esp:3V3", "servo1:V+", "red", [] ],
    [ "esp:GND.1", "servo1:GND", "black", [] ],
    [ "esp:18", "servo1:PWM", "yellow", [] ],
    [ "esp:3V3", "relay_valve:VCC", "red", [] ],
    [ "esp:GND.2", "relay_valve:GND", "black", [] ],
    [ "esp:26", "relay_valve:IN", "orange", [] ],
    [ "esp:3V3", "relay_pump:VCC", "red", [] ],
    [ "esp:GND.2", "relay_pump:GND", "black", [] ],
    [ "esp:27", "relay_pump:IN", "purple", [] ]
  ],
  "dependencies": {}
}

libraries.txt
