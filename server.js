import express from 'express';
import fs from 'fs/promises';
const app = express();
app.use(express.json());
app.use(express.static('.'));

const DB_FILE = './db.json';
let db = { users: [], posts: [], chats: [] };

async function load() { 
    try { db = JSON.parse(await fs.readFile(DB_FILE, 'utf8')); } 
    catch { await save(); } 
}
async function save() { await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2)); }
await load();

app.post('/api/auth', async (req, res) => {
    const { username, password, name, type } = req.body;
    if (type === 'reg') {
        if(db.users.find(u => u.username === username)) return res.status(409).send('Occupied');
        db.users.push({ id: Date.now(), username, password, name, badge: false, rating: 0, blocked: false });
        await save(); res.json({status: 'ok'});
    } else {
        const u = db.users.find(u => u.username === username && u.password === password);
        u && !u.blocked ? res.json(u) : res.status(401).send('AuthFailed');
    }
});

app.post('/api/admin', async (req, res) => {
    if (req.body.pass !== 'admin-secret-key') return res.status(403).send();
    if (req.body.action === 'stats') res.json({ users: db.users.length, posts: db.posts.length });
    if (req.body.action === 'ban') {
        const u = db.users.find(x => x.id == req.body.uid);
        if(u) u.blocked = !u.blocked; await save(); res.json(db);
    }
    if (req.body.action === 'badge') {
        const u = db.users.find(x => x.id == req.body.uid);
        if(u) u.badge = !u.badge; await save(); res.json(db);
    }
});

app.get('/api/data', (req, res) => res.json(db));
app.listen(3000, () => console.log('Vikhrify Server online'));
