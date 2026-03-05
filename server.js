import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

app.use(cors());
app.use(express.json({ limit: '15mb' })); // Увеличил лимит для фото

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');
const MSGS_FILE = join(__dirname, 'messages.json');

let users = [], posts = [], messages = [];

async function loadData() {
    try { users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); } catch(e) { users = []; }
    try { posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8')); } catch(e) { posts = []; }
    try { messages = JSON.parse(await fs.readFile(MSGS_FILE, 'utf8')); } catch(e) { messages = []; }
}
async function saveData() {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
    await fs.writeFile(MSGS_FILE, JSON.stringify(messages, null, 2));
}
await loadData();

// Роуты
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const userLow = username.toLowerCase().trim();
    if (users.find(u => u.username === userLow)) return res.json({ success: false, error: 'Логин занят' });

    const newUser = {
        id: Date.now(),
        name: name || username,
        username: userLow,
        password,
        avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        balance: 0,
        isVerified: false,
        followers: 0,
        followerList: []
    };
    users.push(newUser);
    await saveData();
    res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username.toLowerCase() && u.password === password);
    if (!user) return res.json({ success: false, error: 'Неверный логин или пароль' });
    res.json({ success: true, user });
});

app.post('/api/profile/update', async (req, res) => {
    const { id, name, avatar } = req.body;
    const u = users.find(x => x.id === Number(id));
    if (u) {
        if (name) u.name = name;
        if (avatar) u.avatar = avatar; // Теперь сохраняем Base64 строку картинки
        
        posts.forEach(p => {
            if (p.userId === u.id) {
                p.name = u.name;
                p.avatar = u.avatar;
            }
        });
        await saveData();
    }
    res.json({ success: true });
});

app.get('/api/me/:id', (req, res) => {
    res.json(users.find(u => u.id === Number(req.params.id)) || {});
});

app.get('/api/posts', (req, res) => res.json(posts));
app.post('/api/posts', async (req, res) => {
    const { userId, content, image } = req.body;
    const user = users.find(u => u.id === userId);
    posts.push({ id: Date.now(), userId, content, image, username: user.username, name: user.name, avatar: user.avatar, isVerified: user.isVerified });
    await saveData();
    res.json({ success: true });
});

// Админка (накрутка)
app.patch('/api/admin/user', async (req, res) => {
    if (req.headers['x-admin-pass'] !== ADMIN_PASS) return res.sendStatus(403);
    const { id, ...data } = req.body;
    const u = users.find(x => x.id === id);
    if (u) Object.assign(u, data);
    await saveData();
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server started on ${PORT}`));
