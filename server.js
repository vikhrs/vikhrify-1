import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

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

// AUTH
app.post('/api/auth/reg', async (req, res) => {
    const { username, password, name } = req.body;
    if (db.users.find(u => u.username === username)) return res.status(400).send();
    const newUser = { 
        id: 'VXR-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        username, password, name, avatar: '', followers: [], rating: 0, isBlocked: false, badge: '' 
    };
    db.users.push(newUser);
    await saveDB(); res.json(newUser);
});

app.post('/api/auth/login', (req, res) => {
    const user = db.users.find(u => u.username === req.body.username && u.password === req.body.password);
    if (!user || user.isBlocked) return res.status(401).send();
    res.json(user);
});

// POSTS
app.get('/api/posts', (req, res) => res.json(db.posts.slice().reverse()));
app.post('/api/posts', async (req, res) => {
    db.posts.push({ id: Date.now(), ...req.body, date: new Date() });
    const user = db.users.find(u => u.username === req.body.username);
    if(user) user.rating += 10;
    await saveDB(); res.json({success: true});
});

// CHATS (Base64)
app.get('/api/messages/:u1/:u2', (req, res) => {
    const { u1, u2 } = req.params;
    const chat = db.chats.filter(c => (c.from === u1 && c.to === u2) || (c.from === u2 && c.to === u1));
    res.json(chat);
});

app.post('/api/messages', async (req, res) => {
    const msg = { ...req.body, text: Buffer.from(req.body.text).toString('base64'), time: Date.now() };
    db.chats.push(msg);
    await saveDB(); res.json({success: true});
});

// ADMIN
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASS) res.json({users: db.users, chats: db.chats});
    else res.status(403).send();
});

app.get('*', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.listen(3000);
