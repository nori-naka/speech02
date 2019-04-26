const socketio = io.connect();

const $local_id = document.getElementById("local_id");
const $local_name = document.getElementById("local_name");
const $local_elm = document.getElementById("local_elm");
const $remote = document.getElementById("remote");
const remotes = {};
let local_id = null;
let local_stream = null;
let audioCtx;
let local_level_meter;

//-----------------------------------------
const LOG = function (msg) {
    socketio.emit("log", {
        id: local_id,
        func: msg.func,
        text: msg.text
    });
}
//------------------------------------------
let tv_conf_mode = false;

let constraints = {
    audio: true,
    video: {
        width: {
            min: 320,
            max: 640
        },
        height: {
            min: 240,
            max: 480
        },
        frameRate: 20,
        //facingMode: { exact: 'environment' }
        //facingMode: { exact: 'user' }
    }
}

local_video_start = function () {
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {            
            local_stream = stream;
            $local_elm.srcObject = local_stream;
            $local_elm.play();
            selectDevices();
        })
        .catch(function (err) {
            console.log(`gUM error:${err}`);
        });
}
local_video_start();

const stream_stop = function (stream) {
    stream.getVideoTracks().forEach(track => track.stop());
}

$local_id.onchange = function (ev) {
    console.log(`$local_id:${ev.target.value}`);
    local_id = ev.target.value;
    $local_id.style.display = "none";
    $local_name.innerText = local_id;
    $local_name.style.display = "block";

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let $local_level = document.getElementById("local_level");
    local_level_meter = new Audio_meter(local_stream, audioCtx, $local_level);

    setInterval(function () {
        socketio.emit("renew", JSON.stringify({ id: local_id, constraints: constraints }));
    }, 1500);
}

const Create_elm = function (name, parent, a_class) {
    this.$li = document.createElement("li");
    this.$name = document.createElement("span");
    this.$name.classList.add("text");
    this.$name.innerText = name;
    this.$media = document.createElement("video");
    this.$media.classList.add("video");
    this.$media.style.display = "none";
    this.$media.setAttribute("playsinline", true);
    
    this.$li.appendChild(this.$name);
    this.$li.appendChild(this.$media);
    this.$li.classList.add(a_class);
    parent.appendChild(this.$li);
    this.count = 0;
}
Create_elm.prototype.get_elm = function () {
    return this.$li;
}
Create_elm.prototype.show = function (ev) {
    if (ev.track.kind == "video") {
        this.$media.srcObject = ev.streams[0];
        this.$media.style.display = "block";
        this.$media.play();
    }
    if (ev.track.kind == "audio"){
        this.$canvas = document.createElement("canvas");
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.remote_level_meter = new Audio_meter(ev.streams[0], this.audioCtx, this.$canvas);
        this.$li.appendChild(this.$canvas);
    }
}
Create_elm.prototype.delete = function () {
    this.$li.removeChild(this.$media);
    this.$li.removeChild(this.$name);
    this.$li.parentNode.removeChild(this.$li);
}
Create_elm.prototype.on = function (event, handler) {
    this.$li.addEventListener(event, handler);
}

