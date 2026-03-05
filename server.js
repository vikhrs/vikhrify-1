import express from 'express';
import fs from 'fs/promises';
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

const DB_FILE = './db.json';
let db = { users: [], posts: [], chats: [] };

const load = async () => { try { db = JSON.parse(await fs.readFile(DB_FILE, 'utf8')); } catch { await save(); } };
const save = async () => await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
await load();

app.post('/api/auth', async (req, res) => {
    const { username, password, name, type } = req.body;
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).send('LatOnly');
    
    if (type === 'reg') {
        if(db.users.find(u => u.username === username)) return res.status(400).send('Taken');
        db.users.push({ id: Date.now(), username, password, name, avatar: '', badge: false, following: [] });
        await save(); res.json({ok: true});
    } else {
        const u = db.users.find(u => u.username === username && u.password === password);
        u ? res.json(u) : res.status(401).send();
    }
});

app.get('/api/data', (req, res) => res.json(db));
app.post('/api/post', async (req, res) => { db.posts.push(req.body); await save(); res.json({ok:1}); });
app.listen(3000);
