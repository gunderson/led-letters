let pixelMappingMode = false;

let io = window.io;
const socket = io(`ws://${window.location.host}`, {
	reconnectionDelayMax: 10000,
	auth: {
		token: '123',
	},
	query: {
		id: 'my-value',
	},
});

const img = document.getElementById('baseImage');
const displayCanvas = document.getElementById('display');
// const animCanvas = document.getElementById('animation');
const displayCtx = displayCanvas.getContext('2d');
// const animCtx = animCanvas.getContext('2d', {willReadFrequently:true});

const WIDTH = 800;
const HEIGHT = 600;

// --------------------------------------------------------------------------------------
// Input events

$('#play-pause').addEventListener('click', () => {
	socket.emit('toggle-play');
});

$('#start-camera').addEventListener('click', startCamera);

$('#start-mapping').addEventListener('click', () => {
	pixelMappingMode = true;
	let fixtureName = $('#fixture-to-map').value;
	prepareToMapFixture(fixtureName);
});

$('#save-map').addEventListener('click', () => {
	socket.emit('save-map');
});

$('input#threshold-brightness-slider').addEventListener('change', event => {
	thresholdBrightness = event.target.value;
});

$('input#threshold-brightness-slider').addEventListener('input', event => {
	$('#threshold-brightness-value').innerHTML = pad(event.target.value, 3, "0");
	thresholdBrightness = event.target.value;
});

$('input#threshold-range-slider').addEventListener('change', event => {
	thresholdRange = event.target.value;
});

$('input#threshold-range-slider').addEventListener('input', event => {
	$('#threshold-range-value').innerHTML = pad(event.target.value, 3, "0");
	thresholdRange = event.target.value;
});

$('#map-next').addEventListener('click', () => {
	currentLocalPixel.x = mappedBounds.centerX / WIDTH;
	currentLocalPixel.y = mappedBounds.centerY / HEIGHT;
	socket.emit('found-pixel', {
		pixel: currentLocalPixel
	});
});

$('#fps-slider').addEventListener('change', (event) => {
	// change event is not fired if the value is set via script
	socket.emit('set-fps', {
		fps: event.target.value,
	});
});

$('#fps-slider').addEventListener('input', (event) => {
	$('#fps-value').innerHTML = event.target.value;
});

$('#speed-x-slider').addEventListener('change', (event) => {
	// change event is not fired if the value is set via script
	socket.emit('set-animation-speed', {
		x: parseInt(event.target.value),
		y: parseInt($('#speed-y-slider').value)
	});
});

$('#speed-x-slider').addEventListener('input', (event) => {
	$('#speed-x-value').innerHTML = event.target.value;
});

$('#speed-y-slider').addEventListener('change', (event) => {
	// change event is not fired if the value is set via script
	socket.emit('set-animation-speed', {
		x: parseInt($('#speed-x-slider').value),
		y: parseInt(event.target.value),
	});
});

$('#speed-y-slider').addEventListener('input', (event) => {
	$('#speed-y-value').innerHTML = event.target.value;
});

$$$('button.fps').forEach((btn) => {
	btn.addEventListener('click', (event) => {
		socket.emit('set-fps', {
			fps: event.target.value,
		});
		displayFPS(event.target.value);
	});
});

function displayFPS(value) {
	$('#fps-slider').value = value;
	$('#fps-value').innerHTML = value;
}

$('button#set-animation-mode').addEventListener('click', (event) => {
	let modeName = $('select#animation-mode-selector').value;
	socket.emit('set-animation-mode', modeName);
});

$$$('section h2').forEach(($h2) => {
	$h2.addEventListener('click', (event) => {
		let $section = event.target.parentNode;
		$section.classList.toggle('closed');
	});
});

window.addEventListener('keydown', (event) => {
	if (pixelMappingMode) {
		switch (event.key) {
			case 'ArrowLeft':
				console.log('keydown', event.key);
				event.preventDefault();
				// ask for next pixel
				break;
			default:
		}
	}
	return false;
});

function onClickAnimationImage(event) {
	console.log(event);
	let img = event.target;
	socket.emit('set-anim-image', basename(img.src));
}

// --------------------------------------------------------------------------------------
// handle sending a file

