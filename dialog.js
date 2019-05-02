/*
const $login_dialog = document.getElementById('myModal');
const $btn_close = document.getElementById("btn_close");
const $local_id = document.getElementById("local_id");

$btn_close.onclick = function () {
    $login_dialog.style.display = "none";
}
*/
let $local_id;

const Create_dialog = function (parent) {

    self = this;

    this.elm = document.createElement('div');
    this.elm.innerHTML = `<div class="modal-content">
            <span class="close" id="btn_close">&times;</span>
            <p>LOGIN</p>
            <div id="msg">
                ID : <input type="text" id="local_id" class="text">
            </div>
        </div>`;

    this.elm.classList.add('modal');
    parent.appendChild(this.elm);

    this.btn_OK = document.createElement("div");
    this.btn_OK.innerText = "OK";
    this.btn_OK.classList.add("raised");
    document.getElementById("msg").appendChild(this.btn_OK);

    $local_id = document.getElementById("local_id");
}

Create_dialog.prototype.get_element = function () {
    return this.elm;
}

Create_dialog.prototype.show = function () {
    this.elm.style.display = "block";
}

Create_dialog.prototype.close = function () {
    this.elm.style.display = "none";
}

Create_dialog.prototype.on_click = function (func) {
    this.btn_OK.addEventListener("click", function (ev) {
        func(ev);
        self.close();
    });
}