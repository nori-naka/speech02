const socketio = io.connect();

const $local_id = document.getElementById("local_id");
const $local_name = document.getElementById("local_name");
const $local_elm = document.getElementById("local_elm");
const $remote = document.getElementById("remote");
const remotes = {};
let local_id = null;
let local_stream = null;

constraints = {
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

navigator.mediaDevices.enumerateDevices()
	.then(function(devices) {
  		devices.forEach(function(device) {
    		console.dir(device);
  		});
	})
	.catch(function(err) {
  		console.log(err.name + ": " + err.message);
	});

//constraints = { video: true, audio: true }
navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
        local_stream = stream;
        $local_elm.srcObject = local_stream;
        $local_elm.onloadedmetadata = function (e) {
            $local_elm.play();
        };
        $local_elm.play();
    })
    .catch(function (err) {
        console.log(`gUM error:${err}`);
    });

$local_id.onchange = function (ev) {
    console.log(`$local_id:${ev.target.value}`);
    local_id = ev.target.value;
    $local_id.style.display = "none";
    $local_name.innerText = local_id;
    $local_name.style.display = "block";
    setInterval(function () {
        socketio.emit("renew", JSON.stringify({ id: local_id }));
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
                    { urls: 'stun:23.21.150.121' }
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
                }
            }
            remotes[new_user].peer.ontrack = function (ev) {
                console.log(`ontrack ev=${JSON.stringify(ev)}`);

                if (ev.streams && ev.streams[0]) {
                    remotes[new_user].obj.show(ev);
                }
            }

            remotes[new_user].video_sender = remotes[new_user].peer.addTrack(local_stream.getVideoTracks()[0], local_stream);
            remotes[new_user].audio_sender = remotes[new_user].peer.addTrack(local_stream.getAudioTracks()[0], local_stream);

            remotes[new_user].obj.on("click", function () {
                remotes[new_user].peer.createOffer()
                    .then(function (offer) {
                        console.log(`setLocalDescription`);
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
            })
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
            const remote_sdp = new RTCSessionDescription(data.sdp);
            remotes[data.src].peer.setRemoteDescription(remote_sdp)
                .then(function () {
                    console.log(`createAnswer`);
                    return remotes[data.src].peer.createAnswer();
                })
                .then(function (answer) {
                    console.log(`setLocalDescription answer`);
                    const local_sdp = new RTCSessionDescription(answer);
                    remotes[data.src].peer.setLocalDescription(local_sdp);
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
            const remote_sdp = new RTCSessionDescription(data.sdp);
            remotes[data.src].peer.setRemoteDescription(remote_sdp)
        } else if (data.type == "candidate") {
            console.log(`addIceCandidate`);
            const candidate = new RTCIceCandidate(data.candidate);
            remotes[data.src].peer.addIceCandidate(candidate);
        }
    }
})