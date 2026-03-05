<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Vikhrify Admin</title>
    <style>
        body { background: #000; color: #fff; font-family: sans-serif; padding: 20px; }
        .row { border: 1px solid #333; padding: 15px; margin-bottom: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Админка Vikhrify</h1>
    <div id="login">
        <input type="password" id="p" placeholder="Пароль">
        <button onclick="go()">Вход</button>
    </div>
    <div id="list"></div>

    <script>
        let pass = "";
        async function go() {
            pass = document.getElementById('p').value;
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({password: pass})
            });
            const data = await res.json();
            if(data.success) {
                document.getElementById('login').style.display = 'none';
                render(data.users);
            } else { alert('Пароль неверный!'); }
        }

        function render(users) {
            let html = "";
            users.forEach(u => {
                html += `<div class="row">
                    <b>${u.username}</b><br>
                    Баланс: <input id="b-${u.id}" value="${u.balance}"><br>
                    Галка: <select id="v-${u.id}">
                        <option value="false" ${u.isVerified===false?'selected':''}>Нет</option>
                        <option value="blue" ${u.isVerified==='blue'?'selected':''}>Синяя</option>
                        <option value="yellow" ${u.isVerified==='yellow'?'selected':''}>Золотая</option>
                    </select>
                    <button onclick="save(${u.id})">ОК</button>
                </div>`;
            });
            document.getElementById('list').innerHTML = html;
        }

        async function save(id) {
            const res = await fetch('/api/admin/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    password: pass,
                    userId: id,
                    balance: document.getElementById('b-'+id).value,
                    level: 1,
                    isVerified: document.getElementById('v-'+id).value
                })
            });
            if(res.ok) alert('Сохранено');
        }
    </script>
</body>
</html>