document.getElementById('upload-button').addEventListener('click', (event) => {
	event.preventDefault();

	var data = new FormData();
	data.append('image', document.getElementById('upload-image-file').files[0]);

	fetch('/upload', {
		method: 'POST',
		body: data,
		// headers: headers
	});
	return false;
});

// --------------------------------------------------------------------------------------
// socket handling

let drawn = 0;

socket.on('draw', (message) => {
	document.querySelector('#timecode').innerHTML = message.timecode;

	connectedLightFixtures.forEach(fixture => {
		let fixtureData = message.fixtureData.find(data => data.hostname === fixture.hostname);
		if (fixtureData && fixtureData.pixels){
			fixture.pixels.forEach((pixel, i) => {
				pixel.color = fixtureData.pixels[i].color;
			})
		}
	})
	requestAnimationFrame(draw);
});

socket.on('upload-list', (list) => {
	let $colormapsHolder = document.querySelector('#colormaps');
	$colormapsHolder.replaceChildren();

	list.forEach((url) => {
		let img = document.createElement('img');
		img.src = url;
		img.height = 100;
		img.classList.add('animation-image');
		img.addEventListener('click', onClickAnimationImage);
		$colormapsHolder.appendChild(img);
	});
});

socket.on('state', (state) => {
	// mark selected animation image
	let animImages = document.querySelectorAll('.animation-image');
	animImages.forEach((img) => {
		if (basename(img.src) === state.animationImage) {
			img.classList.add('selected');
		} else {
			img.classList.remove('selected');
		}
	});

	$('#speed-x-slider').value = state.animationSpeed.x;
	$('#speed-x-value').innerHTML = state.animationSpeed.x;
	$('#speed-y-slider').value = state.animationSpeed.y;
	$('#speed-y-value').innerHTML = state.animationSpeed.y;

	// console.log(state);
	displayFPS(state.fps);

	if (state.playState === 'PAUSED') {
		$('#play-pause').textContent = 'PLAY';
	}
	if (state.playState === 'PLAYING') {
		$('#play-pause').textContent = 'PAUSE';
	}

	// if fixtures have changed
	let allFixturesFound = state.fixtures.reduce((memo, fixture) => {
		return (
			memo &&
			connectedLightFixtures.filter(
				(conFixture) => conFixture.hostname === fixture.hostname
			).length > 0
		);
	}, true);

	// check to see that all of the connected fixtures are also known

	let fixturesHaveChanged = !allFixturesFound;
	// console.log("fixturesHaveChanged", fixturesHaveChanged);

	connectedLightFixtures = state.fixtures;

	let optionString = connectedLightFixtures.map(fixture => `<option value='${fixture.hostname}'>${fixture.hostname}</option>`)
	$('#fixture-to-map').innerHTML = optionString;


	let $$$lightFixtures = $$$('#light-fixtures table tr');
	// keep the title-row
	$$$lightFixtures.shift();
	$$$lightFixtures.forEach((row) => {
		row.parentNode.remove(row);
	});

	connectedLightFixtures.forEach((fixture) => {
		// console.log('fixture', fixture);
		let $el = document.createElement('tr');
		$el.innerHTML = `<td>${fixture.hostname}</td>
			<td data-name="${fixture.hostname}" class="action begin-mapping">Map Fixture</td>
			<td data-name="${fixture.hostname}" data-highlightMode="${HIGHLIGHT_MODE.HIGHLIGHT_FIXTURE}" class="action highlight">Highlight Fixture</td>
			<td data-name="${fixture.hostname}" data-highlightMode="${HIGHLIGHT_MODE.SOLO_FIXTURE}" class="action solo">Solo</td>`;

		$el.dataset.name = fixture.hostname;
		// console.log("#light-fixtures table", $('#light-fixtures table'));

		$('#light-fixtures table').appendChild($el);

		$el.querySelector('.begin-mapping').addEventListener('click', (event) => {
			prepareToMapFixture(event.target.dataset.name);
			setActiveCell(event.target);
			console.log('click', event.target.dataset.name);
		});
		$el.querySelector('.highlight').addEventListener('click', (event) => {
			toggleHighlightFixtureMode(event.target.dataset.name);
			setActiveCell(event.target);
			console.log('click', event.target.dataset.name);
		});
		$el.querySelector('.solo').addEventListener('click', (event) => {
			toggleSoloFixtureMode(event.target.dataset.name);
			setActiveCell(event.target);
			console.log('click', event.target.dataset.name);
		});
	});

	// find all the pixel groups
	// go through each pixel and grab its group
	pixelsByGroup = {};

	connectedLightFixtures.forEach((fixture) => {
		fixture.pixels.forEach((pixel) => {
			if (pixel.group) {
				if (!pixelsByGroup[pixel.group]) {
					pixelsByGroup[pixel.group] = [];
				}
				pixelsByGroup[pixel.group].push(pixel);
			}
		});
	});

	let $$$pixelGroups = $$$('#pixel-groups table tr');
	$$$pixelGroups.shift();
	$$$pixelGroups.forEach((row) => {
		row.parentNode.remove(row);
	});

	Object.keys(pixelsByGroup).forEach((groupName) => {
		let $el = document.createElement('tr');

		$el.innerHTML = `<td>${groupName}</td>
		<td data-name="${groupName}" class="action begin-mapping">Map Group</td>
		<td data-name="${groupName}" data-highlightMode="${HIGHLIGHT_MODE.HIGHLIGHT_GROUP}" class="action highlight">Highlight</td>
		<td data-name="${groupName}" data-highlightMode="${HIGHLIGHT_MODE.SOLO_GROUP}" class="action solo">Solo</td>`;

		$el.dataset.name = groupName;
		$('#pixel-groups table').appendChild($el);

		$el.querySelector('.begin-mapping').addEventListener('click', (event) => {
			setActiveCell(event.target);
			console.log('click', event.target.dataset.name);
		});
		$el.querySelector('.highlight').addEventListener('click', (event) => {
			toggleHighlightGroupMode(event.target.dataset.name);
			setActiveCell(event.target);
			console.log('click', event.target.dataset.name);
		});
		$el.querySelector('.solo').addEventListener('click', (event) => {
			// FIXME: toggle naively always turns off on second click instead of adjusting to new param
			toggleSoloGroupMode(event.target.dataset.name);
			setActiveCell(event.target);
			console.log('click', event.target.dataset.name);
		});
	});

	function setActiveRow($cell) {
		let $row = $cell.parentNode;
		let $table = $row.parentNode;
		let $$$rows = $$$('#light-fixtures tr, #pixel-groups tr');
		$$$rows.forEach((row) => {
			row.classList.remove('active');
		});

		console.log(highlightMode, $cell.dataset.highlightmode);

		// use the highlight state to determine what to do instead of class presennce
		if (highlightMode === $cell.dataset.highlightmode) {
			$row.classList.add('active');
		}
	}

	function setActiveCell($cell) {
		setActiveRow($cell);

		let $row = $cell.parentNode;
		let $table = $row.parentNode;
		let $$$cells = $$$('#light-fixtures td, #pixel-groups td');
		$$$cells.forEach((cell) => {
			cell.classList.remove('active');
		});

		// use the highlight state to determine what to do instead of class presennce
		if (highlightMode === $cell.dataset.highlightmode) {
			$cell.classList.add('active');
		}
	}

	let $animationModeSelector = $('#animation-mode-selector');
	$animationModeSelector.value = state.animationMode;

	console.log('animation mode', state.animationMode);
});

