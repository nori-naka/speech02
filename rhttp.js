var PORT = 10443;
var SSL_KEY = 'server.key';
var SSL_CERT = 'server.crt';

var keepAliveStart = false;
var ttlVal = 3;
var keepAliveTime = (new Date()).getTime();

var path = require('path');
var fs = require("fs");
var url = require("url");

var mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript"
};

var options = {
    key: fs.readFileSync(SSL_KEY).toString(),
    cert: fs.readFileSync(SSL_CERT).toString()
};

const getUniqueId = getUniqueIdMaker();

// サーバの初期化
//var server = require("https").createServer(options, function(req, res) {
var server = require("http").createServer(function (req, res) {
    var urlParse = url.parse(req.url, true);

    var filePath;
    if (urlParse.pathname == '/') {
        filePath = '/index.html';
    } else {
        filePath = urlParse.pathname;
    }
    //console.log("req.url=" + req.url);
    //console.log("filePath=" + filePath);
    //console.log(JSON.stringify(urlParse));

    var fullPath = __dirname + filePath;
    fs.readFile(fullPath, function (err, data) {
        if (err) {
            console.log("NO FILE: " + filePath);
            res.writeHead(500);
            res.end('Error loading ' + filePath);
        } else {
            res.writeHead(200, { "Content-Type": mime[path.extname(fullPath)] || "text/html" });
            if (urlParse.pathname == "/index.html" && urlParse.query.user_id) {
                data = data.toString().replace("initial_user_id", urlParse.query.user_id);
            }
            res.end(data);
        }
    });
}).listen(process.env.PORT || PORT);
var io = require("socket.io").listen(server);

// ユーザ管理ハッシュ
var userHash = {};
var user_sid = {};
//-------------------------------------------------------------
// userHash = {
//   id : { lat : lat,  lng : lng, ttl : ttl}
// }
//-------------------------------------------------------------
// user_sid = {
//   id : socket_id,
// }
//-------------------------------------------------------------

