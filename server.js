import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const dirname = dirname(filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');
const MESSAGES_FILE = join(__dirname, 'messages.json');

let users = [];
let posts = [];
let messages = [];

async function loadData() {
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch (e) { users = []; }
  try {
    posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8'));
  } catch (e) { posts = []; }
  try {
    messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8'));
  } catch (e) { messages = []; }
}

async function saveData() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

await loadData();

// Главная
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// Админ
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// Регистрация
app.post('/api/register', async (req, res) => {
  const { name, username, password, ref } = req.body || {};

  if (!name?.trim()  !username?.trim()  !password?.trim()) {
    return res.status(400).json({ error: 'Заполни имя, юзернейм и пароль' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (users.some(u => u.username === cleanUsername)) {
    return res.status(409).json({ error: 'Юзернейм занят' });
  }

  const newUser = {
    id: users.length + 1,
    name: name.trim(),
    username: cleanUsername,
    password,
    avatar: 'https://via.placeholder.com/150?text=User',
    balance: 0,
    premium: 'none', // none, blue, yellow, red
    isBlocked: false
  };

  if (ref) {
    const referrer = users.find(u => u.username === ref.toLowerCase());
    if (referrer && referrer.id !== newUser.id) {
      newUser.balance += 50;
      referrer.balance += 50;
    }
  }

  users.push(newUser);
  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password && !u.isBlocked);
  if (!user) return res.status(401).json({ error: 'Неверные данные или заблокирован' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// Профиль
app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Не найден' });
  res.json({ ...user, password: undefined });
});

app.patch('/api/profile', async (req, res) => {
  const { id, name, avatar } = req.body;
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Не найден' });

  if (name?.trim()) user.name = name.trim();
  if (avatar) user.avatar = avatar;

  await saveData();
  res.json({ ...user, password: undefined });
});

// Купить премиум
app.post('/api/buy-premium', async (req, res) => {
  const { userId, level } = req.body;
  const costs = { blue: 299, yellow: 499 };
  const cost = costs[level];
  if (!cost) return res.status(400).json({ error: 'Неверный уровень' });

  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  if (user.balance < cost) return res.status(400).json({ error: 'Недостаточно VXR' });

  user.balance -= cost;
  user.premium = level;
  await saveData();
  res.json({ success: true });
});

// Посты
app.get('/api/posts', (req, res) => res.json(posts));
app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user || user.isBlocked) return res.status(403).json({ error: 'Доступ запрещён' });

  const post = {
    id: posts.length + 1,
    userId,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    premium: user.premium,
    content: content.trim(),
    image: image || null,
    createdAt: new Date().toISOString()
  };

  posts.push(post);
  await saveData();
  res.json(post);
});

// Поиск юзеров
app.get('/api/search-users', (req, res) => {
  const q = req.query.q?.toLowerCase() || '';
  const results = users.filter(u => u.username.includes(q) && !u.isBlocked).map(u => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar }));
  res.json(results);
});

// Сообщения
app.get('/api/messages', (req, res) => {
  const { userId, toId } = req.query;
  const msgs = messages.filter(m => 
    (m.fromId === Number(userId) && m.toId === Number(toId)) || 
    (m.fromId === Number(toId) && m.toId === Number(userId))
  ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(msgs);
});

app.post('/api/messages', async (req, res) => {
  const { fromId, toId, content } = req.body;
  const fromUser = users.find(u => u.id === fromId);
  const toUser = users.find(u => u.id === toId);
  if (!fromUser  !toUser  fromUser.isBlocked) return res.status(403).json({ error: 'Доступ запрещён' });

  const msg = {
    id: messages.length + 1,
    fromId,
    toId,
    content: content.trim(),
    createdAt: new Date().toISOString()
  };

  messages.push(msg);
  await saveData();
  res.json(msg);
});

// Админ
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'] || req.query.pass;
  if (pass !== ADMIN_PASS) return res.status(403).json({ error: 'Доступ запрещён' });
  next();
}

app.get('/api/admin/stats', checkAdmin, (req, res) => {
  res.json({
    usersCount: users.length,
    postsCount: posts.length,
    msgsCount: messages.length
  });
});

app.get('/api/admin/users', checkAdmin, (req, res) => {
  res.json(users.map(u => ({ ...u, password: undefined })));
});

app.patch('/api/admin/user', checkAdmin, async (req, res) => {
  const { id, balance, premium, isBlocked } = req.body;

  const user = users.find(u => u.id === Number(id));
  if (!user) return res.status(404).json({ error: 'Не найден' });

  if (balance !== undefined) user.balance = Number(balance);
  if (premium !== undefined) user.premium = premium;
  if (isBlocked !== undefined) user.isBlocked = Boolean(isBlocked);

  await saveData();
  res.json({ success: true });
});

app.listen(PORT, () => console.log(Сервер на ${PORT}));