var currentLocalPixel;

socket.on('map-next-pixel', pixel => {
	let fixture = connectedLightFixtures.find(fixture => fixture.hostname === pixel.fixtureName);
	currentLocalPixel = fixture.pixels.find(localPixel => localPixel.id === pixel.id);
});

socket.on('mapping-complete', () => {
	clearInterval(mappingInterval);
	// clean up
})

// --------------------------------------------------------------------------------------
// Pixel Mapping

var mappingInterval;
var mappedBounds;

function prepareToMapFixture(fixtureName) {
	//start the camera
	startCamera();
	//send message to server
	socket.emit('start-pixel-mapping', {
		fixtureName: fixtureName,
	});
	mappingInterval = setInterval(processCamera, 35);
}

function prepareToMapGroup(groupName) {
	//start the camera
	startCamera();
	//send message to server
	socket.emit('start-pixel-mapping', {
		groupName: groupName,
	});
	mappingInterval = setInterval(processCamera, 35);
}

function processCamera(){
	camCtx.drawImage(camDisplay,0,0);
	let imageData = camCtx.getImageData(0,0,WIDTH,HEIGHT);

	let thresholdColor = thresholdBrightness << 16 | thresholdBrightness << 8 | thresholdBrightness;

	let thresholdData = thresholdMask(imageData, thresholdColor);
	camCtx.putImageData(thresholdData,0,0);
	// find the pixel location
	mappedBounds = getColorBounds(thresholdData, 0xffffff, thresholdRange);

	camCtx.lineWidth = 1;
	camCtx.strokeStyle = "#00ff00";
	camCtx.strokeRect(mappedBounds.minX, mappedBounds.minY, mappedBounds.maxX - mappedBounds.minX, mappedBounds.maxY - mappedBounds.minY);
	camCtx.beginPath()
	camCtx.arc(mappedBounds.centerX, mappedBounds.centerY, 4, 0, Math.PI * 2);
	camCtx.stroke();
}