// イベントの定義
io.on("connection", function (socket) {

    // 接続開始
    socket.on("connected", function (_id) {
        console.log('ENTERED:' + _id);
        user_sid[_id] = socket.id;
        socket.broadcast.emit("start", { id: _id });
        console.log("CONNECTED: USER_ID=" + _id + " USER_SID=" + JSON.stringify(user_sid));
    });

    // 登録
    socket.on("regist", function (_id) {
        console.log('ON REGIST:' + _id);
        user_sid[_id] = socket.id;
        socket.broadcast.emit("regist", JSON.stringify({ id: _id }));
    });

    // // 登録応答
    // socket.on("regist-apply", function (msg) {
    //     var data = JSON.parse(msg);
    //     console.log(`ON REGIST-APPLY: DEST=${data.dest} SRC=${data.src}`);
    //     if (!user_sid[data.src]){
    //         user_sid[data.src] = socket.id;
    //     }
    //     socket.to(user_sid[data.dest]).emit("regist-apply", msg);
    // });

    // // Senderからの映像ソース変更
    // socket.on("video_init", function (msg) {
    //     var data = JSON.parse(msg);
    //     console.log(`ON VIDEO_INIT: DEST=${data.dest} SRC=${data.src}`);
    //     socket.to(user_sid[data.dest]).emit("video_init", msg);
    // });

    // P2P開始
    socket.on("start", function (msg) {
        var data = JSON.parse(msg);
        console.log(`ON START: ${data.src} -> ${data.dest}  MSG=${msg}`);
        if (data.dest) {
            socket.to(user_sid[data.dest]).emit("start", JSON.stringify({ id: data.src }));
        } else {
            socket.broadcast.emit("start", JSON.stringify({ id: data.src }));
        }
    });

    // メッセージ送信
    socket.on("publish", function (msg) {
        var data = JSON.parse(msg);
        if (data.dest) {
            //socket.broadcast.emit("publish", msg);
            console.log(`data.dest=${data.dest}`);
            console.log(`user_sid[data.dest] =${user_sid[data.dest]}`);
            socket.to(user_sid[data.dest]).emit("publish", msg);
        } else {
            socket.broadcast.emit("publish", msg);
        }
        console.log(`PUBLISH MSG: ${msg}`);
    });

    // 位置情報着信
    socket.on("renew", function (msg) {
        var data = JSON.parse(msg);
        user_sid[data.id] = socket.id;

        //console.log(`ON RENEW : From=${data.id} LAT=${data.lat} LNG=${data.lng} CAM=${data.cam}`);

        if (data.id) {
            userHash[data.id] = { lat: data.lat, lng: data.lng, ttl: ttlVal, cam: data.cam };
            //console.log("RECIVE:USERHASH=" + JSON.stringify(userHash));
        }
    });

    // カメラ情報設定
    socket.on("camera", function (msg) {
        var data = JSON.parse(msg);
        console.log(`ON CAMERA : ID=${data.id} CAM=${data.cam}`);

        if (data.id) {
            if (userHash[data.id]) {
                userHash[data.id].cam = data.cam;
                //userHash[data.id].cam = true;
            } else {
                userHash[data.id] = { lat: null, lng: null, ttl: ttlVal, cam: data.cam };
                //userHash[data.id] = { lat: null, lng: null, ttl: ttlVal, cam: true };
            }
        }
    });

    // 切断
    socket.on("disconnect", function (reason) {
        console.log(`DISCONNECT msg=${reason}`);
        //console.log(`socket.id=${socket.id}`);
        //if (reason.indexOf("transport error") != -1) {
        // Object.keys(user_sid).forEach(function(_id){
        //     if (user_sid[_id] == socket.id){
        //         delete userHash[_id];
        //         delete user_sid[_id];
        //         io.sockets.emit("user_disconnect", JSON.stringify({ id: _id}));
        //     }
        // });
    });

    // 接続終了(接続元ユーザを削除し、他ユーザへ通知)
    /*
    Object.keys(user_sid).forEach(function(_id){
        if (socket.id == user_sid[_id]) {
            delete userHash[_id];
            delete user_sid[_id];
            var msg = {id: _id};
            socket.broadcast.emit("disconect", JSON.stringify(msg));
        }
    });
    console.log("DELETE:USERHASH=" + JSON.stringify(userHash));        
    //socket.broadcast.emit("renew", { value: JSON.stringify(userHash) });   
    */

    setInterval(function () {
        socket.emit("renew", JSON.stringify(userHash));
        //console.log(`SEND RENEW : USERHASH=${JSON.stringify(userHash)}`);
        //console.log(`SEND RENEW : USER_SID=${JSON.stringify(user_sid)}`);
        //console.log("TIME: " + (new Date()).getTime());

        //----------------------------------------------------------
        // Keep Alive (CHECK TTL)
        //----------------------------------------------------------
        const now = (new Date()).getTime();
        if (now >= keepAliveTime + 1500) {
            keepAliveTime = now;
            Object.keys(userHash).forEach(function (id) {
                userHash[id].ttl = userHash[id].ttl - 1;
                if (userHash[id].ttl < 0) {
                    delete userHash[id];
                    //delete user_sid[id];
                    console.log(`DELETE id=${id} USER_HASH=${JSON.stringify(userHash)}`);
                }
            });
        }
        //console.log("USERHASH=" + JSON.stringify(userHash));
        //console.log("USER_SID=" + JSON.stringify(user_sid));
    }, 1500);
});




// 番号をアルファベットに変換（27進数）
function getAlphabet(no) {
    return getAlphabetExec(no + 1);
}
function getAlphabetExec(no) {
    if (no == 0) {
        return "";
    }
    else if (no < 27) {
        return String.fromCharCode(0x40 + no);
    }
    else {
        let upper = Math.floor(no / 27);
        let lower = no % 27;
        return getAlphabetExec(upper) + getAlphabetExec(lower);
    }
}

// ユニークID
function getUniqueIdMaker() {
    let userId = 0;
    return function () {
        let alpha = getAlphabet(userId);
        userId++;
        return alpha;
    }
}