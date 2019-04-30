const $login_dialog = document.getElementById('myModal');
const $btn_close = document.getElementById("btn_close");
const $local_id = document.getElementById("local_id");

$btn_close.onclick = function () {
    $login_dialog.style.display = "none";
}
