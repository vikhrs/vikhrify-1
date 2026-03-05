// server.js — рабочий вариант без конфликтов ESM

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Пути к файлам — самый надёжный способ без import.meta
const rootDir = path.dirname(process.argv[1]);
const USERS_FILE    = path.join(rootDir, 'users.json');
const POSTS_FILE    = path.join(rootDir, 'posts.json');
const MESSAGES_FILE = path.join(rootDir, 'messages.json');

let users = [];
let posts = [];
let messages = [];

async function loadData() {
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch (e) {
    console.log('users.json не найден, создаём пустой');
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

  users.forEach(u => {
    u.followers     = u.followers     || [];
    u.following     = u.following     || [];
    u.premiumLevel  = u.premiumLevel  || 0;
    u.notifications = u.notifications || [];
  });
}

async function saveData() {
  try {
    await fs.writeFile(USERS_FILE,    JSON.stringify(users, null, 2));
    await fs.writeFile(POSTS_FILE,    JSON.stringify(posts, null, 2));
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error('Ошибка сохранения:', err.message);
  }
}

loadData().then(() => {
  console.log('Данные загружены');
}).catch(err => {
  console.error('Ошибка загрузки данных:', err);
});

// Статические файлы
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(rootDir, 'admin.html'));
});

// ────────────────────────────────────────────────
// РЕГИСТРАЦИЯ — ничего не трогал, оставил как было
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

  if (ref) {
    const refUsername = ref.trim().toLowerCase().replace('@','');
    const refUser = users.find(u => u.username === refUsername);
    if (refUser && refUser.id !== newUser.id) {
      refUser.balance = (refUser.balance || 0) + 50;
    }
  }

  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

// ────────────────────────────────────────────────
// ЛОГИН — тоже ничего не менял
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// Добавь сюда свои остальные роуты (posts, follow, chats и т.д.)
// Пока оставил только базовые, чтобы сервер запустился

app.listen(PORT, () => {
  console.log(Сервер запущен на порту ${PORT});
});
