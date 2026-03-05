import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const dirname = dirname(filename);  // ← это ОК, но если ошибка — удали и используй import.meta.dirname ниже

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
  } catch (e) {
    console.log('users.json не найден или пустой → создаём новый');
    users = [];
  }
  try {
    posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8'));
  } catch (e) {
    posts = [];
  }
  try {
    messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8'));
  } catch (e) {
    messages = [];
  }

  // Миграция полей
  users.forEach(u => {
    if (!u.followers) u.followers = [];
    if (!u.following) u.following = [];
    if (typeof u.premiumLevel !== 'number') u.premiumLevel = 0;
    if (!u.notifications) u.notifications = [];
  });
}

async function saveData() {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error('Ошибка сохранения данных:', err);
  }
}

await loadData();

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// Регистрация и логин (без изменений)
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
    premiumLevel: 0,
    isVerified: false,
    isBlocked: false,
    followers: [],
    following: [],
    notifications: []
  };
  users.push(newUser);

  // Рефералка
  if (ref) {
    const refUser = users.find(u => u.username === ref.trim().toLowerCase().replace('@', ''));
    if (refUser && refUser.id !== newUser.id) {
      refUser.balance += 50;
    }
  }

  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// Остальные эндпоинты (без изменений, но с try-catch где нужно)
app.get('/api/me/:id', (req, res) => {
  const u = users.find(u => u.id === Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Не найден' });
  res.json({ ...u, password: undefined });
});

// ... (все остальные роуты остаются как были: /api/posts, /api/follow, /api/chats и т.д.)

// Админ (без изменений)

app.listen(PORT, () => {
  console.log(Vikhrify запущен на порту ${PORT});
});
