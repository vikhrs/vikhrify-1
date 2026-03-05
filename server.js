import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
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
        try { 
            const data = await fs.readFile(FILES[key], 'utf8');
            db[key] = JSON.parse(data); 
        } catch(e) { db[key] = []; }
    }
}
async function save() {
    for (let key in FILES) await fs.writeFile(FILES[key], JSON.stringify(db[key], null, 2));
}
await load();

// РАЗДАЧА ФАЙЛОВ
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// АВТОРИЗАЦИЯ И ПОСТЫ (Стандартные методы)
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

app.get('/api/posts', (req, res) => res.json(db.posts.slice().reverse()));

app.post('/api/posts', async (req, res) => {
    const { userId, content, image } = req.body;
    const u = db.users.find(x => x.id === userId);
    db.posts.push({ id: Date.now(), username: u.username, name: u.name, avatar: u.avatar, content, image, isVerified: u.isVerified });
    await save(); res.json({ success: true });
});

// НОВАЯ АДМИНКА (БЕЗ СЛОЖНЫХ ТОКЕНОВ)
app.post('/api/admin/login', (req, res) => {
    if(req.body.password === ADMIN_PASS) res.json({success: true, users: db.users});
    else res.status(403).json({error: 'Неверный пароль'});
});

app.post('/api/admin/update', async (req, res) => {
    const { password, userId, balance, level, isVerified } = req.body;
    if(password !== ADMIN_PASS) return res.status(403).send('No');
    
    const u = db.users.find(x => x.id == userId);
    if(u) {
        u.balance = Number(balance);
        u.level = Number(level);
        u.isVerified = isVerified === 'false' ? false : isVerified;
        await save();
        res.json({success: true});
    } else res.status(404).send('Not found');
});

app.listen(PORT, () => console.log('Vikhrify Server Running'));
