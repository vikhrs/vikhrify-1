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
    msgs: join(__dirname, 'messages.json'),
    stories: join(__dirname, 'stories.json'),
    channels: join(__dirname, 'channels.json')
};

let db = { users: [], posts: [], msgs: [], stories: [], channels: [] };

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
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const u = username.toLowerCase().trim();
    if(db.users.find(x => x.username === u)) return res.json({error: 'Логин занят'});
    const newUser = { 
        id: Date.now(), name, username: u, password, 
        balance: 0, followers: 0, following: [], 
        avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
        isVerified: false, isBlocked: false, xp: 0, level: 1 
    };
    db.users.push(newUser); await save();
    res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const u = db.users.find(x => x.username === username.toLowerCase() && x.password === password);
    if(!u) return res.json({error: 'Ошибка входа'});
    if(u.isBlocked) return res.json({error: 'БАН'});
    res.json({ success: true, user: u });
});

// Посты и XP
app.post('/api/posts', async (req, res) => {
    const { userId, content, image } = req.body;
    const u = db.users.find(x => x.id === userId);
    if(!u) return res.sendStatus(404);
    db.posts.push({ id: Date.now(), userId, content, image, username: u.username, name: u.name });
    u.xp += 20; // Опыт за пост
    if(u.xp >= u.level * 100) { u.level++; u.xp = 0; }
    await save(); res.json({ success: true });
});

app.get('/api/posts', (req, res) => {
    const { mode, me } = req.query;
    let list = [...db.posts];
    if(mode === 'following' && me) {
        const myU = db.users.find(x => x.username === me);
        list = db.posts.filter(p => myU?.following?.includes(p.username));
    }
    res.json(list.reverse());
});

// Магазин
app.post('/api/buy', async (req, res) => {
    const { userId, type, price } = req.body;
    const u = db.users.find(x => x.id === userId);
    if(u.balance < price) return res.json({error: 'Недостаточно VXR'});
    u.balance -= price;
    if(type === 'blue') u.isVerified = 'blue';
    if(type === 'yellow') u.isVerified = 'yellow';
    await save(); res.json({success: true, user: u});
});

// Админка: Каналы
app.post('/api/admin/create-channel', checkAdmin, async (req, res) => {
    const { ownerUsername, title } = req.body;
    db.channels.push({ id: Date.now(), owner: ownerUsername, title, members: 0 });
    await save(); res.json({success: true});
});

app.listen(PORT, () => console.log(`Vikhrify Engine Started on port ${PORT}`));
