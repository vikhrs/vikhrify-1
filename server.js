import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import cors from 'cors';
import webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

// Настройка Push (VAPID ключи генерируются при старте)
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails('mailto:admin@vikhrify.com', vapidKeys.publicKey, vapidKeys.privateKey);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const FILES = {
    users: join(__dirname, 'users.json'),
    posts: join(__dirname, 'posts.json'),
    subs: join(__dirname, 'subs.json'),
    chats: join(__dirname, 'chats.json')
};

let db = { users: [], posts: [], subs: [], chats: [] };

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
    if(req.headers['x-admin-pass'] !== ADMIN_PASS) return res.status(403).json({error: 'No access'});
    next();
};

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));
app.get('/sw.js', (req, res) => res.sendFile(join(__dirname, 'sw.js')));
app.get('/api/vapid-key', (req, res) => res.send(vapidKeys.publicKey));

// АВТОРИЗАЦИЯ
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

// ПОИСК И ПОДПИСКИ
app.get('/api/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    res.json(db.users.filter(u => u.username.includes(q)).slice(0, 10));
});

app.post('/api/follow', async (req, res) => {
    const { myId, targetUsername } = req.body;
    const me = db.users.find(u => u.id === myId);
    if(me && !me.following.includes(targetUsername)) {
        me.following.push(targetUsername); await save();
        res.json({ success: true, user: me });
    } else res.json({ error: 'Уже подписан' });
});

// ПОСТЫ
app.get('/api/posts', (req, res) => {
    const { mode, username } = req.query;
    let list = [...db.posts];
    if(mode === 'following' && username) {
        const me = db.users.find(u => u.username === username);
        list = db.posts.filter(p => me.following.includes(p.username));
    }
    res.json(list.reverse());
});

app.post('/api/posts', async (req, res) => {
    const { userId, content, image } = req.body;
    const u = db.users.find(x => x.id === userId);
    db.posts.push({ id: Date.now(), username: u.username, name: u.name, avatar: u.avatar, content, image, isVerified: u.isVerified });
    u.xp += 20; if(u.xp >= u.level*100) { u.level++; u.xp=0; }
    await save(); res.json({ success: true, user: u });
});

// ПУШИ И ЧАТ
app.post('/api/subscribe', async (req, res) => {
    const { username, subscription } = req.body;
    db.subs = db.subs.filter(s => s.username !== username);
    db.subs.push({ username, subscription }); await save();
    res.sendStatus(201);
});

app.post('/api/message', async (req, res) => {
    const { from, to, text } = req.body;
    const sub = db.subs.find(s => s.username === to);
    if(sub) {
        const payload = JSON.stringify({ title: `Vikhrify: от @${from}`, body: text });
        webpush.sendNotification(sub.subscription, payload).catch(() => {});
    }
    res.json({ success: true });
});

// АДМИНКА
app.get('/api/admin/users', checkAdmin, (req, res) => res.json(db.users));
app.post('/api/admin/edit', checkAdmin, async (req, res) => {
    const { id, balance, isVerified, level } = req.body;
    const u = db.users.find(x => x.id == id);
    if(u) { u.balance = Number(balance); u.isVerified = isVerified === 'false' ? false : isVerified; u.level = Number(level); await save(); }
    res.json({ success: true });
});

app.listen(PORT, () => console.log('Vikhrify Active'));
