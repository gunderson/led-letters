#include <WiFi.h>
#include <AsyncUDP.h>
#include <WiFiUdp.h>
#include <ESPmDNS.h>
#include <OSCMessage.h>
#include <OSCBundle.h>

#include <FastLED.h>

// ------------------------------------------------------------------------
// LEDs

// 37+73+84
#define NUM_LEDS 194

#define LED_BUILTIN 2

#define DATA_PIN 27
#define CLOCK_PIN 25

#define MODE_BUTTON_PIN 23
#define DIAL_1_PIN 32
#define DIAL_2_PIN 33

// #define LED_BUILTIN 2


// #define DATA_PIN 17
// #define CLOCK_PIN 16

// #define MODE_BUTTON_PIN 19
// #define DIAL_1_PIN 18
// #define DIAL_2_PIN 5


#define COLOR_ORDER BGR
#define CHIPSET SK9822

// Define the array of leds
CRGB leds[NUM_LEDS];
const int colorBufferSize = NUM_LEDS * 3;
uint8_t colorBuffer[colorBufferSize];

// ------------------------------------------------------------------------
// VARIABLES

unsigned long startTime = 0;  // Initialize the timer variable

int fps = 30;
float frameDuration = 1000 / fps;

unsigned long clockTime = 0;
long lastFrameTime = 0;
long frameCount = 0;

char lastModeButtonState = HIGH;
int pressStart = 0;
byte mode = 0;
byte numModes = 5;

int dial1Value = 0;
int dial2Value = 0;

// ------------------------------------------------------------------------
// WIFI + OSC

const char* ssid = "G7";
const char* password = "1234qwerasdfzxcv";
const String serverName = "light-server";
const String serverDNS = serverName + ".local";
int serverPort = 57120;
int localPort = 57150;
IPAddress serverIp;

AsyncUDP udp;

OSCMessage messageBuffer[128];
uint8_t messageBufferReadIndex = 0;
uint8_t messageBufferWriteIndex = 0;
uint8_t messageBufferLength = 128;
int bufferTime = 100;

OSCMessage outgoingMessage;
OSCMessage incomingMessage;

byte mac[6];
char mdnsName[20];  // Assuming a maximum length of 20 characters for the mDNS name

// ------------------------------------------------------------------------
// SETUP

void setup() {

  startTime = millis();
  pinMode(LED_BUILTIN, OUTPUT);

  // LED_BUILTIN;

  pinMode(MODE_BUTTON_PIN, INPUT_PULLUP);
  pinMode(DIAL_1_PIN, INPUT_PULLDOWN);
  //  pinMode(DIAL_2_PIN, INPUT_PULLDOWN);

  Serial.begin(921600);
  Serial.println("resetting");
  FastLED.addLeds<CHIPSET, DATA_PIN, CLOCK_PIN, COLOR_ORDER>(leds, NUM_LEDS);  // BGR ordering is typical
  FastLED.setBrightness(255);

  WiFi.macAddress(mac);
  snprintf(mdnsName, sizeof(mdnsName), "light-fixture-%02X%02X", mac[4], mac[5]);

  Serial.printf("MDNS Address: %s\n", mdnsName);

  connectToWifi();
}

// ------------------------------------------------------------------------
// WIFI

void connectToWifi() {
  int retries = 0;
  int MAX_RETRIES = 50;
  bool connected = false;
  WiFi.begin(ssid, password);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  while (WiFi.status() != WL_CONNECTED && retries < MAX_RETRIES) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    // REPORT!!
    Serial.println("---------------");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());

    Serial.println("Starting UDP");
    if (!udp.listen(localPort)) {
      Serial.println("Error starting UDP server.");
    }
    udp.onPacket(onPacket);

    Serial.print("Local port: ");
    Serial.println(localPort);
    Serial.println("---------------");

    startMDNS();
  } else {
    Serial.println("ERROR: Could not connect to WiFi");
  }
}

// ------------------------------------------------------------------------
// MDNS

void startMDNS() {
  // while (mdns_init() != ESP_OK) {
  //   delay(1000);
  //   Serial.println("Starting MDNS...");
  // }

  if (MDNS.begin(mdnsName)) {  // Replace with a unique name for each fixture
    Serial.printf("mDNS started with name: %s.local\n", mdnsName);
    MDNS.addService("osc", "udp", serverPort);
    Serial.println("mDNS started");
  } else {
    Serial.println("Error starting mDNS");
  }

  int nrOfServices = MDNS.queryService("osc", "udp");

  if (nrOfServices == 0) {
    Serial.println("No services were found.");
    return;
  } else {
    Serial.printf("found %d services\n", nrOfServices);
  }

  for (int i = 0; i < nrOfServices; i = i + 1) {
    Serial.println(MDNS.hostname(i));
    if (strcmp(MDNS.hostname(i).c_str(), serverName.c_str()) == 0) {
      serverPort = MDNS.port(i);
      serverIp = MDNS.IP(i);

      // REPORT!!
      Serial.println("OSC/UDP service found !!!!!");
      Serial.println("---------------");
      Serial.print("Hostname: ");
      Serial.println(MDNS.hostname(i));
      Serial.print("IP address: ");
      Serial.println(MDNS.IP(i));
      Serial.print("Port: ");
      Serial.println(MDNS.port(i));
      Serial.println("---------------");

      // attempt to connect
      sendConnectionNotice();
      MDNS.end();
      return;
    }
  }
}
// ------------------------------------------------------------------------
// Timing

