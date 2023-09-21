// TODO: update mode from ui
// TODO: send colors to serial port
// TODO: select serial port
// TODO: send colors to wifi devices
// TODO: select wifi device
// TODO: remap coords (they're wrong)
// TODO: automate coordinate mapping
// TODO: implement OSC
// TODO: implement wifi/mdns
// TODO: make clock sync across devices
// TODO: decode video frames
// TODO: create default mode
// TODO: add chase mode
// TODO: add gradient mode
// TODO: generate gradient images for gradient mode
// TODO: add radial gradient draw mode


// TODO: add peak collections for client handling?

import mdns from 'mdns';

import * as bj from 'bonjour';
const Bonjour = bj.default;
let bonjour = Bonjour();

import osc from 'osc';
import { SerialPort } from 'serialport';
import AnimationPlayer from './lib/art-kit/src/media/AnimationPlayer.js';
import FrameTime from './lib/art-kit/src/media/FrameTime.js';
import { pad } from './lib/art-kit/src/Text.js';
import { createCanvas, loadImage } from 'canvas';
import { Server as IO } from 'socket.io';
import express from 'express';
import morgan from 'morgan';
import nodeSassMiddleware from 'node-sass-middleware';
import multer from 'multer';
import _ from 'lodash';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ChildProcess } from 'child_process';
import http from 'http';

// load data
import info from '../../package.json' assert { type: 'json' };
import state from './state.json' assert { type: 'json' };
import propCoords from './propcoords.json' assert { type: 'json' };

const HTTP_PORT = process.env.PORT || info.port || 8000;
const MDNS_NAME = 'light-server';

// workaround for modules, yolo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __www = path.resolve(__dirname + '/../www');
const __uploads = path.resolve(__www + '/assets/uploads');

const OSC_PORT = 57120;

// ------------------------------------------------------------------------
// MDNS

// advertise an HTTP server on port 3000
bonjour.publish({
    name: MDNS_NAME, 
    host: MDNS_NAME + '.local', 
    type: 'http', 
    port: HTTP_PORT 
})

bonjour.publish({
    name: MDNS_NAME, 
    host: MDNS_NAME + '.local', 
    type: 'osc',
	protocol: 'udp',
    port: OSC_PORT 
})

// Initialize mDNS advertising for server discovery
// const adHttp = mdns.createAdvertisement(mdns.tcp('http'), HTTP_PORT, { host: MDNS_NAME });
// const adOSC = mdns.createAdvertisement(mdns.udp('osc'), OSC_PORT, { host: MDNS_NAME }); 

// adHttp.start();
// adOSC.start();

// ------------------------------------------------------------------------
// OSC

// Create an OSC UDP Port
const oscPort = new osc.UDPPort({
  localAddress: '0.0.0.0',
  localPort: OSC_PORT,
  metadata: true
});

// Start OSC port and mDNS advertising
oscPort.open();

// Listen for incoming OSC messages
oscPort.on('connect', message => {
	// TODO: parse message
  // register connection
	let client = new Client();

	// TODO: ensure it isn't a duplicate client
	connectedClients.push(client);
});

oscPort.on('message', (message, timeTag, info) => {
	console.log('OSC Message', message);
	console.log('OSC timeTag', timeTag);
	console.log('OSC info', info);

	switch (message.address){
		case "/light-fixture-info":
			// create client
			let hostname = message.args[0].value;
			let ip = message.args[1].value;
			let port = message.args[2].value;
			let numPixels = message.args[3].value;

			let preexistingClient = getClientByName(hostname);
			if (!preexistingClient){
				addClient(new OscClient(hostname, ip, port, numPixels));
			} else {
				// update client
				preexistingClient.update(ip, port, numPixels);
			}
		break;
	}
});

// Store connected clients
var connectedClients = [];

function addClient(client){
	let hostname = client.hostname;
	let clients = _.filter(connectedClients, {'hostname': hostname});
	if (clients.length > 0){
		console.warn('Attempting to add Existing Client');
		clients[0].update(client.ip, client.port, client.numPixels);
		client = clients.shift();
		_.remove(connectedClients, c => clients.indexOf(c) > -1);
		return (client);
	}
	connectedClients.push(client);
	return client;
}

function getClientByName(hostname){
	let clients = _.filter(connectedClients, {'hostname': hostname});
	let client = clients.length > 0 ? clients[0] : null;
	// we should always only have one client. Kill the extras
	if (clients.length > 1){
		client = clients.pop();
		clients.forEach( c => c.destroy);
	}
	return client;
}

class OscClient {
	constructor(hostname, ip, port, numPixels){
		this.hostname = hostname;
		this.update(ip, port, numPixels);
	}

