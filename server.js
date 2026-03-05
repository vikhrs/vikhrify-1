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
app.use(express.urlencoded({ extended: true }));

const USERS_FILE    = join(__dirname, 'users.json');
const POSTS_FILE    = join(__dirname, 'posts.json');
const MESSAGES_FILE = join(__dirname, 'messages.json');
const PAYMENTS_LOG  = join(__dirname, 'payments.log');
const ADMIN_PASSWORD_FILE = join(__dirname, 'admin-password.txt');

let users    = [];
let posts    = [];
let messages = [];
let ADMIN_PASSWORD = 'sehpy9-qiqjux-hofgyN'; // дефолт

async function loadData() {
  try { users    = JSON.parse(await fs.readFile(USERS_FILE,    'utf8')); } catch { users    = []; }
  try { posts    = JSON.parse(await fs.readFile(POSTS_FILE,    'utf8')); } catch { posts    = []; }
  try { messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8')); } catch { messages = []; }

  // Загружаем пароль админа
  try {
    ADMIN_PASSWORD = (await fs.readFile(ADMIN_PASSWORD_FILE, 'utf8')).trim();
  } catch {
    await fs.writeFile(ADMIN_PASSWORD_FILE, ADMIN_PASSWORD);
    console.log('Создан admin-password.txt с начальным паролем');
  }
}

async function saveData() {
  await fs.writeFile(USERS_FILE,    JSON.stringify(users,    null, 2));
  await fs.writeFile(POSTS_FILE,    JSON.stringify(posts,    null, 2));
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

await loadData();

function checkAndExpirePremium(user) {
  if (user.premiumUntil && new Date(user.premiumUntil) < new Date()) {
    user.isPremium   = false;
    user.premiumUntil = null;
    // user.isVerified = null;   // раскомментируй, если хочешь снимать галочку
  }
}

// ─── Страницы ──────────────────────────────────────────────────────
app.get('/',      (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

// ─── Защита админки ────────────────────────────────────────────────
function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'] || req.query.pass;
  if (pass !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Неверный пароль администратора' });
  }
  next();
}

// ─── Смена пароля админки ──────────────────────────────────────────
app.post('/api/admin/change-password', checkAdmin, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
  }

  ADMIN_PASSWORD = newPassword.trim();
  await fs.writeFile(ADMIN_PASSWORD_FILE, ADMIN_PASSWORD);

  res.json({ success: true, message: 'Пароль администратора изменён' });
});

// ─── Регистрация ───────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body || {};
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
    isPremium: false,
    premiumUntil: null,
    isVerified: null,
    isBlocked: false,
    followers: []
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
  if (!user) return res.status(401).json({ error: 'Неверные данные' });

  checkAndExpirePremium(user);
  res.json({ success: true, user: { ...user, password: undefined } });
});

// ─── Профили ───────────────────────────────────────────────────────
app.get('/api/me/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  checkAndExpirePremium(user);
  res.json({ ...user, password: undefined });
});

app.get('/api/user/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  checkAndExpirePremium(user);
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    isVerified: user.isVerified,
    premiumUntil: user.premiumUntil,
    followersCount: (user.followers || []).length
  });
});

// ─── Подписка/отписка ──────────────────────────────────────────────
app.post('/api/follow', async (req, res) => {
  const { userId, targetId } = req.body;
  const me   = users.find(u => u.id === Number(userId));
  const them = users.find(u => u.id === Number(targetId));

  if (!me  !them  me.id === them.id) return res.status(400).json({ error: 'Некорректный запрос' });

  if (!them.followers) them.followers = [];
  const index = them.followers.indexOf(me.id);
  if (index !== -1) {
    them.followers.splice(index, 1);
  } else {
    them.followers.push(me.id);
  }
  await saveData();
  res.json({ success: true, isFollowing: index === -1 });
});