struct FrameTime {
  uint8_t hours;
  uint8_t minutes;
  uint8_t seconds;
  uint8_t frames;

  void parse(uint timecode){
    frames  = (timecode) & 0xff;
    seconds = (timecode >> 8) & 0xff;
    minutes = (timecode >> 16) & 0xff;
    hours   = (timecode >> 24) & 0xff;
  }

  unsigned long toMillis(int fps){
    float millisPerFrame = 1000 / fps;
    double totalSeconds = hours * 60 * 60;
    totalSeconds += minutes * 60;
    totalSeconds += seconds;
    unsigned long totalMillis = (totalSeconds * 1000) + (frames * millisPerFrame);
    return totalMillis;
  }

  unsigned long toframes(int fps){
    double totalSeconds = hours * 60 * 60;
    totalSeconds += minutes * 60;
    totalSeconds += seconds;
    unsigned long totalMillis = (totalSeconds * fps) + (frames);
    return totalMillis;
  }

  uint toTimecode(){
    return hours << 24 | minutes << 16 | seconds << 8 | frames;
  }

  String toString(){
    return String(hours) + ":" + String(minutes) + ":" + String(seconds) + ":" + String(frames);
  }

  uint toSMPTETimecode(){
    uint SMPTETimecode = 0;
    return SMPTETimecode;
  }
};

// ------------------------------------------------------------------------
// OSC MESSAGE HANDLING

long lastPacketTime = 0;

void onPacket(AsyncUDPPacket& packet) {
  long now = millis();
  long packetDelta = now - lastPacketTime;
  lastPacketTime = now;
  // Serial.printf("Packet Delta: %d\n", packetDelta);

  // fill the message from the packet
  messageBuffer[messageBufferWriteIndex].fill(packet.data(), packet.length());

  if (!messageBuffer[messageBufferWriteIndex].hasError()) {
    // don't buffer these events
    if (messageBuffer[messageBufferReadIndex].dispatch("/setSyncTime", onSetUniversalSyncTimeCode)){
      return;
    }
    if (messageBuffer[messageBufferReadIndex].dispatch("/sync", onSync)){
      return;
    }
    //advance the write buffer
    messageBufferWriteIndex = (messageBufferWriteIndex + 1) % messageBufferLength;
  } else {
    messageBuffer[messageBufferWriteIndex].empty();
    Serial.println("incoming message error");
  }
}

// timecode is a 32-bit integer, 4-bytes that encode hh:mm:ss:ff

uint universalSyncTimeMillis = 0;
FrameTime universalSyncTime;
void onSetUniversalSyncTimeCode(OSCMessage &msg) {
  uint universalSyncTimeCode = msg.getInt(0);
  fps = msg.getInt(1);
  universalSyncTime.parse(universalSyncTimeCode);
  universalSyncTimeMillis = universalSyncTime.toMillis(fps);
  msg.empty();
  return;
}

void onSync(OSCMessage &msg){
  startTime = millis();
  msg.empty();
  return;
}

void onLed(OSCMessage &msg) {
  unsigned int ledState = LOW;
  uint timecode = msg.getInt(0);
  FrameTime ft = {0,0,0,0};
  ft.parse(timecode);
  ledState = msg.getInt(1);
  digitalWrite(LED_BUILTIN, ledState);
  msg.empty();
  return;
}

void onPixelColors(OSCMessage &msg) {
  uint timecode = msg.getInt(0);
  FrameTime ft = {0,0,0,0};
  ft.parse(timecode);
  // Serial.printf("type of blob: %d\n", msg.getType(1));
  // Serial.printf("message size: %d\n", msg.getBlobLength(1));
  
  int numCopied = msg.getBlob(1, colorBuffer, colorBufferSize, 0, colorBufferSize);
  // Serial.printf("--colorBuffer length: %d\n", sizeof(colorBuffer));
  // Serial.printf("Copied %d entries\n", numCopied);
  mode = 255;
// Serial.print("/pixelColors: ");
// Serial.printf("%d:%d:%d\n", colorBuffer[0],colorBuffer[1],colorBuffer[2]);

  msg.empty();
  return;
}

