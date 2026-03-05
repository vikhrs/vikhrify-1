import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3000;
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Для тяжелых фото

const FILES = {
    users: join(__dirname, 'users.json'),
    posts: join(__dirname, 'posts.json'),
    chats: join(__dirname, 'chats.json')
};

let db = { users: [], posts: [], chats: [] };

async function load() {
    for (let key in FILES) {
        try { db[key] = JSON.parse(await fs.readFile(FILES[key], 'utf8')); } catch(e) { db[key] = []; }
    }
}
async function save() {
    for (let key in FILES) await fs.writeFile(FILES[key], JSON.stringify(db[key], null, 2));
}
await load();

const checkAdmin = (req, res, next) => {
    if(req.headers['x-admin-pass'] !== ADMIN_PASS) return res.sendStatus(403);
    next();
};

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// ЧАТЫ
app.get('/api/chats', (req, res) => {
    const { me } = req.query;
    const myChats = db.chats.filter(c => c.users.includes(me));
    res.json(myChats);
});

app.post('/api/message', async (req, res) => {
    const { from, to, text } = req.body;
    let chat = db.chats.find(c => c.users.includes(from) && c.users.includes(to));
    if(!chat) {
        chat = { id: Date.now(), users: [from, to], messages: [] };
        db.chats.push(chat);
    }
    chat.messages.push({ from, text, time: new Date() });
    await save();
    res.json({ success: true, chat });
});

// РЕГИСТРАЦИЯ И ОСТАЛЬНОЕ (сохранено из прошлых версий)
app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const u = username.toLowerCase().trim();
    if(db.users.find(x => x.username === u)) return res.json({error: 'Логин занят'});
    const newUser = { id: Date.now(), name, username: u, password, balance: 0, avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isVerified: false, xp: 0, level: 1, following: [] };
    db.users.push(newUser); await save();
    res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const u = db.users.find(x => x.username === username.toLowerCase() && x.password === password);
    if(!u) return res.json({error: 'Ошибка входа'});
    res.json({ success: true, user: u });
});

app.post('/api/posts', async (req, res) => {
    const { userId, content, imageBase64 } = req.body;
    const u = db.users.find(x => x.id === userId);
    db.posts.push({ id: Date.now(), userId, content, image: imageBase64, username: u.username, name: u.name, avatar: u.avatar });
    u.xp += 20; if(u.xp >= u.level*100) { u.level++; u.xp=0; }
    await save(); res.json({ success: true, user: u });
});

app.get('/api/posts', (req, res) => res.json(db.posts.slice().reverse()));

app.get('/api/admin/users', checkAdmin, (req, res) => res.json(db.users));
app.post('/api/admin/edit-user', checkAdmin, async (req, res) => {
    const { id, balance, isVerified, level } = req.body;
    const u = db.users.find(x => x.id === id);
    if(u) { Object.assign(u, { balance, isVerified, level }); await save(); }
    res.json({success: true});
});

app.listen(PORT, () => console.log('Vikhrify Engine Online'));
