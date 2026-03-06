import express from 'express';
import fs from 'fs/promises';
const app = express();
app.use(express.json());
app.use(express.static('.'));

const DB = './db.json';
let db = { users: [], posts: [], chats: [] };
const load = async () => { try { db = JSON.parse(await fs.readFile(DB, 'utf8')); } catch { await save(); } };
const save = async () => await fs.writeFile(DB, JSON.stringify(db, null, 2));
await load();

app.post('/api/auth', async (req, res) => {
    const { username, password, name, type } = req.body;
    if (type === 'reg') {
        if(db.users.find(u => u.username === username)) return res.status(409).send('Occupied');
        db.users.push({ id: Date.now(), username, password, name, badge: false, rating: 0 });
        await save(); res.json({status: 'ok'});
    } else {
        const u = db.users.find(u => u.username === username && u.password === password);
        u ? res.json(u) : res.status(401).send('AuthFailed');
    }
});

app.get('/api/data', (req, res) => res.json(db));
app.listen(3000);
