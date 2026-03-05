import express from 'express';
import fs from 'fs/promises';
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

const DB = './db.json';
let db = { users: [], posts: [], chats: [] };

const load = async () => { try { db = JSON.parse(await fs.readFile(DB, 'utf8')); } catch { await save(); } };
const save = async () => await fs.writeFile(DB, JSON.stringify(db, null, 2));
await load();

app.post('/api/auth', async (req, res) => {
    const { username, password, name, type } = req.body;
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).send('Only English');
    if (type === 'reg') {
        if(db.users.find(u => u.username === username)) return res.status(400).send('Taken');
        db.users.push({ id: Date.now(), username, password, name, badge: false, blocked: false });
        await save(); res.json({ok: true});
    } else {
        const u = db.users.find(u => u.username === username && u.password === password);
        u && !u.blocked ? res.json(u) : res.status(401).send();
    }
});

app.post('/api/admin', async (req, res) => {
    if (req.body.pass !== 'sehpy9-qiqjux-hofgyN') return res.status(403).send();
    if (req.body.act === 'ban') db.users.find(u => u.id == req.body.uid).blocked = !db.users.find(u => u.id == req.body.uid).blocked;
    if (req.body.act === 'badge') db.users.find(u => u.id == req.body.uid).badge = !db.users.find(u => u.id == req.body.uid).badge;
    await save(); res.json(db);
});

app.get('/api/data', (req, res) => res.json(db));
app.post('/api/post', async (req, res) => { db.posts.push(req.body); await save(); res.json({ok:1}); });
app.listen(3000);
