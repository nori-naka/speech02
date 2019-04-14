
const $div = document.createElement('div');
const $sel = document.createElement("select");
const $local = document.getElementById("local");
let my_devices;
let local_video_start;

const selectDevices = function () {

    if ($sel.hasChildNodes()) {
        while ($sel.childNodes.length > 0) {
            $sel.removeChild($sel.firstChild);
        }
    }
    navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {
            my_devices = devices;
            devices.forEach(function (device) {
                if (device.kind == "videoinput") {
                    console.log(device.label);
                    const $opt = document.createElement("option");
                    $opt.value = device.deviceId;
                    $opt.text = device.label;
                    if (constraints.video.deviceId == device.deviceId) {
                        $opt.selected = true;
                    }
                    $sel.appendChild($opt);
                }
            });
            $div.appendChild($sel);
        })
        .catch(function (err) {
            console.log(err.name + ": " + err.message);
        });

    $div.classList.add("device_list");
    $local.appendChild($div);

    $local.addEventListener("click", function (ev) {
        $div.style.left = ev.clientX;
        $div.style.top = ev.clientY;
        $div.style.display = "block";
    })
}

$sel.onchange = function () {
    constraints.video.deviceId = $sel.value;
    stream_stop(local_stream);
    local_video_start();
}