void sendConnectionNotice() {
  OSCMessage message("/light-fixture-info");
  message.add(mdnsName);
  message.add(WiFi.localIP().toString().c_str());
  message.add(localPort);
  message.add(NUM_LEDS);
  AsyncUDPMessage outUDPMsg;
  message.send(outUDPMsg);

  // check if we sent something (sentData is number of data elements sent)
  size_t sentData = udp.sendTo(outUDPMsg, serverIp, serverPort);

  if (sentData < 1) {
    Serial.print("/light-fixture-info: sent no osc data to IP: ");
    Serial.println(serverIp);
  }
  message.empty();
}

// ------------------------------------------------------------------------
// LOOP HANDLING

void loop() {
  // Calculate the elapsed time since the start
  uint localTime = millis() - startTime;
  uint universalTime = universalSyncTimeMillis + localTime;
  uint bufferedTime = universalTime - bufferTime;


  if (messageBufferReadIndex != messageBufferWriteIndex){
    // timecode is in the bitmasked format hhhhmmmmssssffff
    // get timecode
    uint messageTimecode = messageBuffer[messageBufferReadIndex].getInt(0);

    FrameTime messageTime = {0,0,0,0};
    messageTime.parse(messageTimecode);

    // Serial.printf("bufferedTime:           %d\n",bufferedTime);
    // Serial.printf("next message scheduled: %d\n",messageTime.toMillis(fps));

    if (bufferedTime >= messageTime.toMillis(fps)){
      // Serial.print("Executing Message Index: ");
      // Serial.println(messageBufferReadIndex);
      // Serial.print("message size: ");
      // Serial.println(messageBuffer[messageBufferReadIndex].size());
      //parse message
      messageBuffer[messageBufferReadIndex].dispatch("/led", onLed);
      messageBuffer[messageBufferReadIndex].dispatch("/pixelColors", onPixelColors);
      
      //advance mesage buffer
      messageBufferReadIndex = (messageBufferReadIndex + 1) % messageBufferLength;
    }
  } else {
    // Serial.println("current read index size is zero.");
  }

  // update();

  if (localTime >= lastFrameTime + frameDuration) {
    frameCount++;
    lastFrameTime = localTime;
    draw();
  }
}

void update() {

  // check inputs
  dial1Value = analogRead(DIAL_1_PIN);
  //  dial2Value = analogRead(DIAL_2_PIN);

  // mode button
  byte modeButtonState = digitalRead(MODE_BUTTON_PIN);
  if (modeButtonState != lastModeButtonState) {
    if (modeButtonState == HIGH) {
      // advance mode
      if (++mode >= numModes) mode = 0;
    }
    lastModeButtonState = modeButtonState;
  }

  // Serial.print("mode:");
  // Serial.print(mode);
  // Serial.print(",dial_1:");
  // Serial.println(dial1Value);
  // Serial.print(",dial_2:");
  // Serial.println(dial2Value);
}

void draw() {
  switch (mode) {
    case 0:
      cylon(frameCount, NUM_LEDS);
      break;
    case 1:
      // Yellow
      FastLED.showColor(CRGB(255, 255, 0));
      break;
    case 2:
      // Cyan
      FastLED.showColor(CRGB(0, 255, 255));
      break;
    case 3:
      // Magenta
      FastLED.showColor(CRGB(255, 0, 255));
      break;
    case 4:
      // Black
      FastLED.showColor(CRGB(180, 180, 180));
      break;
    case 255:
      // draw what is in the buffer
      drawFromBuffer();
      break;
    default:
      // Red
      FastLED.showColor(CRGB(255, 0, 0));
  }
}

// ------------------------------------------------------------------------
// DRAW MODES

uint8_t hue = 0;


void fadeall() {
  for (int i = 0; i < NUM_LEDS; i++) { leds[i].nscale8(250); }
}

void cylon(int frameIndex, int cycleLength) {
  int cyclePosition = frameIndex % (cycleLength * 2);
  char direction = cyclePosition < cycleLength ? 1 : -1;
  int pixelPosition = cyclePosition < cycleLength ? cyclePosition : cycleLength - (cyclePosition - cycleLength);
  hue = pixelPosition;
  fadeall();
  leds[pixelPosition] = CHSV(hue, 255, 255);
  FastLED.show();
}

void drawFromBuffer() {
  int pixelPosition = 0;
  // Serial.printf("colorBuffer length: %d\n", sizeof(colorBuffer));
  while (pixelPosition < NUM_LEDS) {
    int bytePosition = pixelPosition * 3;
    leds[pixelPosition].r = colorBuffer[bytePosition];
    leds[pixelPosition].g = colorBuffer[bytePosition + 1];
    leds[pixelPosition].b = colorBuffer[bytePosition + 2];
    pixelPosition++;
  }
  FastLED.show();
}
