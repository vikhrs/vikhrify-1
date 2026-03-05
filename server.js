import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fs from 'fs/promises';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// PLATEGA API
const MERCHANT_ID = '3c9dcc6a-7f95-45a2-a374-47dfb1df140d';
const API_KEY = 'mp6SdAwTeiJWsYVHH5yNqcxgCqSp2lsXkkuuE9DJpjjtcT6uMN6kTsraGxG5pbiGncKTwbDpd4E6qoAzPF9wZRNXneGlEXifNpFm';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const USERS_FILE = join(__dirname, 'users.json');
const POSTS_FILE = join(__dirname, 'posts.json');

let users = [];
let posts = [];

async function loadData() {
  try { users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); } catch (e) { users = []; }
  try { posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8')); } catch (e) { posts = []; }
}
async function saveData() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}
await loadData();

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// Регистрация
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body;
  const cleanUser = username?.toLowerCase().trim();
  if (users.find(u => u.username === cleanUser)) return res.status(400).json({ error: 'Логин занят' });

  const newUser = {
    id: Date.now(),
    name: name.trim(),
    username: cleanUser,
    password,
    avatar: 'https://via.placeholder.com/150?text=User',
    balance: 0,
    isVerified: false
  };
  users.push(newUser);
  await saveData();
  res.json({ success: true });
});

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username?.toLowerCase().trim() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user });
});

// Посты
app.get('/api/posts', (req, res) => res.json(posts));
app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.sendStatus(404);
  
  posts.push({
    id: Date.now(),
    userId,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    isVerified: user.isVerified,
    content,
    image,
    createdAt: new Date()
  });
  await saveData();
  res.json({ success: true });
});

app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  res.json(user || {});
});

// --- ПЛАТЕЖИ ---
app.post('/api/create-payment', async (req, res) => {
  const { userId, amount, type, color } = req.body;
  try {
    const response = await fetch('https://api.platega.io/v1/payment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: amount,
        currency: 'RUB',
        order_id: `VXR_${Date.now()}`,
        description: `Vikhrify: ${type}`,
        metadata: { userId, type, color },
        success_url: `http://${req.get('host')}/`
      })
    });
    const data = await response.json();
    res.json({ url: data.payment_url });
  } catch (e) { res.status(500).json({ error: 'API Error' }); }
});

// Вебхук
app.post('/api/platega-webhook', async (req, res) => {
  const { status, metadata, amount } = req.body;
  if (status === 'success') {
    const user = users.find(u => u.id === Number(metadata.userId));
    if (user) {
      if (metadata.type === 'vxr') user.balance += Number(amount);
      else if (metadata.type === 'premium') user.isVerified = metadata.color;
      await saveData();
    }
  }
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Vikhrify запущен на порту ${PORT}`));