// ─── Сообщения ─────────────────────────────────────────────────────
app.get('/api/messages/:withUserId', (req, res) => {
  const myId    = Number(req.query.myId);
  const otherId = Number(req.params.withUserId);

  const dialog = messages.filter(m =>
    (m.fromId === myId   && m.toId === otherId) ||
    (m.fromId === otherId && m.toId === myId)
  ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json(dialog);
});

app.post('/api/messages', async (req, res) => {
  const { fromId, toId, text } = req.body;
  if (!fromId  !toId  !text?.trim()) return res.status(400).json({ error: 'Недостаточно данных' });

  const msg = {
    id: messages.length + 1,
    fromId: Number(fromId),
    toId: Number(toId),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    read: false
  };

  messages.push(msg);
  await saveData();
  res.json(msg);
});

// ─── Platega платежи ───────────────────────────────────────────────
const PLATEGA_BASE = 'https://app.platega.io/api/v1';
const MERCHANT_ID  = 'ВАШ_MERCHANT_ID';      // ← заменить !!!
const SECRET_KEY   = 'ВАШ_SECRET_KEY';       // ← заменить !!!

app.post('/api/buy-vxr', async (req, res) => {
  const { userId, amountRub } = req.body;
  const user = users.find(u => u.id === Number(userId));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (amountRub < 100 || amountRub > 10000) return res.status(400).json({ error: 'Сумма от 100 до 10000 ₽' });

  try {
    const orderId = vxr-\( {userId}- \){Date.now()};
    const payload = {
      amount: Number(amountRub),
      currency: 'RUB',
      description: Пополнение \( {amountRub} VXR (@ \){user.username}),
      orderId,
      successUrl: 'https://your-domain.com/?payment=success',
      failUrl:    'https://your-domain.com/?payment=fail'
    };

    const response = await fetch(${PLATEGA_BASE}/transaction/create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MerchantId': MERCHANT_ID,
        'X-Secret': SECRET_KEY
      },
      body: JSON.stringify(payload)
    });
const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Ошибка создания платежа');

    await fs.appendFile(PAYMENTS_LOG, JSON.stringify({ time: new Date().toISOString(), type: 'vxr', userId, orderId, amount: amountRub }, null, 2) + '\n');

    res.json({ success: true, paymentUrl: data.redirectUrl || data.paymentUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/buy-premium', async (req, res) => {
  const { userId, type } = req.body;
  const user = users.find(u => u.id === Number(userId));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const price = type === 'blue' ? 299 : 499;
  const desc = type === 'blue' ? 'Синяя галочка' : 'Жёлтая галочка';

  try {
    const orderId = prem-\( {type}- \){userId}-${Date.now()};
    const payload = {
      amount: price,
      currency: 'RUB',
      description: \( {desc} на 60 дней (@ \){user.username}),
      orderId,
      successUrl: 'https://your-domain.com/?payment=success',
      failUrl:    'https://your-domain.com/?payment=fail'
    };

    const response = await fetch(${PLATEGA_BASE}/transaction/create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MerchantId': MERCHANT_ID,
        'X-Secret': SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Ошибка');

    await fs.appendFile(PAYMENTS_LOG, JSON.stringify({ time: new Date().toISOString(), type: 'premium', subtype: type, userId, orderId, amount: price }, null, 2) + '\n');

    res.json({ success: true, paymentUrl: data.redirectUrl || data.paymentUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/platega-webhook', async (req, res) => {
  const payload = req.body;

  // В продакшене здесь нужна проверка подписи!

  if (payload.status === 'success' || payload.status === 'paid') {
    const orderId = payload.orderId || '';

    if (orderId.startsWith('vxr-')) {
      const [, uid] = orderId.split('-');
      const user = users.find(u => u.id === Number(uid));
      if (user) {
        user.balance += Number(payload.amount);
        await saveData();
      }
    } else if (orderId.startsWith('prem-')) {
      const [, type, uid] = orderId.split('-');
      const user = users.find(u => u.id === Number(uid));
      if (user) {
        const until = new Date();
        until.setDate(until.getDate() + 60);
        user.isPremium   = true;
        user.premiumUntil = until.toISOString();
        user.isVerified  = type;
        await saveData();
      }
    }
  }

  res.sendStatus(200);
});

// ─── Посты ─────────────────────────────────────────────────────────
app.get('/api/posts', (req, res) => {
  res.json(posts.map(p => {
    const author = users.find(u => u.id === p.userId);
    return { ...p, isVerified: author?.isVerified || null };
  }));
});

app.post('/api/posts', async (req, res) => {
  const { userId, content, image } = req.body;
  const author = users.find(u => u.id === Number(userId));
  if (!author) return res.status(404).json({ error: 'Автор не найден' });

  const post = {
    id: posts.length + 1,
    userId,
    username: author.username,
    name: author.name,
    avatar: author.avatar,
    content: content.trim(),
    image: image || null,
    createdAt: new Date().toISOString()
  };

  posts.push(post);
  await saveData();
  res.json(post);
});

app.patch('/api/profile', async (req, res) => {
  const { id, name } = req.body;
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  if (name?.trim()) user.name = name.trim();
  await saveData();
  res.json({ success: true });
});

// ─── Админ ─────────────────────────────────────────────────────────
app.get('/api/admin/stats', checkAdmin, (req, res) => {
  res.json({ usersCount: users.length, postsCount: posts.length });
});
app.get('/api/admin/users', checkAdmin, (req, res) => {
  res.json(users);
});

app.patch('/api/admin/user', checkAdmin, async (req, res) => {
  const { id, balance, isVerified, isBlocked, followersCount } = req.body;
  const user = users.find(u => u.id === Number(id));
  if (!user) return res.status(404).json({ error: 'Не найден' });

  if (balance !== undefined) user.balance = Number(balance);
  if (isVerified !== undefined) user.isVerified = isVerified;
  if (isBlocked !== undefined) user.isBlocked = Boolean(isBlocked);
  if (followersCount !== undefined) {
    user.followers = Array.from({ length: Number(followersCount) }, (_, i) => 100000 + i);
  }

  await saveData();
  res.json({ success: true });
});

app.post('/api/admin/delete-posts', checkAdmin, async (req, res) => {
  const { userId } = req.body;
  posts = posts.filter(p => p.userId !== Number(userId));
  await saveData();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(Сервер запущен на порту ${PORT});
});
