#include <WiFiS3.h>
#include <WiFiSSLClient.h>

/* ================= PIN DEFINITIONS ================= */
#define ESP_CMD_PIN     8
#define RELAY_PIN       5

#define RED_LED_PIN     4
#define GREEN_LED_PIN   3
#define YELLOW_LED_PIN  6
#define BUZZER_PIN      9

/* ================= BUZZER ================= */
unsigned long buzzerStartTime = 0;
const unsigned long buzzerDuration = 3000;
bool buzzerActive = false;

/* ================= WIFI ================= */
const char* ssid = "Allen's Vivo Y56-5G";
const char* password = "allen2209";

/* ================= GOOGLE SHEETS ================= */
const char* sheetHost = "script.google.com";
const char* sheetPath =
"/macros/s/AKfycbwOVTW9b6wLylijXze8u2St55PlvSTR1jQkRKt0oLgSjnD2OaLvvbKoSCsdgOUTOxw/exec";

/* ================= LOGGING ================= */
String latestData = "";
unsigned long lastSheetSend = 0;
const unsigned long sheetInterval = 20000;

/* ================================================== */
void setup()
{
  pinMode(ESP_CMD_PIN, INPUT_PULLDOWN);
  pinMode(RELAY_PIN, OUTPUT);

  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(YELLOW_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  digitalWrite(RED_LED_PIN, HIGH);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(YELLOW_LED_PIN, HIGH);

  Serial.begin(115200);
  Serial1.begin(9600);

  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nUNO R4 WiFi Connected");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

/* ================================================== */
void loop()
{
  /* ===== DEBUG ===== */
  Serial.print("ESP_CMD_PIN = ");
  Serial.println(digitalRead(ESP_CMD_PIN));

  /* ===== RELAY + BUZZER ===== */
  if (digitalRead(ESP_CMD_PIN) == HIGH)
  {
    // Relay ON
    digitalWrite(RELAY_PIN, LOW);

    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(YELLOW_LED_PIN, LOW);

    digitalWrite(BUZZER_PIN, LOW);
    buzzerActive = false;
  }
  else
  {
    // Relay OFF
    digitalWrite(RELAY_PIN, HIGH);

    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(YELLOW_LED_PIN, HIGH);

    if (!buzzerActive)
    {
      digitalWrite(BUZZER_PIN, HIGH);
      buzzerStartTime = millis();
      buzzerActive = true;
    }
  }

  if (buzzerActive && millis() - buzzerStartTime >= buzzerDuration)
  {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerActive = false;
  }

  /* ===== READ FROM ESP32 ===== */
  if (Serial1.available())
  {
    latestData = Serial1.readStringUntil('\n');
    latestData.trim();

    if (latestData.startsWith("V="))
    {
      Serial.println("ESP32 DATA:");
      Serial.println(latestData);
    }
    else
    {
      latestData = "";
    }
  }

  /* ===== SEND TO GOOGLE SHEETS ===== */
  if (!latestData.isEmpty() &&
      millis() - lastSheetSend >= sheetInterval)
  {
    lastSheetSend = millis();
    sendToGoogleSheets(latestData);
  }

  delay(100);
}

/* ================================================== */
void sendToGoogleSheets(String data)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected");
    return;
  }

  data.replace(",", "&");

  WiFiSSLClient client;

  if (!client.connect(sheetHost, 443))
  {
    Serial.println("SSL connection failed");
    return;
  }

  client.print(
    String("GET ") + sheetPath + "?" + data + " HTTP/1.1\r\n" +
    "Host: " + sheetHost + "\r\n" +
    "Connection: close\r\n\r\n"
  );

  while (client.connected())
  {
    while (client.available())
    {
      client.read();
    }
  }

  client.stop();

  Serial.println("Data logged to Google Sheets");
}