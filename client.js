const socket = io();

window.onload = () => console.log("Welcome to Vikhrify!");

function show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function send() {
    const input = document.getElementById('m');
    if(input.value.trim() !== "") {
        socket.emit('send_message', input.value);
        input.value = '';
    }
}

socket.on('receive_message', (msg) => {
    const div = document.createElement('div');
    div.innerText = msg;
    document.getElementById('chat-box').appendChild(div);
});
