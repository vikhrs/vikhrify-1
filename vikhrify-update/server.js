import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // для base64 фото

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');

let users = [];
let posts = [];

async function loadData() {
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch (e) {
    users = [];
  }
  try {
    posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8'));
  } catch (e) {
    posts = [];
  }
}

async function saveData() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}

await loadData();

// ─── Страницы ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin.html'));
});

// ─── Регистрация ───────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body || {};

  if (!name?.trim() || !username?.trim() || !password?.trim()) {
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
    isPremium: false,
    isVerified: false,
    isBlocked: false
  };

  users.push(newUser);
  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

// ─── Логин ─────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Неверные данные' });
  }
  res.json({ success: true, user: { ...user, password: undefined } });
});

// ─── Профиль ───────────────────────────────────────────────────────
app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ...user, password: undefined });
});

// ─── Обновление профиля (имя и аватар) ─────────────────────────────
app.patch('/api/profile', async (req, res) => {
  const { id, name, avatar } = req.body;
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (name?.trim()) user.name = name.trim();
  if (avatar) user.avatar = avatar;

  await saveData();
  res.json({ ...user, password: undefined });
});

// ─── Посты ─────────────────────────────────────────────────────────
app.get('/api/posts', (req, res) => res.json(posts));

app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const post = {
    id: posts.length + 1,
    userId,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    content: content.trim(),
    image: image || null,
    createdAt: new Date().toISOString()
  };

  posts.push(post);
  await saveData();
  res.json(post);
});

// ─── Админ ─────────────────────────────────────────────────────────
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'] || req.query.pass;
  if (pass !== ADMIN_PASS) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

app.get('/api/admin/stats', checkAdmin, (req, res) => {
  res.json({
    usersCount: users.length,
    postsCount: posts.length
  });
});

app.get('/api/admin/users', checkAdmin, (req, res) => {
  res.json(users);
});

app.patch('/api/admin/user', checkAdmin, async (req, res) => {
  const { id, balance, isVerified, isBlocked } = req.body;

  const user = users.find(u => u.id === Number(id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (balance !== undefined) user.balance = Number(balance);
  if (isVerified !== undefined) user.isVerified = Boolean(isVerified);
  if (isBlocked !== undefined) user.isBlocked = Boolean(isBlocked);

  await saveData();
  res.json({ success: true, updatedUser: user });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
