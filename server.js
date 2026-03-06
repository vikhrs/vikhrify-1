const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const webPush = require('web-push');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const upload = multer({ dest: 'uploads/' });

const db = new sqlite3.Database('vikhrify.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    name TEXT,
    avatar TEXT,
    rating INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT 0,
    blocked BOOLEAN DEFAULT 0,
    follower_count INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    text TEXT,
    media TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    views INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER,
    followed_id INTEGER,
    PRIMARY KEY (follower_id, followed_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER,
    to_id INTEGER,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    type TEXT CHECK(type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
    UNIQUE(post_id, user_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS push_subs (
    user_id INTEGER PRIMARY KEY,
    subscription TEXT
  )`);
});

// Замени на свои VAPID ключи (сгенерируй через web-push generate-vapid-keys)
const vapidKeys = {
  publicKey: 'BI3jIOqOR5KqNiagyLemVsLTDSqDx1U7SHzF2wV-BNxQ6phiZvGSzsl9-Y1rY4dGN6VqiRHKTpmk90y7xdLmUrw',
  privateKey: '6bwOWQfcDBux3Uu-4gSVZgraPRUqR5VA6FtvU9-76JM'
};
webPush.setVapidDetails('mailto:admin@vikhrify.local', vapidKeys.publicKey, vapidKeys.privateKey);

const JWT_SECRET = 'super-secret-key-change-me-please';

app.use((req, res, next) => {
  if (['/login', '/register', '/vapidPublicKey'].includes(req.path)) return next();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Публичный ключ для push-уведомлений
app.get('/vapidPublicKey', (req, res) => res.send(vapidKeys.publicKey));

// Регистрация
app.post('/register', async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', [username, hashed, name || username], function(err) {
      if (err) return res.status(400).json({ error: 'Username already taken' });
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Логин
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Wrong credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, avatar: user.avatar, rating: user.rating, verified: !!user.verified } });
  });
});

// Получить свой профиль
app.get('/me', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// Опубликовать пост
app.post('/post', upload.single('media'), (req, res) => {
  const { text } = req.body;
  const media = req.file ? req.file.filename : null;

  db.run('INSERT INTO posts (user_id, text, media) VALUES (?, ?, ?)', [req.user.id, text, media], function(err) {
    if (err) return res.status(500).json({ error: 'Cannot create post' });

    // Рейтинг растёт, но не больше 1000
    db.run(`
      UPDATE users SET rating = CASE 
        WHEN rating < 1000 THEN rating + 1 
        ELSE 1000 
      END 
      WHERE id = ?
    `, [req.user.id]);

    res.json({ success: true, postId: this.lastID });
  });
});

// Лента (посты от себя + тех, на кого подписан)
app.get('/feed', (req, res) => {
  db.all(`
    SELECT p.*, u.username, u.name, u.verified, u.avatar
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ? OR p.user_id IN (
      SELECT followed_id FROM follows WHERE follower_id = ?
    )
    ORDER BY p.timestamp DESC
    LIMIT 50
  `, [req.user.id, req.user.id], (err, posts) => {
    if (err) return res.status(500).json({ error: 'DB error' });

    const postIds = posts.map(p => p.id);
    if (postIds.length === 0) return res.json([]);

    // Увеличиваем просмотры
    const stmt = db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?');
    postIds.forEach(id => stmt.run(id));
    stmt.finalize();

    // Реакции + комментарии
    db.all('SELECT post_id, type, COUNT(*) as count FROM reactions WHERE post_id IN (' + postIds.map(() => '?').join(',') + ') GROUP BY post_id, type', postIds, (e, reactions) => {
      db.all('SELECT post_id, COUNT(*) as count FROM comments WHERE post_id IN (' + postIds.map(() => '?').join(',') + ') GROUP BY post_id', postIds, (e2, comments) => {

        const reactMap = {};
        reactions.forEach(r => {
          if (!reactMap[r.post_id]) reactMap[r.post_id] = {};
          reactMap[r.post_id][r.type] = r.count;
        });

        const commMap = {};
        comments.forEach(c => commMap[c.post_id] = c.count);

        posts.forEach(p => {
          p.reactions = reactMap[p.id] || {};
          p.comments_count = commMap[p.id] || 0;
        });

        res.json(posts);
      });
    });
  });
});

// Комментарии к посту
app.get('/comments/:postId', (req, res) => {
  db.all(`
    SELECT c.*, u.username, u.name, u.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.timestamp ASC
  `, [req.params.postId], (err, rows) => res.json(rows || []));
});

app.post('/comment', (req, res) => {
  const { postId, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Empty comment' });

  db.run('INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)', [postId, req.user.id, text], err => {
    res.json({ success: !err });
  });
});

// Реакция
app.post('/reaction', (req, res) => {
  const { postId, type } = req.body; // type: like, love, haha, wow, sad, angry или null (удалить)

  db.run('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', [postId, req.user.id], () => {
    if (type && ['like','love','haha','wow','sad','angry'].includes(type)) {
      db.run('INSERT INTO reactions (post_id, user_id, type) VALUES (?, ?, ?)', [postId, req.user.id, type]);
    }
    res.json({ success: true });
  });
});

// Поиск пользователей
app.get('/search/:query', (req, res) => {
  const q = `%${req.params.query}%`;
  db.all('SELECT id, username, name, avatar, verified, follower_count FROM users WHERE username LIKE ? AND blocked = 0', [q], (err, rows) => {
    res.json(rows || []);
  });
});

// Подписка / отписка
app.post('/follow/:userId', (req, res) => {
  const targetId = req.params.userId;
  if (targetId == req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  db.get('SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?', [req.user.id, targetId], (err, row) => {
    if (row) {
      // Отписка
      db.run('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?', [req.user.id, targetId]);
      db.run('UPDATE users SET follower_count = follower_count - 1 WHERE id = ?', [targetId]);
      res.json({ following: false });
    } else {
      // Подписка
      db.run('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)', [req.user.id, targetId]);
      db.run('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?', [targetId]);
      res.json({ following: true });
    }
  });
});

// Чаты (список собеседников)
app.get('/chats', (req, res) => {
  db.all(`
    SELECT DISTINCT 
      CASE WHEN from_id = ? THEN to_id ELSE from_id END as user_id,
      u.username, u.name, u.avatar
    FROM messages m
    JOIN users u ON u.id = (CASE WHEN from_id = ? THEN to_id ELSE from_id END)
    WHERE from_id = ? OR to_id = ?
    ORDER BY (SELECT MAX(timestamp) FROM messages WHERE (from_id = ? AND to_id = u.id) OR (from_id = u.id AND to_id = ?)) DESC
  `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id], (err, rows) => {
    res.json(rows || []);
  });
});

// Сообщения с конкретным человеком
app.get('/messages/:userId', (req, res) => {
  const partner = req.params.userId;
  db.all(`
    SELECT m.*, 
      CASE WHEN m.from_id = ? THEN 1 ELSE 0 END as isMine
    FROM messages m
    WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
    ORDER BY timestamp ASC
  `, [req.user.id, req.user.id, partner, partner, req.user.id], (err, rows) => res.json(rows || []));
});

app.post('/message', (req, res) => {
  const { toId, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Empty message' });

  db.run('INSERT INTO messages (from_id, to_id, text) VALUES (?, ?, ?)', [req.user.id, toId, text], err => {
    if (err) return res.status(500).json({ error: 'Cannot send' });

    // Отправка push-уведомления
    db.get('SELECT subscription FROM push_subs WHERE user_id = ?', [toId], (e, subRow) => {
      if (subRow?.subscription) {
        try {
          const sub = JSON.parse(subRow.subscription);
          webPush.sendNotification(sub, JSON.stringify({
            title: 'Новое сообщение в Vikhrify',
            body: text.slice(0, 60) + (text.length > 60 ? '...' : '')
          })).catch(() => {});
        } catch {}
      }
    });

    res.json({ success: true });
  });
});

// Подписка на push-уведомления
app.post('/push/subscribe', (req, res) => {
  const { subscription } = req.body;
  db.run('REPLACE INTO push_subs (user_id, subscription) VALUES (?, ?)', [req.user.id, JSON.stringify(subscription)]);
  res.json({ success: true });
});

// ────────────────────────────────────────────────
//                  АДМИН ПАНЕЛЬ (только admin)
// ────────────────────────────────────────────────

const isAdmin = (req, res, next) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

app.use('/admin', isAdmin);

// Статистика
app.get('/admin/stats', (req, res) => {
  db.get('SELECT COUNT(*) as users FROM users', (e1, r1) => {
    db.get('SELECT COUNT(*) as posts FROM posts', (e2, r2) => {
      res.json({
        users: r1.users,
        posts: r2.posts
      });
    });
  });
});

// Поиск пользователей для админа
app.get('/admin/users/search/:query', (req, res) => {
  const q = `%${req.params.query}%`;
  db.all('SELECT id, username, name, verified, blocked, follower_count FROM users WHERE username LIKE ?', [q], (err, rows) => res.json(rows));
});

// Выдать/убрать верификацию
app.post('/admin/verify/:userId', (req, res) => {
  const { verified } = req.body; // true/false
  db.run('UPDATE users SET verified = ? WHERE id = ?', [verified ? 1 : 0, req.params.userId]);
  res.json({ success: true });
});

// Блокировка / разблокировка
app.post('/admin/block/:userId', (req, res) => {
  const { blocked } = req.body;
  db.run('UPDATE users SET blocked = ? WHERE id = ?', [blocked ? 1 : 0, req.params.userId]);
  res.json({ success: true });
});

// Накрутка подписчиков
app.post('/admin/add-followers/:userId', (req, res) => {
  const { count } = req.body;
  const num = parseInt(count) || 0;
  if (num <= 0) return res.status(400).json({ error: 'Invalid count' });

  db.run('UPDATE users SET follower_count = follower_count + ? WHERE id = ?', [num, req.params.userId]);
  res.json({ success: true });
});

// Просмотр переписки любого пользователя
app.get('/admin/conversation/:userId', (req, res) => {
  const uid = req.params.userId;
  db.all(`
    SELECT m.*, 
      u1.username as from_user,
      u2.username as to_user
    FROM messages m
    JOIN users u1 ON u1.id = m.from_id
    JOIN users u2 ON u2.id = m.to_id
    WHERE from_id = ? OR to_id = ?
    ORDER BY timestamp DESC
    LIMIT 200
  `, [uid, uid], (err, rows) => res.json(rows || []));
});

app.listen(port, () => {
  console.log(`Vikhrify server running on http://localhost:${port}`);
});
