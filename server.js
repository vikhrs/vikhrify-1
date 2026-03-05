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
    posts: join(__dirname, 'posts.json')
};

let db = { users: [], posts: [] };

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
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));
app.get('/manifest.json', (req, res) => res.sendFile(join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(join(__dirname, 'sw.js')));

app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const u = username.toLowerCase().trim();
    if(db.users.find(x => x.username === u)) return res.json({error: 'Логин занят'});
    const newUser = { id: Date.now(), name, username: u, password, balance: 0, avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isVerified: false };
    db.users.push(newUser); await save();
    res.json({ success: true, user: newUser, message: 'Добро пожаловать в Vikhrify !' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const u = db.users.find(x => x.username === username.toLowerCase() && x.password === password);
    if(!u) return res.json({error: 'Ошибка входа'});
    res.json({ success: true, user: u });
});

app.get('/api/posts', (req, res) => {
    const { username } = req.query;
    let list = username ? db.posts.filter(p => p.username === username) : db.posts;
    res.json(list.slice().reverse());
});

app.get('/api/search', (req, res) => {
    const q = req.query.q.toLowerCase();
    res.json(db.users.filter(u => u.username.includes(q)).slice(0, 10));
});

app.get('/api/admin/users', checkAdmin, (req, res) => res.json(db.users));
app.post('/api/admin/edit-user', checkAdmin, async (req, res) => {
    const { id, balance, isVerified } = req.body;
    const u = db.users.find(x => x.id === id);
    if(u) { u.balance = balance; u.isVerified = isVerified; await save(); }
    res.json({success: true});
});

app.listen(PORT, () => console.log('Vikhrify Active on port ' + PORT));
