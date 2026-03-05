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
    const { username, password, type } = req.body;
    if (type === 'reg') {
        if(db.users.find(u => u.username === username)) return res.status(400).send();
        db.users.push({ id: Date.now(), username, password, name: username, badge: '', blocked: false });
        await save(); res.json({ok: true});
    } else {
        const u = db.users.find(u => u.username === username && u.password === password);
        u && !u.blocked ? res.json(u) : res.status(403).send();
    }
});
// ... остальные роуты (admin, posts, chats) такие же, как были ...
app.listen(3000);
