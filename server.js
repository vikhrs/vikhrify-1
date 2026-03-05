import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Сначала создаем приложение
const app = express();
const PORT = process.env.PORT || 3000;

// Константы
const MERCHANT_ID = '3c9dcc6a-7f95-45a2-a374-47dfb1df140d';
const API_KEY = 'mp6SdAwTeiJWsYVHH5yNqcxgCqSp2lsXkkuuE9DJpjjtcT6uMN6kTsraGxG5pbiGncKTwbDpd4E6qoAzPF9wZRNXneGlEXifNpFm';
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';

// 2. Настраиваем middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');
const MSGS_FILE = join(__dirname, 'messages.json');

let users = [];
let posts = [];
let messages = [];

// Загрузка данных
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

// 3. Теперь прописываем все пути (Routes)
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// API Пользователей
app.get('/api/user/:username', (req, res) => {
  const u = users.find(x => x.username === req.params.username.toLowerCase());
  if(!u) return res.status(404).json({error: 'Не найден'});
  const { password, ...safeData } = u;
  res.json(safeData);
});

app.post('/api/subscribe', async (req, res) => {
  const { me, target } = req.body;
  const targetUser = users.find(u => u.username === target);
  if(!targetUser) return res.sendStatus(404);
  
  if(!targetUser.followerList) targetUser.followerList = [];
  const index = targetUser.followerList.indexOf(me);
  
  if(index === -1) {
    targetUser.followerList.push(me);
    targetUser.followers = (targetUser.followers || 0) + 1;
  } else {
    targetUser.followerList.splice(index, 1);
    targetUser.followers = Math.max(0, (targetUser.followers || 0) - 1);
  }
  await saveData();
  res.json({ success: true });
});

app.post('/api/register', async (req, res) => {
  const { name, username, password, ref } = req.body;
  const userLow = username.toLowerCase().trim();
  if(users.find(u => u.username === userLow)) return res.json({error: 'Логин занят'});

  const newUser = {
    id: Date.now(),
    name,
    username: userLow,
    password,
    avatar: 'https://via.placeholder.com/150',
    balance: 0,
    isVerified: false,
    isBlocked: false,
    followers: 0,
    followerList: []
  };

  if(ref) {
    const inviter = users.find(u => u.username === ref.toLowerCase());
    if(inviter) {
        inviter.balance = (inviter.balance || 0) + 50;
    }
  }

  users.push(newUser);
  await saveData();
  res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username.toLowerCase() && u.password === password);
  if(!user) return res.json({error: 'Неверный логин или пароль'});
  if(user.isBlocked) return res.json({error: 'Ваш аккаунт заблокирован'});
  res.json({ success: true, user });
});

app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  res.json(user || {});
});

// Посты
app.get('/api/posts', (req, res) => res.json(posts));
app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const user = users.find(u => u.id === userId);
  if(!user) return res.sendStatus(404);
  posts.push({ 
    id: Date.now(), 
    userId, 
    content, 
    image, 
    username: user.username, 
    name: user.name, 
    avatar: user.avatar, 
    isVerified: user.isVerified, 
    createdAt: new Date() 
  });
  await saveData();
  res.json({ success: true });
});

// Чаты
app.get('/api/messages', (req, res) => {
  const { me, other } = req.query;
  const filtered = messages.filter(m => (m.from === me && m.to === other) || (m.from === other && m.to === me));
  res.json(filtered);
});

app.post('/api/messages', async (req, res) => {
  const { from, to, text } = req.body;
  messages.push({ from, to, text, date: new Date() });
  await saveData();
  res.json({ success: true });
});

app.get('/api/my-chats', (req, res) => {
  const { user } = req.query;
  const partners = new Set();
  messages.forEach(m => {
    if(m.from === user) partners.add(m.to);
    if(m.to === user) partners.add(m.from);
  });
  res.json(Array.from(partners));
});

// Платежи Platega
app.post('/api/create-payment', async (req, res) => {
  const { userId, amount, type, color } = req.body;
  try {
    const response = await fetch('https://api.platega.io/v1/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ 
        merchant_id: MERCHANT_ID, 
        amount, 
        currency: 'RUB', 
        order_id: `VXR_${Date.now()}`, 
        metadata: { userId, type, color } 
      })
    });
    const data = await response.json();
    res.json({ url: data.payment_url });
  } catch(e) { res.status(500).json({error: 'Ошибка платежной системы'}); }
});

// Админка
const checkAdmin = (req, res, next) => {
  if(req.headers['x-admin-pass'] !== ADMIN_PASS) return res.sendStatus(403);
  next();
};

app.get('/api/admin/users', checkAdmin, (req, res) => res.json(users));
app.get('/api/admin/stats', checkAdmin, (req, res) => res.json({ usersCount: users.length, postsCount: posts.length }));
app.patch('/api/admin/user', checkAdmin, async (req, res) => {
  const { id, ...data } = req.body;
  const u = users.find(x => x.id === id);
  if(u) Object.assign(u, data);
  await saveData();
  res.json({success:true});
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
