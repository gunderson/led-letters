# This is your main script.
import machine
import time

print("Hello, world!")

pin = machine.Pin(2, machine.Pin.OUT)

def toggle(p):
    p.value(not p.value())

while True:
    toggle(pin)
    time.sleep_ms(500)

