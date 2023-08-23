#include <FastLED.h>

// How many leds in your strip?
// 37+73+84
#define NUM_LEDS 194   



// For led chips like Neopixels, which have a data line, ground, and power, you just
// need to define DATA_PIN.  For led chipsets that are SPI based (four wires - data, clock,
// ground, and power), like the LPD8806, define both DATA_PIN and CLOCK_PIN
#define DATA_PIN 27
#define CLOCK_PIN 25

#define MODE_BUTTON_PIN 23
#define DIAL_1_PIN 32
#define DIAL_2_PIN 33


#define COLOR_ORDER BGR
#define CHIPSET     SK9822

// Define the array of leds
CRGB leds[NUM_LEDS];

void setup() { 

  pinMode(MODE_BUTTON_PIN, INPUT_PULLUP);
  pinMode(DIAL_1_PIN, INPUT_PULLDOWN);
//  pinMode(DIAL_2_PIN, INPUT_PULLDOWN);
  
	Serial.begin(57600);
	Serial.println("resetting");
  FastLED.addLeds<CHIPSET, DATA_PIN, CLOCK_PIN, COLOR_ORDER>(leds, NUM_LEDS);  // BGR ordering is typical
	FastLED.setBrightness(255);
}

void fadeall() { for(int i = 0; i < NUM_LEDS; i++) { leds[i].nscale8(250); } }

int frameDuration = 16;

int presentTime = 0;
int lastFrameTime = 0;
long frameCount = 0;

char lastModeButtonState = HIGH;
int pressStart = 0;
byte mode = 0;
byte numModes = 5;

int dial1Value = 0;
int dial2Value = 0;

void loop() {
  presentTime = millis();
  update();
  
  if (presentTime >= lastFrameTime + frameDuration){
    frameCount++;
    lastFrameTime = presentTime;
    draw();
  }
}

void update(){
  
  // check inputs
  dial1Value = analogRead(DIAL_1_PIN);
//  dial2Value = analogRead(DIAL_2_PIN);

  // mode button
  byte modeButtonState = digitalRead(MODE_BUTTON_PIN);
  if (modeButtonState != lastModeButtonState){
    if (modeButtonState == HIGH){
      // advance mode
      if (++mode >= numModes) mode = 0;
    }
    lastModeButtonState = modeButtonState;
  }

  Serial.print("mode:");
  Serial.print(mode);
  Serial.print(",dial_1:");
  Serial.println(dial1Value);
//  Serial.print(",dial_2:");
//  Serial.println(dial2Value);
}

void draw(){
  switch (mode) {
    case 0:
      cylon(frameCount, NUM_LEDS);
    break;
    case 1:
      // Yellow
      FastLED.showColor(CRGB(255,255,0));
    break;
    case 2:
      // Cyan
      FastLED.showColor(CRGB(0,255,255));
    break;
    case 3:
      // Magenta
      FastLED.showColor(CRGB(255,0,255));
    break;
    case 4:
      // Black
      FastLED.showColor(CRGB(180,180,180));
    break;
    default:
      // Red
      FastLED.showColor(CRGB(255,0,0));
  }
  


  
//  static uint8_t hue = 0;
//  Serial.print("x");
//  // First slide the led in one direction
//  for(int i = 0; i < NUM_LEDS; i++) {
//    // Set the i'th led to red 
//    leds[i] = CHSV(hue++, 255, 255);
//    // Show the leds
//    FastLED.show(); 
//    // now that we've shown the leds, reset the i'th led to black
//    // leds[i] = CRGB::Black;
//    fadeall();
//    // Wait a little bit before we loop around and do it again
//    delay(10);
//  }
//  Serial.print("x");
//
//  // Now go in the other direction.  
//  for(int i = (NUM_LEDS)-1; i >= 0; i--) {
//    // Set the i'th led to red 
//    leds[i] = CHSV(hue++, 255, 255);
//    // Show the leds
//    FastLED.show();
//    // now that we've shown the leds, reset the i'th led to black
//    // leds[i] = CRGB::Black;
//    fadeall();
//    // Wait a little bit before we loop around and do it again
//    delay(10);
//  }
}


uint8_t hue = 0;

void cylon(int frameIndex, int cycleLength){
  int cyclePosition = frameIndex % (cycleLength * 2);
  char direction = cyclePosition < cycleLength ? 1 : -1;
  int pixelPosition = cyclePosition < cycleLength ? cyclePosition : cycleLength - (cyclePosition - cycleLength);
  hue = pixelPosition;
  fadeall();
  leds[pixelPosition] = CHSV(hue, 255, 255);
  FastLED.show();
}
