// canvas要素を取得
var c = document.getElementById('canvas');
var cw;
var ch;

// canvasサイズをwindowサイズにする
c.width = cw = window.innerWidth;
c.height = ch = window.innerHeight;

// 描画に必要なコンテキスト(canvasに描画するためのAPIにアクセスできるオブジェクト)を取得
var ctx = c.getContext('2d');

// AudioNodeを管理するAudioContextの生成
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();


const Audio_meter = function(stream) {
	
	this.inputNode = audioCtx.createMediaStreamSource(stream);
	this.outputNode = audioCtx.createMediaStreamDestination();
	this.analyserNode = audioCtx.createAnalyser();
	this.freqs = new Uint8Array(this.analyserNode.frequencyBinCount);
	this.inputNode.connect(this.analyserNode);
	this.analyserNode.connect(this.outputNode);
	
	stream.removeTrack(stream.getAudioTracks()[0]);
	stream.addTrack(outputNode.stream.getAudioTracks()[0]);
	
	this.draw();                                      // 描画開始
};

Audio_meter.prototype.draw = function() {
	// 0~1まで設定でき、0に近いほど描画の更新がスムーズになり, 1に近いほど描画の更新が鈍くなる。
	this.analyserNode.smoothingTimeConstant = 0.5;
	// FFTサイズを指定する。デフォルトは2048。
	this.analyserNode.fftSize = 2048;
	// 周波数領域の波形データを引数の配列に格納するメソッド。
	// analyserNode.fftSize / 2の要素がthis.freqsに格納される。今回の配列の要素数は1024。
	this.analyserNode.getByteFrequencyData(this.freqs);
	// 全ての波形データを描画するために、一つの波形データのwidthを算出する。
	var barWidth = cw / this.analyserNode.frequencyBinCount;
	ctx.fillStyle = 'rgba(0, 0, 0, 1)';
	ctx.fillRect(0, 0, cw, ch);
	
	// analyserNode.frequencyBinCountはanalyserNode.fftSize / 2の数値。よって今回は1024。
	for (var i = 0; i < this.analyserNode.frequencyBinCount; ++i) {
		var value = this.freqs[i]; // 配列には波形データ 0 ~ 255までの数値が格納されている。
		var percent = value / 255; // 255が最大値なので波形データの%が算出できる。
		var height = ch * percent; // %に基づく描画する高さを算出
		ctx.fillStyle = '#fff';
		ctx.fillRect(i * barWidth, ch, barWidth, -height);  // -をつけないと下に描画されてしまう。
	}
	window.requestAnimationFrame(this.draw.bind(this));
};

// requestAnimationFrameを多くのブラウザで利用するためにprefixの記載
var setUpRAF = function() {
  var requestAnimationFrame = window.requestAnimationFrame ||
                              window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame ||
                              window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
};
