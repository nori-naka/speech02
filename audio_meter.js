let color = "#fff";

const requestAnimationFrame = window.requestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.msRequestAnimationFrame;

// AudioNodeを管理するAudioContextの生成

const Audio_meter = function (stream, canvas_elm, bar_color) {

	const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	this.c = canvas_elm;
	this.ctx = this.c.getContext('2d');

	if (bar_color) {
		this.bar_color = bar_color;
	} else {
		this.bar_color = "#fff";
	}

	this.inputNode = audioCtx.createMediaStreamSource(stream);
	this.analyserNode = audioCtx.createAnalyser();
	this.inputNode.connect(this.analyserNode);
	//stream.removeTrack(stream.getAudioTracks()[0]);
	this.draw();
};

Audio_meter.prototype.getCanvas = function () {
	return this.c;
}

Audio_meter.prototype.draw = function () {
	this.freqs = new Uint8Array(this.analyserNode.frequencyBinCount);
	// 0~1まで設定でき、0に近いほど描画の更新がスムーズになり, 1に近いほど描画の更新が鈍くなる。
	this.analyserNode.smoothingTimeConstant = 0.7;
	// FFTサイズを指定する。デフォルトは2048。
	this.analyserNode.fftSize = 512;
	// 周波数領域の波形データを引数の配列に格納するメソッド。
	// analyserNode.fftSize / 2の要素がthis.freqsに格納される。今回の配列の要素数は1024。
	this.analyserNode.getByteFrequencyData(this.freqs);
	// 全ての波形データを描画するために、一つの波形データのwidthを算出する。
	const barWidth = this.c.width / this.analyserNode.frequencyBinCount;

	this.ctx.fillStyle = "#000";
	this.ctx.fillRect(0, 0, this.c.width, this.c.height);  // -をつけないと下に描画されてしまう。
	//this.ctx.clearRect(0, 0, this.c.width, this.c.height);

	// analyserNode.frequencyBinCountはanalyserNode.fftSize / 2の数値。
	for (let i = 0; i < this.analyserNode.frequencyBinCount; ++i) {
		const value = this.freqs[i]; // 配列には波形データ 0 ~ 255までの数値が格納されている。
		const percent = value / 255; // 255が最大値なので波形データの%が算出できる。
		const height = this.c.height * percent; // %に基づく描画する高さを算出
		this.ctx.fillStyle = this.bar_color;
		this.ctx.fillRect(i * barWidth, this.c.height, barWidth, -height);  // -をつけないと下に描画されてしまう。
	}
	requestAnimationFrame(this.draw.bind(this));
};