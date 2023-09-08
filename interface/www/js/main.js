const img = document.getElementById('baseImage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const WIDTH = 800;
const HEIGHT = 600;

ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

let letters = {
	p: [
		[70, 454],
		[72, 432],
		[73, 408],
		[74, 385],
		[74, 359],
		[73, 337],
		[74, 310],
		[72, 285],
		[71, 263],
		[71, 241],
		[72, 215],
		[73, 191],
		[71, 163],
		[70, 139],
		[71, 116],
		[73, 97],
		[93, 94],
		[117, 94],
		[144, 95],
		[169, 96],
		[191, 97],
		[217, 102],
		[243, 110],
		[263, 124],
		[283, 141],
		[296, 160],
		[308, 184],
		[313, 206],
		[315, 232],
		[310, 254],
		[301, 276],
		[290, 295],
		[272, 313],
		[261, 320],
		[238, 331],
		[217, 337],
		[193, 340],
		[173, 340],
		[153, 340],
		[138, 336],
		[124, 331],
		[131, 316],
		[154, 320],
		[177, 321],
		[202, 320],
		[224, 316],
		[243, 312],
		[265, 299],
		[277, 283],
		[289, 258],
		[299, 239],
		[299, 215],
		[293, 188],
		[284, 170],
		[272, 154],
		[257, 139],
		[238, 128],
		[212, 121],
		[198, 118],
		[176, 115],
		[152, 115],
		[125, 112],
		[104, 121],
		[93, 142],
		[92, 166],
		[92, 190],
		[90, 214],
		[93, 239],
		[93, 259],
		[92, 285],
		[91, 312],
		[93, 334],
		[92, 355],
		[91, 379],
		[91, 401],
		[91, 425],
		[92, 450],
	],
	j: [
		[287, 450],
		[272, 444],
		[255, 436],
		[258, 420],
		[277, 425],
		[302, 425],
		[324, 424],
		[345, 413],
		[359, 399],
		[369, 380],
		[372, 358],
		[371, 333],
		[372, 314],
		[374, 290],
		[373, 262],
		[375, 241],
		[375, 224],
		[377, 192],
		[376, 167],
		[376, 148],
		[377, 126],
		[385, 97],
		[394, 116],
		[395, 139],
		[394, 169],
		[392, 192],
		[391, 215],
		[390, 240],
		[390, 265],
		[389, 288],
		[390, 311],
		[390, 333],
		[389, 354],
		[385, 378],
		[376, 401],
		[361, 421],
		[348, 430],
		[329, 438],
		[314, 446],
	],
	g: [
		[599, 451],
		[592, 440],
		[576, 439],
		[560, 434],
		[540, 427],
		[522, 416],
		[502, 401],
		[487, 385],
		[475, 367],
		[464, 346],
		[456, 323],
		[452, 301],
		[451, 277],
		[454, 253],
		[461, 229],
		[469, 209],
		[483, 188],
		[497, 169],
		[514, 152],
		[535, 138],
		[555, 127],
		[578, 120],
		[601, 115],
		[625, 116],
		[648, 117],
		[670, 123],
		[693, 133],
		[712, 144],
		[725, 155],
		[737, 167],
		[738, 182],
		[718, 177],
		[700, 162],
		[682, 148],
		[661, 139],
		[640, 134],
		[618, 133],
		[596, 133],
		[573, 139],
		[552, 148],
		[531, 160],
		[514, 175],
		[499, 193],
		[484, 214],
		[476, 235],
		[470, 257],
		[468, 280],
		[469, 303],
		[473, 325],
		[482, 346],
		[492, 365],
		[507, 383],
		[523, 396],
		[542, 410],
		[562, 419],
		[583, 425],
		[605, 427],
		[627, 426],
		[650, 423],
		[670, 415],
		[689, 403],
		[709, 390],
		[724, 371],
		[735, 355],
		[746, 333],
		[732, 319],
		[709, 317],
		[690, 317],
		[668, 317],
		[646, 314],
		[643, 302],
		[663, 300],
		[689, 300],
		[710, 300],
		[732, 301],
		[754, 300],
		[773, 312],
		[769, 330],
		[761, 348],
		[748, 369],
		[738, 383],
		[724, 398],
		[705, 412],
		[688, 423],
		[670, 432],
		[656, 434],
		[636, 441],
		[622, 448],
	],
};

letters.p = letters.p.map((coords) => {
	coords[0] = coords[0] / WIDTH;
	coords[1] = coords[1] / HEIGHT;
	return new Pixel(coords[0], coords[1]);
});
letters.j = letters.j.map((coords) => {
	coords[0] = coords[0] / WIDTH;
	coords[1] = coords[1] / HEIGHT;
	return new Pixel(coords[0], coords[1]);
});
letters.g = letters.g.map((coords) => {
	coords[0] = coords[0] / WIDTH;
	coords[1] = coords[1] / HEIGHT;
	return new Pixel(coords[0], coords[1]);
});

let allCoords = [].concat(letters.p).concat(letters.j).concat(letters.g);

console.log(allCoords);

console.log(`total: ${allCoords.length}
P: ${letters.p.length}
J: ${letters.j.length}
G: ${letters.g.length}`);

function update() {
	let imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
	allCoords.forEach((pxl) => {
		pxl.color = getColorSampleProportional(imageData, pxl.x, pxl.y);
	});
}

function draw() {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
	allCoords.forEach((pxl) => {
		ctx.fillStyle = `rgb(${getR(pxl.color)}, ${getG(pxl.color)}, ${getB(
			pxl.color
		)})`;
		ctx.fillRect(pxl.x * WIDTH, pxl.y * HEIGHT, 15, 15);
        ctx.strokeRect(pxl.x * WIDTH, pxl.y * HEIGHT, 15, 15);
	});
}

function Pixel(x, y) {
	this.x = x;
	this.y = y;
	this.color = 0xff00ff;
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
	console.log(r, g, b);
	return (r << 16) | (g << 8) | b;
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

ctx.fillStyle = 'magenta';

let clickedCoords = [];

img.addEventListener('click', onClickLetter);

function onClickLetter(event) {
	echoLED(event.offsetX, event.offsetY);
	return;
}

function echoLED(x, y) {
	let coords = [x, y];
	clickedCoords.push(coords);
}

update();
draw();