	makePixels(){
		this.pixels = new Array(this.numPixels).map(p => new Pixel())
		return this.pixels;
	}

	update(ip, port, numPixels){
		this.ip = ip;
		this.port = port;
		this.numPixels = numPixels;
		this.makePixels();
		this.makeOscPort();

		this.sendMessage("/setSyncTime", [
			FrameTime.fromMillis(animationPlayer.currentTime, animationPlayer.fps).timecode, 
			animationPlayer.fps
		]);
		this.sendMessage("/sync");
		return this;
	}

	sendMessage(address, args = []){
		args = args.map(value => {
			return {
				type: inferOSCArgumentType(value),
				value: value
			}
		});


		this.oscPort.send({
			address: address,
			args: args
		}, this.ip, this.port);
	}

	makeOscPort(){
		if (this.oscPort) this.oscPort.close();
		this.oscPort = new osc.UDPPort({
			localAddress: '0.0.0.0',
			localPort: OSC_PORT + 1, // TODO: open unique port per device
			remoteAddress: this.ip,
			remotePort: this.port
		})
		this.oscPort.open();
		return this.oscPort;
	}

	toJSON(){
		return {
			'hostname': this.hostname,
			'ip': this.ip,
			'port': this.port,
			'numPixels': this.numPixels,
			'pixels': JSON.stringify(this.pixels)
		}
	}

	destroy() {
		this.oscPort.close();
		this.oscPort = null;
		this.pixels = null;
	}
}

function broadcastTime(){

}

function broadcastSync(){

}

function destroyAllClients(){
	connectedClients.forEach(c => c.destroy());
}

function inferOSCArgumentType (arg) {
	var type = typeof arg;

	switch (type) {
		case "boolean":
			return arg ? "T" : "F";
		case "string":
			return "s";
		case "number":
			// return "f";
			return (arg >> 0) === arg ? "i" : "f";
		case "undefined":
			return "N";
		case "object":
			if (arg === null) {
				return "N";
			} else if (arg instanceof Uint8Array ||
				arg instanceof ArrayBuffer) {
				return "b";
			} else if (typeof arg.high === "number" && typeof arg.low === "number") {
				return "h";
			}
			break;
	}
}

// ------------------------------------------------------------------------
// EXPRESS

const app = express();
app.use(morgan('dev'));

// file upload Handling

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, __www + '/assets/uploads/');
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
	},
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('image'), (req, res) => {
	// Get the file that was set to our field named "image"
	const image = req.file;

	// If no image submitted, exit
	if (!image) return res.sendStatus(400);

	// Move the uploaded image to our upload folder
	let imagePath = '/assets/uploads/' + image.name;
	state.image = image.filename;

	saveState();
	res.sendStatus(200);
});

function saveState() {
	console.log(state);
	fs.writeFileSync(__dirname + '/state.json', JSON.stringify(state));
}

function getUploadedImages() {
	let files = fs.readdirSync(__uploads);
	files = files.map((filename) => `/uploads/${filename}`);
	return files;
}

function getSerialList(){
	SerialPort.list()
		.then((ports) =>{
			ports.forEach(function(port){
			console.log("Port: ", port);
			})
		});
}
getSerialList();

app.get('/upload-list', (req, res) => {
	let list = getUploadedImages();
	res.send(list);
	return;
});

app.get(
	'/css/*',
	nodeSassMiddleware({
		src: path.join(__www, '/sass'),
		dest: path.join(__www, '/built/css'),
		debug: false,
		indentedSyntax: true,
		outputStyle: 'compressed',
		prefix: '/css',
		// force: true
	})
);

app.use('/favicon.ico', function (req, res) {
	res.redirect(301, '/images/favicon.png');
});
app.use('/robots.txt', function (req, res, next) {
	res.type('text/plain');
	res.send(fs.readFileSync(__dirname + '/../www/assets/robots.txt'));
});

app.use('/js/module', express.static('./node_modules'));
app.use('/js', express.static(__www + '/js'));
app.use('/images', express.static(__www + '/assets/images'));
app.use('/uploads', express.static(__www + '/assets/uploads'));
// app.use('/videos', express.static(__www + '/assets/videos'));
// app.use('/fonts', express.static(__www + '/assets/fonts'));
// app.use('/sounds', express.static(__www + '/assets/sounds'));
app.use('/css', express.static(__www + '/built/css'));

app.set('view engine', 'pug');
app.set('views', __dirname + '/../www/pug');

app.use((req, res, next) => {
	res.locals.version = info.version;
	next();
});

app.get('/', (req, res) => {
	console.log('index');
	res.render('index');
});

