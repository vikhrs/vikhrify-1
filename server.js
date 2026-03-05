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
app.use(express.json({ limit: '50mb' }));

const FILES = {
    users: join(__dirname, 'users.json'),
    posts: join(__dirname, 'posts.json'),
    stories: join(__dirname, 'stories.json')
};

let db = { users: [], posts: [], stories: [] };

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

// API
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const u = username.toLowerCase().trim();
    if(db.users.find(x => x.username === u)) return res.json({error: 'Логин занят'});
    const newUser = { 
        id: Date.now(), name, username: u, password, balance: 0, 
        avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
        isVerified: false, xp: 0, level: 1, following: [] 
    };
    db.users.push(newUser); await save();
    res.json({ success: true, user: newUser, message: 'Добро пожаловать в Vikhrify !' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const u = db.users.find(x => x.username === username.toLowerCase() && x.password === password);
    if(!u) return res.json({error: 'Ошибка входа'});
    res.json({ success: true, user: u });
});

// ПОСТЫ С ЛОГИКОЙ XP И ПОДПИСОК
app.get('/api/posts', (req, res) => {
    const { mode, me } = req.query;
    let list = [...db.posts];
    if(mode === 'following' && me) {
        const myU = db.users.find(u => u.username === me);
        list = db.posts.filter(p => myU?.following?.includes(p.username));
    }
    res.json(list.reverse());
});

app.post('/api/posts', async (req, res) => {
    const { userId, content, image } = req.body;
    const u = db.users.find(x => x.id === userId);
    if(!u) return res.sendStatus(404);
    db.posts.push({ id: Date.now(), userId, content, image, username: u.username, name: u.name, avatar: u.avatar });
    u.xp += 20;
    if(u.xp >= u.level * 100) { u.level++; u.xp = 0; }
    await save(); res.json({ success: true, user: u });
});

// АВТОМАТИЧЕСКАЯ ПОКУПКА
app.post('/api/buy-status', async (req, res) => {
    const { userId, type, price } = req.body;
    const u = db.users.find(x => x.id === userId);
    if(!u || u.balance < price) return res.json({error: 'Недостаточно VXR'});
    u.balance -= price;
    u.isVerified = type; // 'blue' или 'yellow'
    await save();
    res.json({ success: true, user: u });
});

// АДМИНКА
app.get('/api/admin/users', checkAdmin, (req, res) => res.json(db.users));
app.post('/api/admin/edit-user', checkAdmin, async (req, res) => {
    const { id, balance, isVerified, level, xp } = req.body;
    const u = db.users.find(x => x.id === id);
    if(u) {
        if(balance !== undefined) u.balance = Number(balance);
        if(isVerified !== undefined) u.isVerified = isVerified;
        if(level !== undefined) u.level = Number(level);
        if(xp !== undefined) u.xp = Number(xp);
        await save();
    }
    res.json({success: true});
});

app.listen(PORT, () => console.log('Vikhrify Engine Started'));
