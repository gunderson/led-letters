export default class Pixel {
	constructor(x, y, id, group, fixtureName) {
		// color map projection positions
		this.group = group;
		this.id = id;
		this.x = x;
		this.y = y;
		this.color = 0xff00ff;
        this.fixtureName = 0;
	}

	getColorArray() {
		return [this.color >> 16, (this.color >> 8) & 0xff, this.color & 0xff];
	}

	toJSON() {
		return {
            id: this.id,
            group: this.group,
			color: this.color,
			x: this.x,
			y: this.y,
			fixtureName: this.fixtureName
		};
	}
}