// --------------------------------------------------------------------------------------
// Light Fixture handling

let connectedLightFixtures = [];

let pixelsByGroup = {};

// --------------------------------------------------------------------------------------
// image analysis

const camCanvas = document.getElementById('cam-analysis');
const camCtx = camCanvas.getContext('2d');
const camDisplay = document.getElementById('cam-display');
let cameraStream;

var thresholdBrightness = 225;
var thresholdRange = 10;

function startCamera() {
	camCtx.willReadFrequently = true;
	//getusermedia
	navigator.mediaDevices
		.getUserMedia({
			audio: false,
			video: { width: 800, height: 600 },
		})
		.then((stream) => {
			/* use the stream */
			console.log('streaming');
			camDisplay.srcObject = stream;
		})
		.catch((err) => {
			/* handle the error */
		});
}

function stopCamera() {
	camDisplay.srcObject.getTracks().forEach((track) => {
		if (track.readyState == 'live') {
			track.stop();
		}
	});
}

function copyCamToCanvas(camstream, camCtx) {
	camCtx.drawImage(camstream, 0, 0);
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

function getColorBounds(imageData, targetColor, threshold = 24) {
	let minColor = Color.parseColor(targetColor);
	let maxColor = Color.parseColor(targetColor);

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
		let y = Math.floor(pixelIndex / imageData.width);

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

	let centerX = minX + ((maxX - minX) / 2);
	let centerY = minY + ((maxY - minY) / 2);

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

// --------------------------------------------------------------------------------------
// HIGHLIGHT & SOLO

const HIGHLIGHT_MODE = {
	HIGHLIGHT_NONE: 'HIGHLIGHT_NONE',
	SOLO_FIXTURE: 'SOLO_FIXTURE',
	SOLO_GROUP: 'SOLO_GROUP',
	HIGHLIGHT_FIXTURE: 'HIGHLIGHT_FIXTURE',
	HIGHLIGHT_GROUP: 'HIGHLIGHT_GROUP',
};

let highlightLocalOnly = true;
let highlightGroupName = '';
let highlightFixtureName = '';
let highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_NONE;
let lowlightAmount = 0.2;

function toggleHighlightGroupMode(groupName){
	if (highlightMode === HIGHLIGHT_MODE.HIGHLIGHT_GROUP && groupName === highlightGroupName){
		// deactivate
		highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_NONE;
		highlightGroupName = '';
	} else {
		highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_GROUP;
		highlightFixtureName = '';
		highlightGroupName = groupName;
	}
	return highlightMode;
}

function toggleSoloGroupMode(groupName){
	if (highlightMode === HIGHLIGHT_MODE.SOLO_GROUP && groupName === highlightGroupName){
		// deactivate
		highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_NONE;
		highlightGroupName = '';
	} else {
		highlightMode = HIGHLIGHT_MODE.SOLO_GROUP;
		highlightFixtureName = '';
		highlightGroupName = groupName;
	}
	return highlightMode;
}

function toggleHighlightFixtureMode(fixtureName){
	if (highlightMode === HIGHLIGHT_MODE.HIGHLIGHT_FIXTURE && fixtureName === highlightFixtureName){
		// deactivate
		highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_NONE;
		highlightFixtureName = '';
	} else {
		highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_FIXTURE;
		highlightFixtureName = fixtureName;
		highlightGroupName = '';
	}
	return highlightMode;
}

function toggleSoloFixtureMode(fixtureName){
	if (highlightMode === HIGHLIGHT_MODE.SOLO_FIXTURE && fixtureName === highlightFixtureName){
		// deactivate
		highlightMode = HIGHLIGHT_MODE.HIGHLIGHT_NONE;
		highlightFixtureName = '';
	} else {
		highlightMode = HIGHLIGHT_MODE.SOLO_FIXTURE;
		highlightFixtureName = fixtureName;
		highlightGroupName = '';
	}
	return highlightMode;
}

// --------------------------------------------------------------------------------------
// PLAYBACK

function draw() {
	// blank the canvas
	// displayCtx.fillStyle = '#000000';
	// displayCtx.fillRect(0,0,WIDTH,HEIGHT);
	displayCtx.clearRect(0,0,WIDTH,HEIGHT);

	displayCtx.lineWidth = 1;

	let allPixels = connectedLightFixtures.map((fixture) => fixture.pixels);
	allPixels = [].concat.apply(this, allPixels);
	allPixels.forEach((pxl) => {
		let color = pxl.color;
		let strokeColor = 0x888888;

		if (highlightMode === HIGHLIGHT_MODE.HIGHLIGHT_GROUP && highlightLocalOnly && pxl.group !== highlightGroupName){
			color = multiplyColor(color, lowlightAmount);
			strokeColor = multiplyColor(strokeColor, lowlightAmount);
		}

		if (highlightMode === HIGHLIGHT_MODE.SOLO_GROUP && highlightLocalOnly && pxl.group !== highlightGroupName){
			return;
		}

		displayCtx.fillStyle = `rgb(${getR(color)}, ${getG(color)}, ${getB(color)})`;	
		displayCtx.strokeStyle = `rgb(${getR(strokeColor)}, ${getG(strokeColor)}, ${getB(strokeColor)})`;

		displayCtx.beginPath();
		displayCtx.arc(pxl.x * WIDTH, pxl.y * HEIGHT, 10, 0, 2 * Math.PI);
		displayCtx.fill();
		displayCtx.stroke();
	});
}

function Pixel(x, y) {
	this.x = x;
	this.y = y;
	this.color = 0xff00ff;
}

class Color{
	constructor(input){
		if (typeof input === 'string'){
			input = parseInt(input, 16);
		}
		this.r = Color.getR(input);
		this.g = Color.getG(input);
		this.b = Color.getB(input);
	}

	static parseColor(input){
		return new Color(input);
	}

	static getR(color) {
		return (color >> 16) & 0xff;
	}
	static getG(color) {
		return (color >> 8) & 0xff;
	}
	static getB(color) {
		return color & 0xff;
	}
}

function getR(color) {
	return (color >> 16) & 0xff;
}
function getG(color) {
	return (color >> 8) & 0xff;
}
function getB(color) {
	return color & 0xff;
}

function multiplyColor(orig, multiplier) {
	let oR = getR(orig);
	let oG = getG(orig);
	let oB = getB(orig);

	let mR = multiplier;
	let mG = multiplier;
	let mB = multiplier;

	if (multiplier > 1) {
		mR = getR(multiplier) / 255;
		mG = getG(multiplier) / 255;
		mB = getB(multiplier) / 255;
	}

	return ((oR * mR) << 16) | ((oG * mG) << 8) | ((oB * mB) << 0);
}

function basename(path) {
	let parts = path.split('/');
	return parts[parts.length - 1];
}

// returns an element or an array of elements or null
function $$$(selector) {
	let nodeList = document.querySelectorAll(selector);
	if (nodeList.length === 0) {
		return [];
	}
	let nodeArray = [];
	nodeList.forEach((el) => nodeArray.push(el));
	return nodeArray;
}
function $(selector) {
	return document.querySelector(selector);
}


function pad(string, length, char){
	if (typeof string !== 'string'){
		string = string.toString();
	}
	while(string.length < length){
		string = char + string;
	}
	return string;
}