import express from 'express';
import fs from 'fs/promises';
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

let db = { users: [], posts: [], chats: [] };
const load = async () => { try { db = JSON.parse(await fs.readFile('./db.json', 'utf8')); } catch {} };
const save = async () => await fs.writeFile('./db.json', JSON.stringify(db));
await load();

app.post('/api/auth', async (req, res) => {
    const { username, password, name, type } = req.body;
    if (type === 'reg') {
        if (db.users.find(u => u.username === username)) return res.status(400).send();
        db.users.push({ id: Date.now(), username, password, name, badge: '', blocked: false });
        await save(); res.json({ ok: true });
    } else {
        const u = db.users.find(u => u.username === username && u.password === password);
        if (!u || u.blocked) return res.status(403).send();
        res.json(u);
    }
});

app.post('/api/admin', async (req, res) => {
    if (req.body.pass !== 'sehpy9-qiqjux-hofgyN') return res.status(403).send();
    if (req.body.action === 'ban') {
        const u = db.users.find(x => x.id == req.body.uid);
        u.blocked = !u.blocked; await save();
    }
    if (req.body.action === 'badge') {
        const u = db.users.find(x => x.id == req.body.uid);
        u.badge = u.badge ? '' : 'red'; await save();
    }
    res.json(db);
});

app.listen(3000);
