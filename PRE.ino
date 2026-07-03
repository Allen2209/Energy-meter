/************************************************************
 * ESP32 PREPAID ENERGY METER – FINAL STABLE CODE
 * OLED + TFT + Web + Firebase + UNO relay
 * LOGIC FIXED – ORIGINAL RULES PRESERVED
 ************************************************************/

#include <PZEM004Tv30.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_ST7735.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <ESP.h>
#include <PubSubClient.h>

/* ================= OLED ================= */
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

/* ================= TFT ================= */
#define TFT_CS   5
#define TFT_DC   2
#define TFT_RST  4
Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);

/* ================= WIFI ================= */
const char* ssid = "Allen_Allen";
const char* password = "allen2209";

#define UNO_RELAY_CTRL_PIN 27

/* ================= MQTT ================= */
const char* mqtt_server = "broker.emqx.io";
WiFiClient espClient;
PubSubClient mqttClient(espClient);

const char* topic_telemetry = "allen/energy/live";
const char* topic_status = "allen/energy/status";
const char* topic_control = "allen/energy/control";

bool manualMode = false;
bool manualRelayState = false;

void mqttCallback(char* topic, byte* payload, unsigned int length)
{
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  if (String(topic) == topic_control)
  {
    if (msg == "ON") {
      manualMode = true;
      manualRelayState = true;
      digitalWrite(UNO_RELAY_CTRL_PIN, HIGH);
    }
    else if (msg == "OFF") {
      manualMode = true;
      manualRelayState = false;
      digitalWrite(UNO_RELAY_CTRL_PIN, LOW);
    }
    else if (msg == "AUTO") {
      manualMode = false;
    }
  }
}

void reconnectMQTT()
{
  while (!mqttClient.connected())
  {
    if (mqttClient.connect("ESP32_Prepaid_Meter","","",topic_status,1,true,"offline"))
    {
      mqttClient.publish(topic_status,"online",true);
      mqttClient.subscribe(topic_control);
    }
    else
    {
      delay(5000);
    }
  }
}



/* ================= PZEM ================= */
#define PZEM_RX_PIN 25
#define PZEM_TX_PIN 26
PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

/* ================= RELAY ================= */
#define RELAY_PIN 4
#define UNO_RELAY_CTRL_PIN 27

/* ================= ESP32 → UNO SERIAL ================= */
#define UNO_RX_PIN 16
#define UNO_TX_PIN 17

/* ================= EEPROM ================= */
#define EEPROM_SIZE 128
#define BALANCE_ADDR 0
#define ENERGY_ADDR 4

/* ================= WEB ================= */
WebServer server(80);
const char* admin_username = "admin";
const char* admin_password = "admin123";

/* ================= VARIABLES ================= */
float voltage = 0, current = 0, power = 0, energy = 0;
float balance = 100.0;
float lastEnergy = 0;

bool relayState = false;
bool faultDetected = false;
bool theftDetected = false;

/* ================= THRESHOLDS ================= */
float overVoltageThreshold = 260.0;
float overCurrentThreshold = 10.0;
float theftCurrentThreshold = 0.02;
float minimumBalance = 1.0;
float costPerKWh = 0.2;

/* ================= TIMERS ================= */
unsigned long lastRead = 0;
unsigned long lastMQTT = 0;

/* ================= RUNNING TEXT ================= */
int runX = 160;
int runIndex = 0;
bool holdText = false;
unsigned long scrollTimer = 0;
unsigned long holdTimer = 0;

const unsigned long scrollSpeed = 18;
const unsigned long holdTime = 1000;

/* ===================================================== */

