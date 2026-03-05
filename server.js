import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN'; // Твой пароль

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');
const MSGS_FILE = join(__dirname, 'messages.json');

let users = [], posts = [], messages = [];

async function load() {
    try { users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); } catch(e) {}
    try { posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8')); } catch(e) {}
    try { messages = JSON.parse(await fs.readFile(MSGS_FILE, 'utf8')); } catch(e) {}
}
async function save() {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
    await fs.writeFile(MSGS_FILE, JSON.stringify(messages, null, 2));
}
await load();

// --- ПУБЛИЧНЫЕ РОУТЫ ---
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const lowUser = username.toLowerCase().trim();
    if(users.find(u => u.username === lowUser)) return res.json({error: 'Логин занят'});
    const newUser = { id: Date.now(), name, username: lowUser, password, balance:0, followers:0, avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isVerified: false, isBlocked: false };
    users.push(newUser); await save();
    res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const u = users.find(u => u.username === username.toLowerCase() && u.password === password);
    if(!u) return res.json({error: 'Неверные данные'});
    if(u.isBlocked) return res.json({error: 'Ваш аккаунт ЗАБЛОКИРОВАН'});
    res.json({ success: true, user: u });
});

// --- ЛЕНТА И ЧАТЫ ---
app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/posts/new', (req, res) => {
    const after = Number(req.query.after) || 0;
    res.json(posts.filter(p => p.id > after));
});
app.post('/api/posts', async (req, res) => {
    const { userId, content, image } = req.body;
    const u = users.find(u => u.id === userId);
    const newPost = { id: Date.now(), userId, content, image, username: u.username, name: u.name, avatar: u.avatar, isVerified: u.isVerified };
    posts.push(newPost); await save();
    res.json({ success: true });
});

app.get('/api/messages', (req, res) => {
    const { me, other } = req.query;
    res.json(messages.filter(m => (m.from===me && m.to===other) || (m.from===other && m.to===me)));
});
app.post('/api/messages', async (req, res) => {
    const { from, to, text } = req.body;
    messages.push({ from, to, text, date: new Date() }); await save();
    res.json({ success: true });
});

// --- АДМИНКА (ШПИОНАЖ) ---
const checkAdmin = (req, res, next) => {
    if(req.headers['x-admin-pass'] !== ADMIN_PASS) return res.sendStatus(403);
    next();
};
app.get('/api/admin/users', checkAdmin, (req, res) => res.json(users));
app.patch('/api/admin/user', checkAdmin, async (req, res) => {
    const { id, ...data } = req.body;
    const u = users.find(x => x.id === id);
    if(u) Object.assign(u, data);
    await save(); res.json({success:true});
});
app.get('/api/admin/user-messages', checkAdmin, (req, res) => {
    const { username } = req.query;
    res.json(messages.filter(m => m.from === username || m.to === username));
});
app.post('/api/admin/clear-all-posts', checkAdmin, async (req, res) => {
    posts = []; await save(); res.json({success:true});
});

app.listen(PORT, () => console.log('Vikhrify Server Running'));
