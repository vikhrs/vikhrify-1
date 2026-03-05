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

const FILES = { users: 'users.json', posts: 'posts.json', chats: 'chats.json' };
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

// API
app.get('/api/search', (req, res) => res.json(db.users.filter(u => u.username.includes(req.query.q))));
app.get('/api/user', (req, res) => res.json(db.users.find(u => u.username === req.query.username)));
app.post('/api/follow', async (req, res) => {
    const me = db.users.find(u => u.id == req.body.myId);
    if (me.following.includes(req.body.targetUsername)) me.following = me.following.filter(x => x !== req.body.targetUsername);
    else me.following.push(req.body.targetUsername);
    await save(); res.json({success: true});
});
app.post('/api/message', async (req, res) => {
    db.chats.push({ ...req.body, time: Date.now() });
    await save(); res.json({success: true});
});
app.post('/api/admin/login', (req, res) => req.body.password === ADMIN_PASS ? res.json({success: true, users: db.users}) : res.status(403).send());
app.post('/api/admin/update', async (req, res) => {
    const u = db.users.find(x => x.id == req.body.userId);
    if(u && req.body.password === ADMIN_PASS) { u.balance = req.body.balance; await save(); res.json({success:true}); }
});

app.listen(PORT);
