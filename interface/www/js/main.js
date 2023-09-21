let io = window.io;
const socket = io();

const img = document.getElementById('baseImage');
const displayCanvas = document.getElementById('display');
// const animCanvas = document.getElementById('animation');
const displayCtx = displayCanvas.getContext('2d');
// const animCtx = animCanvas.getContext('2d', {willReadFrequently:true});

const WIDTH = 800;
const HEIGHT = 600;

// --------------------------------------------------------------------------------------
// Input events

let playButton = document.querySelector('#playpause');

playButton.addEventListener('click', () => {
	socket.emit('toggle-play');
})

function onClickAnimationImage(event){
	console.log(event);
	let img = event.target;
	socket.emit('set-anim-image', basename(img.src));
}

// --------------------------------------------------------------------------------------
// handle sending a file

document.getElementById("uploadButton").addEventListener("click",function(event) {
	event.preventDefault();
	
	var data = new FormData()
	data.append('image', document.getElementById("uploadImageFile").files[0])

	fetch("/upload", {
		method: 'POST',
		body: data,
		// headers: headers
	})
	return false;
});

// --------------------------------------------------------------------------------------
// socket handling

socket.on('led-state', (state) => {
	if (state.colors.length !== allPixels.length){
		console.error('pixel counts mis-match');
	}
	state.colors.forEach((color, i) => {
		allPixels[i].color = color;
	})

	draw();
})

socket.on("upload-list", list => {
	console.log(list);
	let uploadImages = document.querySelector("#uploadImages")
	uploadImages.replaceChildren();

	list.forEach(url => {
		let img = document.createElement("img");
		img.src = url;
		img.width = 100;
		img.classList.add('animation-image');
		img.addEventListener('click', onClickAnimationImage);
		uploadImages.appendChild(img);
	})
});

socket.on('state', (state) => {
	// mark selected animation image
	let animImages = document.querySelectorAll('.animation-image');
	animImages.forEach(img => {
		if (basename(img.src) === state.animationImage){
			img.classList.add('selected');
		} else {
			img.classList.remove('selected');
		}
	})
})

// --------------------------------------------------------------------------------------
// image handling

let pixels = {};