app.post('/github-webhook', (req, res) => {
	const { body } = req;
	if (
		body &&
		body.repository &&
		body.repository.name === 'patrickgunderson.com'
	) {
		console.log('Received webhook for patrickgunderson.com');
		const { exec } = ChildProcess;
		exec('git pull', (error, stdout, stderr) => {
			if (error) {
				console.error('Error executing git pull:', error);
				return res.sendStatus(500);
			}
			console.log('Git pull successful');
			console.log(stdout);
			console.error(stderr);

			// Execute build script here
			exec('npm run build', (error, stdout, stderr) => {
				if (error) {
					console.error('Error executing build script:', error);
					return res.sendStatus(500);
				}
				console.log('Build script executed successfully');
				console.log(stdout);
				console.error(stderr);

				// Restart PM2 process here
				exec('pm2 restart patrickgunderson.com', (error, stdout, stderr) => {
					if (error) {
						console.error('Error restarting PM2 process:', error);
						return res.sendStatus(500);
					}
					console.log('PM2 process restarted successfully');
					console.log(stdout);
					console.error(stderr);

					res.sendStatus(200);
				});
			});
		});
	} else {
		console.log('Invalid webhook payload');
		res.sendStatus(400);
	}
});

const server = http.createServer(app);

// ------------------------------------------------------------------------
// SOCKET.IO

const io = new IO(server);
io.on('connection', (socket) => {
	console.log('connection made');

	socket.on('sync', time => {
		time = time || 0;
		animationPlayer.currentTime = 0;
		io.emit('sync', time);
	})

	socket.on('toggle-play', () => {
		if (animationPlayer.playState === AnimationPlayer.PAUSED) {
			animationPlayer.play();
		} else if (animationPlayer.playState === AnimationPlayer.PLAYING) {
			animationPlayer.pause();
		}
		console.log('toggle-play', animationPlayer.playState);
	});

	socket.on('remove-anim-image', imageUrl => {
		// TODO: remove animation image from __uploads
		// TODO: refrest list
		// TODO: if current animation image is to be deleted pick next
	})

	socket.on('set-pixel-locations', pixelLocations => {
		// send pixel Locations from web UI in proportional coordinates against a 16:9 canvas
	});

	socket.on('set-anim-image', imageUrl => {
		let imageName = path.basename(imageUrl);
		setupImage(imageName);
	});

	socket.on('set-mode', modeName => {
		setModeByName(modeName);
	});

	socket.on('set-speed', speed => {
		animationSpeed = speed;
	});

	socket.on('set-fps', fps => {
	
	});

	socket.on('set-colors', _colors => {
		colors = _colors;
	});

	socket.on('disconnect', () => {
		console.log('user disconnected');
	});
	let list = getUploadedImages();
	socket.emit('upload-list', list);
	emitState();
});

function emitState(recipient) {
	recipient = recipient || io;
	recipient.emit('state', {
		'playState': animationPlayer.playState,
		'animationSpeed': animationSpeed,
		'fps': animationPlayer.fps,
		'animationImage': path.basename(animationImage.src),
		'clients': connectedClients.map(c => c.toJSON())
	});
}

function sendFrame(frameBuffer){
	io.emit('frame', frameBuffer);
}

server.listen(HTTP_PORT, () => {
	console.log('server is listening on port:', HTTP_PORT);
});

// ------------------------------------------------------------------------
// DRAWING


const WIDTH = 800;
const HEIGHT = 600;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');
let animationImage;

setupImage('horiz-stripes.png');

function setupImage(imageName) {
	loadImage(__uploads + '/' + imageName).then((image) => {
		animationImage = image;
		console.log('animationImage', animationImage);

		ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
		animationPlayer.play();
		emitState();
	});
}

function sampleCanvasAtPixels(ctx, pixels) {
	let imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
	pixels.forEach((px) => {
		px.color = getColorSampleProportional(imageData, px.x, px.y);
	});
}

function getColorSampleProportional(imageData, propX, propY) {
	let width = imageData.width;
	let height = imageData.height;

	let x = Math.round(propX * width);
	let y = Math.round(propY * height);
	// multiply x and width by 4 because there are 4 entries per pixel
	let pixelIndex = x * 4 + y * width * 4;

	let r = imageData.data[pixelIndex];
	let g = imageData.data[pixelIndex + 1];
	let b = imageData.data[pixelIndex + 2];
	return (r << 16) | (g << 8) | b;
}

let animationPlayer = new AnimationPlayer({
	update: update,
	draw: draw,
	fps: 10,
});

let animationFrameTime = new FrameTime();
animationFrameTime.fps = animationPlayer.fps;


class Pixel {
	constructor(x,y){
		// color map projection positions
		this.x = x;
		this.y = y;
		this.color = 0xff00ff;
	}

