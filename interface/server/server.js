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
import Color from './lib/art-kit/src/pixels/Color.js';
import { pad } from './lib/art-kit/src/Text.js';
import { createCanvas, loadImage } from 'canvas';
import { Server as IO } from 'socket.io';
import express from 'express';
import session from 'express-session';
import morgan from 'morgan';
import nodeSassMiddleware from 'node-sass-middleware';
import multer from 'multer';
import _ from 'lodash';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ChildProcess } from 'child_process';
import http from 'http';
import Pixel from './Pixel.js';

// ------------------------------------------------------------------------
// file paths

// workaround for modules, yolo
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
const __www = path.resolve(__dirname + '/../www');
const __uploads = path.resolve(__www + '/assets/uploads');

// ------------------------------------------------------------------------
// load data

let info = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')));
let state = JSON.parse(fs.readFileSync(path.resolve(__dirname, './state.json')));
let savedLightFixtureData = JSON.parse(fs.readFileSync(path.resolve(__dirname, './savedLightFixtures.json')));

// let propCoords = JSON.parse(fs.readFileSync(path.resolve(__dirname, './propCoords.json')));
// let letterFixtureData = JSON.parse(fs.readFileSync(path.resolve(__dirname, './letterFixture.json')));

// ------------------------------------------------------------------------
// server info

const HTTP_PORT = process.env.PORT || info.port || 8000;
const MDNS_NAME = 'light-server';
const OSC_PORT = 57120;

// ------------------------------------------------------------------------
// classes

class LightFixture {
	constructor(hostname, ip, port, numPixels) {
		this.hostname = hostname;
		this.update(ip, port, numPixels);
	}

	makePixels() {
		this.pixels = new Array(this.numPixels).map((p) => new Pixel());
		return this.pixels;
	}

	update(ip, port, numPixels) {
		this.ip = ip;
		this.port = port;
		this.numPixels = numPixels;
		this.makePixels();
		this.makeOscPort();

		this.sendMessage('/setSyncTime', [
			FrameTime.fromMillis(animationPlayer.currentTime, animationPlayer.fps)
				.timecode,
			animationPlayer.fps,
		]);
		this.sendMessage('/sync');
		return this;
	}

	sendMessage(address, args = []) {
		args = args.map((value) => {
			return {
				type: inferOSCArgumentType(value),
				value: value,
			};
		});

		this.oscPort.send(
			{
				address: address,
				args: args,
			},
			this.ip,
			this.port
		);
	}

	makeOscPort() {
		if (this.oscPort) this.oscPort.close();
		this.oscPort = new osc.UDPPort({
			localAddress: '0.0.0.0',
			localPort: OSC_PORT + 1, // TODO: open unique port per device
			remoteAddress: this.ip,
			remotePort: this.port,
		});
		this.oscPort.open();
		return this.oscPort;
	}

	toJSON() {
		return {
			hostname: this.hostname,
			ip: this.ip,
			port: this.port,
			numPixels: this.numPixels,
			pixels: this.pixels,
		};
	}

	static fromObject(obj){
		let lf = new LightFixture();
		lf.hostname = obj.hostname;
		lf.numPixels = obj.pixels.length;
		lf.pixels = obj.pixels.map((px,i) => {
			return new Pixel(px.x, px.y, i, px.group);
		});
		return lf;
	}

	destroy() {
		this.oscPort.close();
		this.oscPort = null;
		this.pixels = null;
	}
}

class FrontEndClient{
	constructor(id, socket){
		this.socket = socket;
		this.id = id;
	}
	destroy(){
		this.socket = null;
		this.id = null;
	}
}

// ------------------------------------------------------------------------
// MDNS

// advertise an HTTP server on port 3000
bonjour.publish({
	name: MDNS_NAME,
	host: MDNS_NAME + '.local',
	type: 'http',
	port: HTTP_PORT,
});

bonjour.publish({
	name: MDNS_NAME,
	host: MDNS_NAME + '.local',
	type: 'osc',
	protocol: 'udp',
	port: OSC_PORT,
});

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
	metadata: true,
});

// Start OSC port and mDNS advertising
oscPort.open();

