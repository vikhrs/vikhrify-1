import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const DB_PATH = './database.json';
let db = { users: [], posts: [], chats: [] };

async function loadDB() {
    try { db = JSON.parse(await fs.readFile(DB_PATH, 'utf8')); } 
    catch { await saveDB(); }
}
async function saveDB() { await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2)); }
await loadDB();

// API: Авторизация и Профиль
app.post('/api/auth', async (req, res) => {
    const { username, password, name } = req.body;
    let user = db.users.find(u => u.username === username);
    if (!user) {
        user = { 
            id: 'VXR-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            username, password, name, avatar: '', 
            followers: [], following: [], rating: 0, 
            isBlocked: false, badge: '', theme: 'dark' 
        };
        db.users.push(user);
    } else if (user.password !== password) return res.status(401).json({error: 'Pass'});
    if (user.isBlocked) return res.status(403).json({ error: 'Blocked' });
    await saveDB(); res.json(user);
});

app.post('/api/user/update', async (req, res) => {
    const u = db.users.find(x => x.username === req.body.username);
    if(u) {
        u.name = req.body.name;
        u.avatar = req.body.avatar;
        if(req.body.newPass) u.password = req.body.newPass;
        await saveDB(); res.json(u);
    }
});

// API: Посты (Автообновление идет через GET)
app.get('/api/posts', (req, res) => res.json(db.posts.slice().reverse()));
app.post('/api/posts', async (req, res) => {
    const user = db.users.find(u => u.username === req.body.username);
    const post = { id: Date.now(), ...req.body, date: new Date() };
    db.posts.push(post);
    user.rating += 15; // +15 рейтинга за пост
    await saveDB(); res.json(post);
});

// API: Чаты с шифрованием Base64
app.post('/api/messages', async (req, res) => {
    const msg = { ...req.body, text: Buffer.from(req.body.text).toString('base64'), time: Date.now() };
    db.chats.push(msg);
    await saveDB(); res.json(msg);
});

app.get('/api/my-chats/:user', (req, res) => {
    const list = db.chats.filter(c => c.from === req.params.user || c.to === req.params.user);
    res.json(list);
});

// API: Админка
app.get('/api/admin/data', (req, res) => {
    const clearChats = db.chats.map(c => ({...c, text: Buffer.from(c.text, 'base64').toString('utf-8')}));
    res.json({ users: db.users, posts: db.posts.length, chats: clearChats });
});

app.post('/api/admin/action', async (req, res) => {
    const u = db.users.find(x => x.id === req.body.userId);
    if(req.body.action === 'block') u.isBlocked = req.body.value;
    if(req.body.action === 'badge') u.badge = req.body.value;
    await saveDB(); res.json({success: true});
});

app.listen(3000);
