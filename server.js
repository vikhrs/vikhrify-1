import express from 'express';
import fs from 'fs/promises';
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

const DB_FILE = './database.json';
let db = { users: [], posts: [], chats: [] };

async function load() { try { db = JSON.parse(await fs.readFile(DB_FILE, 'utf8')); } catch {} }
async function save() { await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2)); }
await load();

app.post('/api/auth', async (req, res) => {
    const { username, password, name, type } = req.body;
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).send('Bad username');
    
    if (type === 'reg') {
        if (db.users.find(u => u.username === username)) return res.status(400).send('Exists');
        const user = { username, password, name, avatar: '' };
        db.users.push(user); await save(); res.json(user);
    } else {
        const user = db.users.find(u => u.username === username && u.password === password);
        user ? res.json(user) : res.status(401).send();
    }
});

app.post('/api/profile', async (req, res) => {
    const u = db.users.find(x => x.username === req.body.username);
    if(u) {
        if(req.body.name) u.name = req.body.name;
        if(req.body.avatar) u.avatar = req.body.avatar;
        if(req.body.password) u.password = req.body.password;
        await save(); res.json(u);
    }
});

app.get('/api/posts', (req, res) => res.json(db.posts.reverse()));
app.post('/api/posts', async (req, res) => { db.posts.push(req.body); await save(); res.json({ok:1}); });
app.post('/api/admin', (req, res) => {
    req.body.password === 'sehpy9-qiqjux-hofgyN' ? res.json(db) : res.status(403).send();
});
app.listen(3000);