// Listen for incoming OSC messages
oscPort.on('connect', (message) => {
	// TODO: parse message
	// register connection
	let client = new Client();

	// TODO: ensure it isn't a duplicate client
	connectedLightFixtures.push(client);
});

oscPort.on('message', (message, timeTag, info) => {
	console.log('OSC Message', message);
	console.log('OSC timeTag', timeTag);
	console.log('OSC info', info);

	switch (message.address) {
		case '/light-fixture-info':
			// create client
			let hostname = message.args[0].value;
			let ip = message.args[1].value;
			let port = message.args[2].value;
			let numPixels = message.args[3].value;

			let preexistingClient = getClientByName(hostname);
			if (!preexistingClient) {
				addClient(new LightFixture().update(hostname, ip, port, numPixels));
			} else {
				// update client
				preexistingClient.update(ip, port, numPixels);
			}
			break;
	}
});

// Store connected clients
var connectedLightFixtures = [];

function addClient(client) {
	let hostname = client.hostname;
	let clients = _.filter(connectedLightFixtures, { hostname: hostname });
	if (clients.length > 0) {
		console.warn('Attempting to add Existing Client');
		clients[0].update(client.ip, client.port, client.numPixels);
		client = clients.shift();
		_.remove(connectedLightFixtures, (c) => clients.indexOf(c) > -1);
		return client;
	}
	connectedLightFixtures.push(client);
	return client;
}

function getClientByName(hostname) {
	let clients = _.filter(connectedLightFixtures, { hostname: hostname });
	let client = clients.length > 0 ? clients[0] : null;
	// we should always only have one client. Kill the extras
	if (clients.length > 1) {
		client = clients.pop();
		clients.forEach((c) => c.destroy);
	}
	return client;
}



function broadcastTime() {}

function broadcastSync() {}

function destroyAllClients() {
	connectedLightFixtures.forEach((c) => c.destroy());
}

function inferOSCArgumentType(arg) {
	var type = typeof arg;

	switch (type) {
		case 'boolean':
			return arg ? 'T' : 'F';
		case 'string':
			return 's';
		case 'number':
			// return "f";
			return arg >> 0 === arg ? 'i' : 'f';
		case 'undefined':
			return 'N';
		case 'object':
			if (arg === null) {
				return 'N';
			} else if (arg instanceof Uint8Array || arg instanceof ArrayBuffer) {
				return 'b';
			} else if (typeof arg.high === 'number' && typeof arg.low === 'number') {
				return 'h';
			}
			break;
	}
}

// ------------------------------------------------------------------------
// EXPRESS

const app = express();
app.use(morgan('dev'));
app.set('trust proxy', 1);

// session Handling
app.use(session({
	secret: 'led-lights + keyboard cat',
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false }
  }))

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

