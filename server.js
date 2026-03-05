// ... (начало такое же, импорты и настройки) ...

// --- ПОДПИСКИ ---
app.get('/api/user/:username', (req, res) => {
  const u = users.find(x => x.username === req.params.username);
  if(!u) return res.sendStatus(404);
  const { password, ...safeData } = u; // Не отправляем пароль
  res.json(safeData);
});

app.post('/api/subscribe', async (req, res) => {
  const { me, target } = req.body;
  const targetUser = users.find(u => u.username === target);
  const meUser = users.find(u => u.username === me);
  
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

// --- АДМИН (PATCH доработка) ---
app.patch('/api/admin/user', async (req, res) => {
  if(req.headers['x-admin-pass'] !== ADMIN_PASS) return res.sendStatus(403);
  const { id, ...data } = req.body;
  const u = users.find(x => x.id === id);
  if(u) Object.assign(u, data);
  await saveData();
  res.json({ success: true });
});

// ... (остальное: посты, сообщения, платежи без изменений) ...