void setup() {
  Serial.begin(115200);
  Serial1.begin(9600, SERIAL_8N1, UNO_RX_PIN, UNO_TX_PIN);

  EEPROM.begin(EEPROM_SIZE);
  loadBalance();

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(UNO_RELAY_CTRL_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(UNO_RELAY_CTRL_PIN, LOW);

  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  display.clearDisplay();
  display.display();

  SPI.begin(18, -1, 23, TFT_CS);
  tft.initR(INITR_MINI160x80);
  tft.setRotation(1);
  tft.fillScreen(ST77XX_BLACK);

  WiFi.begin(ssid, password);
  Serial.print("[WIFI] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected");

  mqttClient.setServer(mqtt_server, 1883);
  mqttClient.setCallback(mqttCallback);
  Serial.println("[MQTT] Broker Configured");

  server.on("/data", HTTP_GET, handleData);
  server.begin();

  Serial.println("[SYSTEM] Setup complete");
}

/* ===================================================== */

void loop() {

  server.handleClient();

  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  /* ===== SENSOR + LOGIC UPDATE (EVERY 2s) ===== */
  if (millis() - lastRead > 2000) {
    lastRead = millis();

    voltage = isnan(pzem.voltage()) ? 0 : pzem.voltage();
    current = isnan(pzem.current()) ? 0 : pzem.current();
    power   = isnan(pzem.power())   ? 0 : pzem.power();
    energy  = isnan(pzem.energy())  ? 0 : pzem.energy();

    float used = energy - lastEnergy;
    if (used > 0) {
      balance -= used * costPerKWh;
      if (balance < 0) balance = 0;
      lastEnergy = energy;
      saveBalance();
    }

    faultDetected = (voltage > overVoltageThreshold ||
                     current > overCurrentThreshold);

    bool shouldRelayBeOn = (!faultDetected && balance > minimumBalance);
    theftDetected = (!shouldRelayBeOn && current > theftCurrentThreshold);
    relayState = (shouldRelayBeOn && !theftDetected);

    if(manualMode)
    {
      relayState = manualRelayState;
    }

    digitalWrite(UNO_RELAY_CTRL_PIN, relayState ? HIGH : LOW);

    /* ===== SERIAL MONITOR READINGS (RESTORED) ===== */
    Serial.println("========== ENERGY METER ==========");
    Serial.print("Voltage : "); Serial.print(voltage); Serial.println(" V");
    Serial.print("Current : "); Serial.print(current); Serial.println(" A");
    Serial.print("Power   : "); Serial.print(power);   Serial.println(" W");
    Serial.print("Energy  : "); Serial.print(energy);  Serial.println(" kWh");
    Serial.print("Balance : "); Serial.println(balance);
    Serial.print("Relay   : "); Serial.println(relayState ? "ON" : "OFF");
    Serial.print("Fault   : "); Serial.println(faultDetected ? "YES" : "NO");
    Serial.print("Theft   : "); Serial.println(theftDetected ? "YES" : "NO");
    Serial.println("==================================");

    sendDataToUno();
  }

  /* ===== MQTT UPDATE ===== */
  if (millis() - lastMQTT > 5000) {
    lastMQTT = millis();
    publishMQTT();
  }

  /* ===== DISPLAY ANIMATION (CONTINUOUS) ===== */
  updateOLED();
}

/* ================= DISPLAY UPDATE ================= */
void updateOLED() {

  unsigned long now = millis();

  String text;
  switch (runIndex) {
    case 0: text = "V = " + String(voltage,1) + " V"; break;
    case 1: text = "I = " + String(current,2) + " A"; break;
    case 2: text = "P = " + String(power,0) + " W"; break;
    case 3: text = "E = " + String(energy,2) + " kWh"; break;
    case 4: text = "BAL = " + String(balance,1); break;
  }

  if (!holdText && now - scrollTimer > scrollSpeed) {
    scrollTimer = now;
    runX--;
    if (runX <= 40) {
      holdText = true;
      holdTimer = now;
    }
  }

  if (holdText && now - holdTimer > holdTime) {
    holdText = false;
    runX = 160;
    runIndex = (runIndex + 1) % 5;
  }

  tft.fillScreen(ST77XX_BLACK);

  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(30, 5);
  tft.print("PREPAID ENERGY");

  tft.setTextSize(2);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(runX, 32);
  tft.print(text);

  tft.setTextSize(1);
  tft.setCursor(5, 65);
  tft.setTextColor(relayState ? ST77XX_GREEN : ST77XX_RED);
  tft.print(relayState ? "ON" : "OFF");

  if (faultDetected) {
    tft.setCursor(130, 65);
    tft.setTextColor(ST77XX_RED);
    tft.print("F");
  }
  if (theftDetected) {
    tft.setCursor(145, 65);
    tft.setTextColor(ST77XX_ORANGE);
    tft.print("T");
  }
}

/* ================= SEND DATA TO UNO ================= */
void sendDataToUno() {
  Serial1.print("V="); Serial1.print(voltage,1);
  Serial1.print(",I="); Serial1.print(current,2);
  Serial1.print(",P="); Serial1.print(power,0);
  Serial1.print(",E="); Serial1.print(energy,2);
  Serial1.print(",B="); Serial1.print(balance,1);
  Serial1.print(",R="); Serial1.print(relayState);
  Serial1.print(",F="); Serial1.print(faultDetected);
  Serial1.print(",T="); Serial1.print(theftDetected);
  Serial1.println();
}

/* ================= FIREBASE ================= */


/* ================= EEPROM ================= */
void saveBalance() {
  EEPROM.writeFloat(BALANCE_ADDR, balance);
  EEPROM.writeFloat(ENERGY_ADDR, lastEnergy);
  EEPROM.commit();
}

void loadBalance() {
  balance = EEPROM.readFloat(BALANCE_ADDR);
  lastEnergy = EEPROM.readFloat(ENERGY_ADDR);
  if (isnan(balance) || balance < 10) balance = 100;
}

/* ================= WEB ================= */
void handleData() {
  if (!server.authenticate(admin_username, admin_password)) {
    server.send(401, "Unauthorized");
    return;
  }

  DynamicJsonDocument doc(512);
  doc["voltage"] = voltage;
  doc["current"] = current;
  doc["power"] = power;
  doc["energy"] = energy;
  doc["balance"] = balance;
  doc["relayState"] = relayState;
  doc["faultDetected"] = faultDetected;
  doc["theftDetected"] = theftDetected;

  String res;
  serializeJson(doc, res);
  server.send(200, "application/json", res);
}

void publishMQTT() {
  if(!mqttClient.connected()) return;
  DynamicJsonDocument doc(512);
  doc["voltage"]=voltage;
  doc["current"]=current;
  doc["power"]=power;
  doc["energy"]=energy;
  doc["balance"]=balance;
  doc["relayState"]=relayState;
  doc["faultDetected"]=faultDetected;
  doc["theftDetected"]=theftDetected;
  String payload;
  serializeJson(doc,payload);
  mqttClient.publish(topic_telemetry, payload.c_str(), true);

  Serial.println("[MQTT] Connecting...");

if (mqttClient.connect("ESP32_Prepaid_Meter","","",topic_status,1,true,"offline"))
{
    Serial.println("[MQTT] Connected");
    mqttClient.publish(topic_status,"online",true);
      mqttClient.subscribe(topic_control);
}
else
{
    Serial.print("[MQTT] Failed: ");
    Serial.println(mqttClient.state());
}
Serial.println("Publishing MQTT:");
Serial.println(payload);
}
