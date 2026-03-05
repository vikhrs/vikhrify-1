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
  try { users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); } catch (e) { users = []; }
  try { posts = JSON.parse(await fs.readFile(POSTS_FILE, 'utf8')); } catch (e) { posts = []; }
  try { messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8')); } catch (e) { messages = []; }

  // Миграция старых данных
  users.forEach(u => {
    if (!u.following) u.following = [];
    if (!u.followers) u.followers = [];
    if (!u.notifications) u.notifications = [];
    if (typeof u.premiumLevel === 'undefined') u.premiumLevel = 0;
    if (typeof u.followersCount === 'undefined') u.followersCount = u.followers.length;
    if (typeof u.followingCount === 'undefined') u.followingCount = u.following.length;
  });
}

async function saveData() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

await loadData();

// Страницы
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// === РЕГИСТРАЦИЯ (реф +50 WXR) ===
app.post('/api/register', async (req, res) => {
  const { name, username, password, ref } = req.body || {};
  if (!name?.trim()  !username?.trim()  !password?.trim()) {
    return res.status(400).json({ error: 'Заполни все поля' });
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
    following: [], followingCount: 0,
    followers: [], followersCount: 0,
    notifications: [],
    isVerified: false,
    isBlocked: false
  };

  users.push(newUser);

  // Рефералка
  if (ref) {
    const referrer = users.find(u => u.username === ref.trim().toLowerCase());
    if (referrer && referrer.id !== newUser.id) {
      referrer.balance = (referrer.balance || 0) + 50;
    }
  }

  await saveData();
  res.json({ success: true, user: { ...newUser, password: undefined } });
});

// Логин (без изменений)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = username?.trim().toLowerCase();
  const user = users.find(u => u.username === cleanUsername && u.password === password);
  if (!user) return res.status(401).json({ error: 'Неверные данные' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// Остальные API (me, profile, posts — без изменений + новые)
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

app.get('/api/posts', (req, res) => res.json(posts));
app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Не найден' });

  const post = {
    id: posts.length + 1,
    userId,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    premiumLevel: user.premiumLevel || 0,
    content: content.trim(),
    image: image || null,
    createdAt: new Date().toISOString()
  };
  posts.push(post);
  await saveData();
  res.json(post);
});

// Новые API
app.get('/api/user/:id', (req, res) => {
  const u = users.find(x => x.id === Number(req.params.id));
  if (!u) return res.status(404).json({error:'Не найден'});
  res.json({...u, password:undefined, following:undefined, notifications:undefined});
});

app.post('/api/follow', async (req, res) => {
  const {fromId, targetId} = req.body;
  const from = users.find(u=>u.id==fromId);
  const target = users.find(u=>u.id==targetId);
  if (!from  !target  from.id==target.id) return res.status(400).json({error:'Ошибка'});
  if (!from.following.includes(target.id)) {
    from.following.push(target.id);
    from.followingCount = (from.followingCount||0) + 1;
    target.followers.push(from.id);
    target.followersCount = (target.followersCount||0) + 1;

    target.notifications.push({
      id: Date.now(),
      type: 'follow',
      fromId: from.id,
      fromName: from.name,
      fromUsername: from.username,
      time: new Date().toISOString(),
      read: false
    });
  }
  await saveData();
  res.json({success:true});
});

app.post('/api/unfollow', async (req, res) => {
  const {fromId, targetId} = req.body;
  const from = users.find(u=>u.id==fromId);
  const target = users.find(u=>u.id==targetId);
  if (from && target) {
    from.following = from.following.filter(id=>id!==target.id);
    from.followingCount = Math.max(0, (from.followingCount||0)-1);
    target.followers = target.followers.filter(id=>id!==from.id);
    target.followersCount = Math.max(0, (target.followersCount||0)-1);
  }
  await saveData();
  res.json({success:true});
});

app.post('/api/send-message', async (req, res) => {
  const {fromId, toId, content} = req.body;
  if (!content?.trim()) return res.status(400).json({error:'Пустое сообщение'});
  const msg = {
    id: messages.length + 1,
    fromId: Number(fromId),
    toId: Number(toId),
    content: content.trim(),
    timestamp: new Date().toISOString(),
    read: false
  };
  messages.push(msg);
  await saveData();
  res.json({success:true});
});

app.get('/api/messages', (req, res) => {
  const fromId = Number(req.query.fromId);
  const toId = Number(req.query.toId);
  const filtered = messages
    .filter(m => (m.fromId === fromId && m.toId === toId) || (m.fromId === toId && m.toId === fromId))
    .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(filtered);
});

app.get('/api/my-chats', (req, res) => {
  const userId = Number(req.query.userId);
  const chatMap = new Map();
  messages.forEach(m => {
    if (m.fromId === userId || m.toId === userId) {
      const other = m.fromId === userId ? m.toId : m.fromId;
      if (!chatMap.has(other) || new Date(m.timestamp) > new Date(chatMap.get(other).timestamp)) {
        chatMap.set(other, m);
      }
    }
  });
  const chats = Array.from(chatMap).map(([otherId, lastMsg]) => {
    const other = users.find(u => u.id === otherId);
    return {
      otherId,
      otherName: other?.name || 'Unknown',
      otherUsername: other?.username || '',
      otherAvatar: other?.avatar || '',
      lastMsg: lastMsg.content.substring(0, 30) + (lastMsg.content.length > 30 ? '...' : ''),
      time: lastMsg.timestamp
    };
  }).sort((a,b) => new Date(b.time) - new Date(a.time));
  res.json(chats);
});
app.post('/api/buy-wxr', async (req, res) => {
  const {userId, amount} = req.body;
  const u = users.find(x => x.id === userId);
  if (u) {
    u.balance += Number(amount);
    await saveData();
    res.json({success:true, balance: u.balance});
  } else res.status(404).json({error:'Не найден'});
});

app.post('/api/buy-premium', async (req, res) => {
  const {userId, level} = req.body; // 1=blue, 2=yellow
  const u = users.find(x => x.id === userId);
  const cost = level === 1 ? 299 : 499;
  if (u && u.balance >= cost) {
    u.balance -= cost;
    u.premiumLevel = level;
    await saveData();
    res.json({success:true, premiumLevel: level});
  } else res.status(400).json({error:'Недостаточно WXR'});
});

// Админ (расширен)
const ADMIN_PASS = 'sehpy9-qiqjux-hofgyN';
function checkAdmin(req, res, next) {
  if (req.headers['x-admin-pass'] !== ADMIN_PASS) return res.status(403).json({error:'Доступ запрещён'});
  next();
}
app.get('/api/admin/stats', checkAdmin, (req,res) => res.json({usersCount: users.length, postsCount: posts.length}));
app.get('/api/admin/users', checkAdmin, (req,res) => res.json(users));
app.patch('/api/admin/user', checkAdmin, async (req, res) => {
  const { id, balance, isVerified, isBlocked, premiumLevel, followersCount } = req.body;
  const user = users.find(u => u.id === Number(id));
  if (!user) return res.status(404).json({error:'Не найден'});
  if (balance !== undefined) user.balance = Number(balance);
  if (isVerified !== undefined) user.isVerified = Boolean(isVerified);
  if (isBlocked !== undefined) user.isBlocked = Boolean(isBlocked);
  if (premiumLevel !== undefined) user.premiumLevel = Number(premiumLevel);
  if (followersCount !== undefined) user.followersCount = Number(followersCount);
  await saveData();
  res.json({success:true});
});

app.listen(PORT, () => console.log(Сервер на ${PORT}));
