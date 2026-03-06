const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bcrypt = require('bcryptjs');

app.use(express.json());
app.use(express.static('public'));

let users = [];

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!/^[a-zA-Z0-9]+$/.test(username)) return res.status(400).send("Только латиница!");
    const hash = await bcrypt.hash(password, 10);
    users.push({ username, password: hash, rating: 0, posts: [] });
    res.send({ status: "OK", message: "Welcome to Vikhrify!" });
});

io.on('connection', (socket) => {
    socket.on('send_message', (msg) => {
        io.emit('receive_message', msg);
    });
    socket.on('new_post', (post) => {
        io.emit('update_feed', post);
    });
});

http.listen(3000, () => console.log('Vikhrify запущен на http://localhost:3000'));
