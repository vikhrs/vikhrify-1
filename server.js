import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { join } from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Пути к файлам — используем import.meta.dirname
const USERS_FILE    = join(import.meta.dirname, 'users.json');
const POSTS_FILE    = join(import.meta.dirname, 'posts.json');
const MESSAGES_FILE = join(import.meta.dirname, 'messages.json');

let users = [];
let posts = [];
let messages = [];

async function loadData() {
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch {
    users = [];
  }

  try {
    posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8'));
  } catch {
    posts = [];
  }

  try {
    messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8'));
  } catch {
    messages = [];
  }

  // Миграция старых данных (если нужно)
  users.forEach(u => {
    u.followers     = u.followers     ?? [];
    u.following     = u.following     ?? [];
    u.premiumLevel  = Number(u.premiumLevel) || 0;
    u.notifications = u.notifications ?? [];
  });
}

async function saveData() {
  try {
    await fs.writeFile(USERS_FILE,    JSON.stringify(users,    null, 2));
    await fs.writeFile(POSTS_FILE,    JSON.stringify(posts,    null, 2));
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error('Ошибка сохранения данных:', err.message);
  }
}

await loadData();

console.log('Данные загружены, сервер стартует...');

// Статические файлы
app.get('/', (req, res) => {
  res.sendFile(join(import.meta.dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(import.meta.dirname, 'admin.html'));
});

// ────────────────────────────────────────────────
// Регистрация
app.post('/api/register', async (req, res) => {
  const { name, username, password, ref } = req.body || {};
  if (!name?.trim()  !username?.trim()  !password?.trim()) {
    return res.status(400).json({ error: 'Заполните имя, юзернейм и пароль' });
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

  // рефералка
  if (ref) {
    const referrer = users.find(u => u.username === ref.trim().toLowerCase().replace(/^@/, ''));
    if (referrer && referrer.id !== newUser.id) {
      referrer.balance = (referrer.balance || 0) + 50;
    }
  }

  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

// ────────────────────────────────────────────────
// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// ────────────────────────────────────────────────
// Остальные эндпоинты (пример — добавь свои по аналогии)
app.get('/api/me/:id', (req, res) => {
  const u = users.find(u => u.id === Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ...u, password: undefined });
});

app.get('/api/posts', (req, res) => res.json(posts));

app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const author = users.find(u => u.id === userId);
  if (!author) return res.status(404).json({ error: 'Автор не найден' });
  const post = {
    id: posts.length + 1,
    userId,
    username: author.username,
    name: author.name,
    avatar: author.avatar,
    content: content?.trim() || '',
    image: image || null,
    createdAt: new Date().toISOString(),
    isVerified: author.isVerified,
    premiumLevel: author.premiumLevel
  };

  posts.push(post);
  await saveData();
  res.json(post);
});

// Добавь сюда все остальные роуты из твоего предыдущего кода:
// /api/follow, /api/unfollow, /api/chats, /api/messages/:partnerId,
// /api/send-message, /api/buy-vxr, /api/buy-premium, /api/notifications,
// /api/search/users, /api/user/:id, админ-роуты и т.д.

// Пример заглушки для остальных — чтобы не падал
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(Вихрифай запущен → порт ${PORT});
});