let propCoords = {
	"p": [
		[0.0875, 0.5875],
		[0.0875, 0.5675],
		[0.09, 0.54],
		[0.09125, 0.51],
		[0.0925, 0.48125],
		[0.0925, 0.44875],
		[0.09125, 0.42125],
		[0.0925, 0.3875],
		[0.09, 0.35625],
		[0.08875, 0.32875],
		[0.08875, 0.30125],
		[0.09, 0.26875],
		[0.09125, 0.23875],
		[0.08875, 0.20375],
		[0.0875, 0.17375],
		[0.08875, 0.145],
		[0.09125, 0.12125],
		[0.11625, 0.1175],
		[0.14625, 0.1175],
		[0.18, 0.11875],
		[0.21125, 0.12],
		[0.23875, 0.12125],
		[0.27125, 0.1275],
		[0.30375, 0.1375],
		[0.32875, 0.155],
		[0.35375, 0.17625],
		[0.37, 0.2],
		[0.385, 0.23],
		[0.39125, 0.2575],
		[0.39375, 0.29],
		[0.3875, 0.3175],
		[0.37625, 0.345],
		[0.3625, 0.36875],
		[0.34, 0.39125],
		[0.32625, 0.4],
		[0.2975, 0.41375],
		[0.27125, 0.42125],
		[0.24125, 0.425],
		[0.21625, 0.425],
		[0.19125, 0.425],
		[0.1725, 0.42],
		[0.155, 0.41375],
		[0.16375, 0.395],
		[0.1925, 0.4],
		[0.22125, 0.40125],
		[0.2525, 0.4],
		[0.28, 0.395],
		[0.30375, 0.39],
		[0.33125, 0.37375],
		[0.34625, 0.35375],
		[0.36125, 0.3225],
		[0.37375, 0.29875],
		[0.37375, 0.26875],
		[0.36625, 0.235],
		[0.355, 0.2125],
		[0.34, 0.1925],
		[0.32125, 0.17375],
		[0.2975, 0.16],
		[0.265, 0.15125],
		[0.2475, 0.1475],
		[0.22, 0.14375],
		[0.19, 0.14375],
		[0.15625, 0.14],
		[0.13, 0.15125],
		[0.11625, 0.1775],
		[0.115, 0.2075],
		[0.115, 0.2375],
		[0.1125, 0.2675],
		[0.11625, 0.29875],
		[0.11625, 0.32375],
		[0.115, 0.35625],
		[0.11375, 0.39],
		[0.11625, 0.4175],
		[0.115, 0.44375],
		[0.11375, 0.47375],
		[0.11375, 0.50125],
		[0.11375, 0.53125],
		[0.115, 0.5625]
	],
	"j": [
		[0.35875, 0.5625],
		[0.34, 0.555],
		[0.31875, 0.545],
		[0.3225, 0.525],
		[0.34625, 0.53125],
		[0.3775, 0.53125],
		[0.405, 0.53],
		[0.43125, 0.51625],
		[0.44875, 0.49875],
		[0.46125, 0.475],
		[0.465, 0.4475],
		[0.46375, 0.41625],
		[0.465, 0.3925],
		[0.4675, 0.3625],
		[0.46625, 0.3275],
		[0.46875, 0.30125],
		[0.46875, 0.28],
		[0.47125, 0.24],
		[0.47, 0.20875],
		[0.47, 0.185],
		[0.47125, 0.1575],
		[0.48125, 0.12125],
		[0.4925, 0.145],
		[0.49375, 0.17375],
		[0.4925, 0.21125],
		[0.49, 0.24],
		[0.48875, 0.26875],
		[0.4875, 0.3],
		[0.4875, 0.33125],
		[0.48625, 0.36],
		[0.4875, 0.38875],
		[0.4875, 0.41625],
		[0.48625, 0.4425],
		[0.48125, 0.4725],
		[0.47, 0.50125],
		[0.45125, 0.52625],
		[0.435, 0.5375],
		[0.41125, 0.5475],
		[0.3925, 0.5575]
	],
	"g": [
		[0.74875, 0.56375],
		[0.74, 0.55],
		[0.72, 0.54875],
		[0.7, 0.5425],
		[0.675, 0.53375],
		[0.6525, 0.52],
		[0.6275, 0.50125],
		[0.60875, 0.48125],
		[0.59375, 0.45875],
		[0.58, 0.4325],
		[0.57, 0.40375],
		[0.565, 0.37625],
		[0.56375, 0.34625],
		[0.5675, 0.31625],
		[0.57625, 0.28625],
		[0.58625, 0.26125],
		[0.60375, 0.235],
		[0.62125, 0.21125],
		[0.6425, 0.19],
		[0.66875, 0.1725],
		[0.69375, 0.15875],
		[0.7225, 0.15],
		[0.75125, 0.14375],
		[0.78125, 0.145],
		[0.81, 0.14625],
		[0.8375, 0.15375],
		[0.86625, 0.16625],
		[0.89, 0.18],
		[0.90625, 0.19375],
		[0.92125, 0.20875],
		[0.9225, 0.2275],
		[0.8975, 0.22125],
		[0.875, 0.2025],
		[0.8525, 0.185],
		[0.82625, 0.17375],
		[0.8, 0.1675],
		[0.7725, 0.16625],
		[0.745, 0.16625],
		[0.71625, 0.17375],
		[0.69, 0.185],
		[0.66375, 0.2],
		[0.6425, 0.21875],
		[0.62375, 0.24125],
		[0.605, 0.2675],
		[0.595, 0.29375],
		[0.5875, 0.32125],
		[0.585, 0.35],
		[0.58625, 0.37875],
		[0.59125, 0.40625],
		[0.6025, 0.4325],
		[0.615, 0.45625],
		[0.63375, 0.47875],
		[0.65375, 0.495],
		[0.6775, 0.5125],
		[0.7025, 0.52375],
		[0.72875, 0.53125],
		[0.75625, 0.53375],
		[0.78375, 0.5325],
		[0.8125, 0.52875],
		[0.8375, 0.51875],
		[0.86125, 0.50375],
		[0.88625, 0.4875],
		[0.905, 0.46375],
		[0.91875, 0.44375],
		[0.9325, 0.41625],
		[0.915, 0.39875],
		[0.88625, 0.39625],
		[0.8625, 0.39625],
		[0.835, 0.39625],
		[0.8075, 0.3925],
		[0.80375, 0.3775],
		[0.82875, 0.375],
		[0.86125, 0.375],
		[0.8875, 0.375],
		[0.915, 0.37625],
		[0.9425, 0.375],
		[0.96625, 0.39],
		[0.96125, 0.4125],
		[0.95125, 0.435],
		[0.935, 0.46125],
		[0.9225, 0.47875],
		[0.905, 0.4975],
		[0.88125, 0.515],
		[0.86, 0.52875],
		[0.8375, 0.54],
		[0.82, 0.5425],
		[0.795, 0.55125],
		[0.7775, 0.56]
	]
}

pixels.p = propCoords.p.map((coords) => {
	return new Pixel(coords[0], coords[1]);
});
pixels.j = propCoords.j.map((coords) => {
	return new Pixel(coords[0], coords[1]);
});
pixels.g = propCoords.g.map((coords) => {
	return new Pixel(coords[0], coords[1]);
});

let allPixels = [].concat(pixels.p).concat(pixels.j).concat(pixels.g);

console.log('allPixels.length', allPixels.length);

// --------------------------------------------------------------------------------------
// PLAYBACK


function draw() {
	displayCtx.strokeStyle = '#ffffff';
	displayCtx.lineWidth = 2;
	allPixels.forEach((pxl) => {
		displayCtx.fillStyle = `rgb(${getR(pxl.color)}, ${getG(pxl.color)}, ${getB(
			pxl.color
		)})`;
		displayCtx.fillRect(pxl.x * WIDTH, pxl.y * HEIGHT, 15, 15);
		displayCtx.strokeRect(pxl.x * WIDTH, pxl.y * HEIGHT, 15, 15);
	});
}

function Pixel(x, y) {
	this.x = x;
	this.y = y;
	this.color = 0xff00ff;
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

function basename(path){
	let parts = path.split('/');
	return parts[parts.length - 1];
}