socketio.on("renew", function (msg) {
    //console.log(`renew=${msg}`)
    const data = JSON.parse(msg);

    if (!local_id) return;
    if (!local_stream) return;

    const cur_users = Object.keys(remotes)

    Object.keys(data).forEach(function (new_user) {
        if (!cur_users.includes(new_user) && new_user != local_id) {
            remotes[new_user] = {};
            remotes[new_user].obj = new Create_elm(new_user, $remote, "user_list");
            remotes[new_user].elm = remotes[new_user].obj.get_elm();
            remotes[new_user].peer = new RTCPeerConnection({
                //sdpSemantics : "unified-plan",
                sdpSemantics: "plan-b",
                iceServers: [
                    { urls: "stun:stun.stunprotocol.org" },
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:23.21.150.121' },
                    { urls: "turn:numb.viagenie.ca", credential: "jrc@numb", username: "noriaki.nakamura@gmail.com" }
                ]
            });
            remotes[new_user].peer.onicecandidate = function (ev) {
                console.log(`onicecandidate:ev=${JSON.stringify(ev)}`);

                if (ev.candidate) {
                    socketio.emit("publish", JSON.stringify(
                        {
                            type: "candidate",
                            dest: new_user,
                            src: local_id,
                            candidate: ev.candidate
                        })
                    )
                } else {
                    remotes[new_user].count = 0;
                }
            }
            remotes[new_user].peer.ontrack = function (ev) {
                console.log(`ontrack ev=${JSON.stringify(ev)}`);

                if (ev.streams && ev.streams[0]) {
                    remotes[new_user].obj.show(ev);
                }
            }

            remotes[new_user].peer.onsignalingstatechange = function (ev) {
                LOG({
                    func: "onsignalingstatechange",
                    text: remotes[new_user].peer.signalingState
                });
            }

            remotes[new_user].count = 0;
            remotes[new_user].peer.onnegotiationneeded = function (ev) {
                console.log(`count=${remotes[new_user].count}`);

                if (remotes[new_user].peer.signalingState == "new" || remotes[new_user].peer.signalingState == "stable") {
                    console.log(`signalingState=${remotes[new_user].peer.signalingState}`);
                    // ---------- LOG to server -------------------
                    LOG({
                        func: "onnegotiationneeded",
                        text: `signalingState=${remotes[new_user].peer.signalingState}`
                    })

                    remotes[new_user].peer.createOffer()
                        .then(function (offer) {
                            console.log(`onnegotiationneeded: setLocalDescription`);
                            const local_sdp = new RTCSessionDescription(offer);
                            return remotes[new_user].peer.setLocalDescription(local_sdp);
                        })
                        .then(function () {
                            console.log(`offer emit to=${new_user}`);

                            socketio.emit("publish", JSON.stringify(
                                {
                                    type: "offer",
                                    dest: new_user,
                                    src: local_id,
                                    sdp: remotes[new_user].peer.localDescription
                                })
                            );
                        })
                        .catch(function (err) {
                            console.log(`count=${remotes[new_user].count}`)
                            console.log(`onnegotiationneeded: ${err}`);
                        })

                }
            }

            remotes[new_user].obj.on("click", function () {
                if (tv_conf_mode) {
                    remotes[new_user].video_sender = remotes[new_user].peer.addTrack(local_stream.getVideoTracks()[0], local_stream);
                    remotes[new_user].audio_sender = remotes[new_user].peer.addTrack(local_stream.getAudioTracks()[0], local_stream);
                } else {
                    socketio.emit("publish", JSON.stringify(
                        {
                            type: "video_start",
                            dest: new_user,
                            src: local_id,
                        })
                    )
                }
            });

        }
    });

    cur_users.forEach(function (cur_user) {
        if (!Object.keys(data).includes(cur_user)) {
            console.log(`delete ${cur_user}`);
            remotes[cur_user].obj.delete();
            delete remotes[cur_user].peer;
            delete remotes[cur_user];
        }
    })
});

socketio.on("publish", function (msg) {
    const data = JSON.parse(msg);

    if (data.dest == local_id) {
        if (data.type == "offer") {

            if (tv_conf_mode) {
                if (!remotes[data.src].video_sender) {
                    remotes[data.src].video_sender = remotes[data.src].peer.addTrack(local_stream.getVideoTracks()[0], local_stream);
                }
                if (!remotes[data.src].audio_sender) {
                    remotes[data.src].audio_sender = remotes[data.src].peer.addTrack(local_stream.getAudioTracks()[0], local_stream);
                }
            }

            const remote_sdp = new RTCSessionDescription(data.sdp);
            remotes[data.src].peer.setRemoteDescription(remote_sdp)
                .then(function () {
                    console.log(`socket_on offer: createAnswer`);
                    // ---------LOG to server-------------
                    socketio.emit("log", {
                        from: data.src,
                        to: local_id,
                        func: "createAnswer"
                    });

                    return remotes[data.src].peer.createAnswer();
                })
                .then(function (answer) {
                    console.log(`socket_on offer: setLocalDescription answer`);
                    // ---------LOG to server-------------
                    socketio.emit("log", {
                        from: data.src,
                        to: local_id,
                        func: "setLocalDescription answer"
                    });

                    const local_sdp = new RTCSessionDescription(answer);
                    return remotes[data.src].peer.setLocalDescription(local_sdp);
                })
                .then(function () {
                    socketio.emit("publish", JSON.stringify(
                        {
                            type: "answer",
                            dest: data.src,
                            src: local_id,
                            sdp: remotes[data.src].peer.localDescription
                        })
                    );
                })
                .catch(function (err) {
                    console.log(`signal: ${err}`)
                });
        } else if (data.type == "answer") {
            console.log(`setRemoteDescription`);
            // ---------LOG to server-------------
            socketio.emit("log", {
                id: local_id,
                func: "recive answer"
            });

            const remote_sdp = new RTCSessionDescription(data.sdp);
            remotes[data.src].peer.setRemoteDescription(remote_sdp)
        } else if (data.type == "candidate") {
            console.log(`addIceCandidate`);
            const candidate = new RTCIceCandidate(data.candidate);
            remotes[data.src].peer.addIceCandidate(candidate);
        } else if (data.type == "video_start") {
            //------------LOG to server-------------------
            socketio.emit("log", {
                id: local_id,
                func: "on video_start"
            });
            console.log("video_start");
            remotes[data.src].video_sender = remotes[data.src].peer.addTrack(local_stream.getVideoTracks()[0], local_stream);
            remotes[data.src].audio_sender = remotes[data.src].peer.addTrack(local_stream.getAudioTracks()[0], local_stream);
        }
    }
})