function getSerialList() {
	SerialPort.list().then((ports) => {
		ports.forEach(function (port) {
			console.log('Port: ', port);
		});
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
	res.render('index', {
		request: "request",
		animModes: _.keys(animModes)
	});
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



const frontEndClients = [];
const io = new IO(server);

io.on('connection', (socket) => {
	var clientAddress = socket.conn.remoteAddress;
	// add to connections if not already listed
	// if listed, update socket
	let existingClient = frontEndClients.find(conn => conn.id === clientAddress)
	
	if (existingClient){
		console.log('updated preexisting front-end client', clientAddress);
		existingClient.socket = socket;
	} else {
		let frontEndClient = new FrontEndClient(clientAddress, socket);
		frontEndClients.push(frontEndClient);
		console.log('Added new client', clientAddress);
	}

	socket.on('sync', (time) => {
		time = time || 0;
		animationPlayer.currentTime = 0;
		io.emit('sync', time);
	});

	socket.on('toggle-play', () => {
		if (animationPlayer.playState === AnimationPlayer.PAUSED) {
			animationPlayer.play();
		} else if (animationPlayer.playState === AnimationPlayer.PLAYING) {
			animationPlayer.pause();
		}
		// emitState();
	});

	socket.on('remove-anim-image', (imageUrl) => {
		// TODO: remove animation image from __uploads
		// TODO: refrest list
		// TODO: if current animation image is to be deleted pick next
	});

	socket.on('get-fixtures', () => {
		// send pixel Locations in proportional coordinates against a 4x3 canvas
		socket.emit('set-fixtures', connectedLightFixtures);
	});

	socket.on('set-anim-image', (imageUrl) => {
		let imageName = path.basename(imageUrl);
		setupImage(imageName);
	});

	socket.on('set-animation-mode', (modeName) => {
		setModeByName(modeName);
	});

	socket.on('set-fps', data => {
		console.log('    Socket: set-fps', data.fps)
		animationPlayer.fps = data.fps;
		animationFrameTime.fps = data.fps;
	});

	socket.on('set-colors', (_colors) => {
		colors = _colors;
	});

	socket.on('start-pixel-mapping', (message) => {
		// initialize mapping mode
		if (!message.fixtureName){
			initializePixelMapping(PIXEL_MAPPING_MODE.FULL);
		} else {
			initializePixelMapping(PIXEL_MAPPING_MODE.SINGLE, message.fixtureNam);
		}
	});

	socket.on('found-pixel', (message) => {
		console.log('    Socket: found-pixel')
		// find the pixel
		// update its location
		// save location to DB
		// send next pixel to front-end

		// when complete,
	});

	socket.on('disconnect', () => {
		// remove from list of connections
		console.log('user disconnected');
	});


	let list = getUploadedImages();
	socket.emit('upload-list', list);
	emitState();
});

function emitState(recipient) {
	recipient = recipient || io;
	animModes
	recipient.emit('state', {
		playState: animationPlayer.playState,
		animationSpeed: animationSpeed,
		fps: animationPlayer.fps,
		animationImage: path.basename(animationImage.src),
		fixtures: connectedLightFixtures,
		animationMode: animModeName
	});
}

function sendFrame(frameBuffer) {
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

console.log('emitState', emitState);


let animationPlayer = new AnimationPlayer({
	update: update,
	draw: draw,
	fps: 30,
	onChange: (changes) => {
		emitState();
	}
});

let animationFrameTime = new FrameTime();
animationFrameTime.fps = animationPlayer.fps;


function getNextPixelId(){
	// find the last used pixelId
	let lastId = _.flatMap(connectedLightFixtures, lf => lf.pixels)
	.reduce((m, px) => {
		return px.id <= m ? m : px.id
	}, -1);

	return lastId + 1;
}

function update(timing) {
	if (!animationImage) return;
	animUpdate(timing);
}

function draw() {
	// trim down connected light fixtures
	let fixtureColorData = connectedLightFixtures.map(fixture => {
		return {
			hostname: fixture.hostname,
			pixels: fixture.pixels.map(pixel => {
				return {
					color: pixel.color,
					group: pixel.group,
					id: pixel.id,
					fixture: fixture.hostname
				};
			})
		};
	})

	io.emit('draw', {
		timecode: animationFrameTime.parseTotalMillis(animationPlayer.currentTime).toSMPTETimecode(),
		currentTime: animationPlayer.currentTime,
		currentTick: animationPlayer.currentTick,
		fixtureData: fixtureColorData
	});

	sendPixelColors();
}

function sendPixelColors() {
	// FIXME: this function really only supports a single light fixture and needs to be changed
	let colorArray = _.flatMap(flatPixels, (pixel) => pixel.getColorArray());
	let colorBuffer = new Uint8Array(colorArray).buffer;
	let timecode = FrameTime.fromMillis(
		animationPlayer.currentTime,
		animationPlayer.fps
	).timecode;
	connectedLightFixtures.forEach((client) => {
		client.sendMessage('/pixelColors', [timecode, colorBuffer]);
	});
}


// ------------------------------------------------------------------------
// Pixel Mapping Mode

const PIXEL_MAPPING_MODE = {
	FULL: 'FULL',
	SINGLE: 'SINGLE'
};

let pixelMappingIndex = 0;
let lastPixelMappingixelIndex = 0;
let currentPixelMappingFixture = '';
let pixelMappingMode = PIXEL_MAPPING_MODE.FULL;

function initializePixelMapping(mode, fixtureName){
	pixelIndex = 0;
	if (mode === PIXEL_MAPPING_MODE.SINGLE && fixtureName){
		// find the client
		currentPixelMappingFixture = connectedLightFixtures.find(fixture => fixtureName === fixture.hostname);
		if (!currentPixelMappingFixture){
			console.warn('No Client with the name', fixtureName);
			currentPixelMappingFixture = connectedLightFixtures[0];
		}
	} else {
		currentPixelMappingFixture = connectedLightFixtures[0];
	}
	animUpdate = singlePixelSequenceMode;
}

function advancePixelMapSequence(){
	// if the current index > num pixels in current fixture, advance fixture
	// if mode is single, finish
}

function singlePixelSequenceMode(){
	// set all device pixels to black
	connectedLightFixtures.forEach((client) => {
		client.pixels.forEach(pixel => pixel.color = 0);
	});
	// find the pixel to light
		// find the fixture that the pixel belongs to
		currentPixelMappingFixture

	// set currentClient pixel to white
	// send message to front-end that pixel is lit
	
}



// ------------------------------------------------------------------------
// Drawing Modes

function setModeByName(modeName) {
	if (animModes[modeName]) {
		if (animModes[modeName].setup) {
			animModes[modeName].setup();
		}
		animUpdate = animModes[modeName].update;
		animModeName = modeName;
	}
}

let animModes = {
	'solid-color': { update: solidColorMode },
	'gradient': { update: gradientMode },
	'slide-image-y': { update: slideImageYMode },
	'slide-image-x': { update: slideImageXMode },
	'slide-image-x-y': { update: slideImageXYMode },
	'slide-image-y-mirrored': { update: slideImageYMirroredMode },
	'slide-image-x-mirrored': { update: slideImageXMirroredMode },
	'slide-image-x-y-mirrored': { update: slideImageXYMirroredMode },
	'blink': { update: blinkMode },
};

let animUpdate = slideImageYMode;
let animModeName = 'slide-image-y';
let animationSpeed = 1;

let colors = [0xffffff, 0xff0000, 0x0000ff];

let blinkState = 0;
let blinkFrameInterval = 1;
let blinkStateFrames = 0;

let blinkTimeChange = Date.now();

function blinkMode(timing) {
	let newblinkState =
		timing.currentTick % (blinkFrameInterval * 2) < blinkFrameInterval ? 1 : 0;

	// console.log(`timing.currentTick ${timing.currentTick}`);
	if (newblinkState === blinkState) {
		blinkStateFrames++;
	} else {
		let now = Date.now();
		// console.log(`BlinkState was steady on ${blinkState} for ${blinkStateFrames} frames. Over ${now - blinkTimeChange}ms.`);
		blinkStateFrames = 1;
		blinkState = newblinkState;
		blinkTimeChange = now;
		let timecode = FrameTime.fromMillis(
			timing.currentTime,
			animationPlayer.fps
		).timecode;
		connectedLightFixtures.forEach((client) => {
			client.sendMessage('/led', [timecode, blinkState]);
		});
	}
}

function solidColorMode(timing) {
	flatPixels.forEach((pxl) => {
		pxl.color = colors[0];
	});
}

function gradientMode(timing) {}

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

function slideImageXYMode() {}
function slideImageXMirroredMode() {}
function slideImageYMirroredMode() {}
function slideImageXYMirroredMode() {}

// ------------------------------------------------------------------------
// Find light in image

const camCanvas = createCanvas(WIDTH, HEIGHT);
const camCtx = camCanvas.getContext('2d');

// load image
// setupCamImage('assets/testImages/pink-dot.png');

function setupCamImage(imageName) {
	loadImage(__www + '/' + imageName).then((camImage) => {
		camCtx.drawImage(camImage, 0, 0, WIDTH, HEIGHT);
		let imageData = camCtx.getImageData(0, 0, WIDTH, HEIGHT);
		let maskedData = thresholdMask(imageData, 0x550055);
		let bounds = getColorBounds(maskedData, 0xffffff, 24);
		console.log('pink dot color bounds:', bounds);
		camCtx.putImageData(maskedData, 0, 0);

		let out = fs.createWriteStream(__www + '/assets/testImages/test.png');
		let stream = canvas.createPNGStream();
		stream.pipe(out);
		out.on('finish', () => {
			console.log('The PNG file was created.');
		});
	});
}

function thresholdMask(imageData, thresholdColor) {
	thresholdColor = Color.parseColor(thresholdColor);
	let thresholdSum = thresholdColor.r + thresholdColor.g + thresholdColor.b;
	let pixelIndex = 0;
	while (pixelIndex * 4 < imageData.data.length) {
		let dataIndex = pixelIndex * 4;
		let pixelSum =
			imageData.data[dataIndex] +
			imageData.data[dataIndex + 1] +
			imageData.data[dataIndex + 2];
		if (pixelSum < thresholdSum) {
			imageData.data[dataIndex] =
				imageData.data[dataIndex + 1] =
				imageData.data[dataIndex + 2] =
					0;
		} else {
			imageData.data[dataIndex] =
				imageData.data[dataIndex + 1] =
				imageData.data[dataIndex + 2] =
					0xff;
		}
		pixelIndex++;
	}
	return imageData;
}

function getColorBounds(imageData, thresholdColor, threshold = 24) {
	let minColor = Color.parseColor(thresholdColor);
	let maxColor = Color.parseColor(thresholdColor);

	minColor.r = Math.max(0, minColor.r - threshold);
	minColor.g = Math.max(0, minColor.g - threshold);
	minColor.b = Math.max(0, minColor.b - threshold);

	maxColor.r = Math.min(0xff, maxColor.r + threshold);
	maxColor.g = Math.min(0xff, maxColor.g + threshold);
	maxColor.b = Math.min(0xff, maxColor.b + threshold);

	let pixelIndex = 0;
	let numFound = 0;
	let minX = imageData.width;
	let maxX = 0;
	let minY = imageData.height;
	let maxY = 0;


	while (pixelIndex * 4 < imageData.data.length) {
		let dataIndex = pixelIndex * 4;

		let x = pixelIndex % imageData.width;
		let y = Math.floor(pixelIndex / imageData.height);

		let r = imageData.data[dataIndex];
		let g = imageData.data[dataIndex + 1];
		let b = imageData.data[dataIndex + 2];

		if (
			r >= minColor.r &&
			r <= maxColor.r &&
			g >= minColor.g &&
			g <= maxColor.g &&
			b >= minColor.b &&
			b <= maxColor.b
		) {
			numFound++;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}

		pixelIndex++;
	}

	if (numFound === 0) {
		return {
			minX: 0,
			maxX: imageData.width,
			minY: 0,
			maxY: imageData.height,
			centerX: imageData.width / 2,
			centerY: imageData.height / 2,
			numFound: numFound,
		};
	}

	let centerX = minX + (maxX - minX);
	let centerY = minY + (maxY - minY);

	return {
		minX,
		maxX,
		minY,
		maxY,
		numFound,
		centerX,
		centerY,
	};
}


// FIXME: translate prop coords into light fixtures
// ------------------------------------------------------------------------
// temporary section to change data format

// let letterFixture = LightFixture.fromObject(letterFixtureData);
// connectedLightFixtures.push(letterFixture);
// fs.writeFileSync(path.resolve(__dirname, './savedLightFixtures.json'), JSON.stringify(connectedLightFixtures,null, '\t'));


// process saved light fixtures
savedLightFixtureData.forEach(lfData => {
	let fixture = LightFixture.fromObject(lfData);
	connectedLightFixtures.push(fixture)
});

// FIXME: move this to on light fixture connect
let flatPixels = _.map(connectedLightFixtures, fixture => fixture.pixels);
flatPixels = _.flatten(flatPixels);

/*
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


// convert Pixels to new groups format
letterPixels.p.forEach((px, i) => {
	px.group = 'p';
})
letterPixels.j.forEach((px, i) => {
	px.group = 'j';
})
letterPixels.g.forEach((px, i) => {
	px.group = 'g';
})

// setup new light fixture
let tempFixture = new LightFixture();
tempFixture.pixels = flatPixels;
tempFixture.numPixels = flatPixels.length;

fs.writeFileSync(path.resolve(__dirname, './letterFixture.json'), JSON.stringify(tempFixture,null, '\t'));
*/

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