	getColorArray(){
		return [this.color >> 16, (this.color >> 8) & 0xff, this.color & 0xff];
	}

	toJSON(){
		return {
			'x': this.x,
			'y': this.y,
			'color': this.color,
		}
	}
}

let letterPixels = {
	p: propCoords.p.map((coord) => {
		return new Pixel(coord[0], coord[1]);
	}),
	j: propCoords.j.map((coord) => {
		return new Pixel(coord[0], coord[1]);
	}),
	g: propCoords.g.map((coord) => {
		return new Pixel(coord[0], coord[1]);
	}),
};

let flatPixels = []
	.concat(letterPixels.p)
	.concat(letterPixels.j)
	.concat(letterPixels.g);

function update(timing) {
	if (!animationImage) return;
	animUpdate(timing);
}

function draw() {
	io.emit('led-state', {
		colors: flatPixels.map((pixel) => pixel.color),
	});

	sendPixelColors();
}

function sendPixelColors(){
	let colorArray = _.flatMap(flatPixels, pixel => pixel.getColorArray());
	let colorBuffer = new Uint8Array(colorArray).buffer;
	let timecode = FrameTime.fromMillis(animationPlayer.currentTime, animationPlayer.fps).timecode;
		connectedClients.forEach(client => {
			client.sendMessage("/pixelColors", [
				timecode,
				colorBuffer
			]);
		});
}

// ------------------------------------------------------------------------
// Drawing Modes

function setModeByName(modeName){
	if (modes[modeName]){
		if (modes[modeName].setup){
			modes[modeName].setup();
		}
		animUpdate = modes[modeName].update;
	}
}

let modes = {
	'solid-color': {'update': solidColorMode},
	'gradient': {'update': gradientMode},
	'slide-image-y': {'update': slideImageYMode},
	'slide-image-x': {'update': slideImageXMode},
	'slide-image-x-y': {'update': slideImageXYMode},
	'slide-image-y-mirrored': {'update': slideImageYMirroredMode},
	'slide-image-x-mirrored': {'update': slideImageXMirroredMode},
	'slide-image-x-y-mirrored': {'update': slideImageXYMirroredMode},
	'blink': {'update': blinkMode}
}

let animUpdate = slideImageYMode;
let animationSpeed = 1;


let colors = [
	0xffffff, 
	0xff0000,
	0x0000ff
];

let blinkState = 0;
let blinkFrameInterval = 1;
let blinkStateFrames = 0;

let blinkTimeChange = Date.now();

function blinkMode(timing){
	let newblinkState = (timing.currentTick % (blinkFrameInterval * 2)) < blinkFrameInterval ? 1 : 0;

	// console.log(`timing.currentTick ${timing.currentTick}`);
	if (newblinkState === blinkState){
		blinkStateFrames++;
	} else {
		let now = Date.now()
		// console.log(`BlinkState was steady on ${blinkState} for ${blinkStateFrames} frames. Over ${now - blinkTimeChange}ms.`);
		blinkStateFrames = 1;
		blinkState = newblinkState;
		blinkTimeChange = now;
		let timecode = FrameTime.fromMillis(timing.currentTime, animationPlayer.fps).timecode;
		connectedClients.forEach(client => {
			client.sendMessage("/led", [
				timecode,
				blinkState
			]);
		});
	}

}

function solidColorMode(timing) {
	flatPixels.forEach((pxl) => {
		pxl.color = colors[0];
	});
}

function gradientMode(timing){

}

let animX = 0;
let animY = 0;

function slideImageXMode(timing) {
	animX += 1;
	animX = animX % WIDTH;

	ctx.drawImage(animationImage, -WIDTH + animX, 0, WIDTH, HEIGHT);
	ctx.drawImage(animationImage, animX, 0, WIDTH, HEIGHT);

	sampleCanvasAtPixels(ctx, flatPixels);
}

function slideImageYMode(timing) {
	animY += 1;
	animY = animY % HEIGHT;

	ctx.drawImage(animationImage, 0, -HEIGHT + animY, WIDTH, HEIGHT);
	ctx.drawImage(animationImage, 0, animY, WIDTH, HEIGHT);

	sampleCanvasAtPixels(ctx, flatPixels);
}

function slideImageXYMode(){}
function slideImageXMirroredMode(){}
function slideImageYMirroredMode(){}
function slideImageXYMirroredMode(){}


// ------------------------------------------------------------------------
// elegantly end the server

let quitStates = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
quitStates.forEach((signal) =>
	process.on(signal, () => {
		console.log('\nGood Bye');
		destroyAllClients();
		oscPort.close();
		bonjour.destroy();
		server.close();
		process.exit();
	})
);
