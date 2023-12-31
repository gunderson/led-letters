# led-letters

## node

This system requires nodeJS. It was build using node@20.6.0  

## installation

we prefer to install node via nvm on development systems

### prerequisites

#### node-canvas

This package requires node-canvas and it may need to be compiled for the host system

instructions can be found at https://github.com/Automattic/node-canvas

for OS X with homebrew:

````bash

brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman

````

for ubuntu/debian:

````bash

sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

````

#### art-kit

art kit can be obtained at git@github.com:gunderson/art-kit.git

it should be cloned and symlinked for use

````bash

git clone git@github.com:gunderson/art-kit.git
cd art-kit
git checkout dev
cd ..
mkdir -p ./led-letters/interface/server/lib
ln -s ~/Development/art-kit ~/Development/led-letters/interface/server/lib

````

### keepalive

for keepalive we use pm2 (todo)

## Message format

Messages are sent to arduino in binary format.

the first byte identifies the type of message
    - 0 playback control
    - 1 mode
    - 2 leds array

the second byte defines the length of the message in 2^value increments

// do we need to have this or will the buffer just read, even if there's a backup?

so if we have 3 colors and 255 leds then we need a message that is at least 765 slots long

The closest 2 exponent to 765 is 2^10, 1024, so our message will be 1026 total bytes.

the data will look like:

````
MMMMMMMM LLLLLLLL DDDDDDDD DDDDDDDD DDDDDDDD ...
       2       10      255      255      255 ...
00000010 00001010 11111111 11111111 11111111 ...
````