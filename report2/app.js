const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const fs = require("fs");
const cors = require("cors");
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// 加入 CORS 中間件，允許所有來源跨域
app.use(cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 靜態檔案目錄
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);



// JWT 密鑰 (記得改成安全字串)
const SECRET_KEY = 'dennis';

// 建立 SQLite DB（可調整路徑）
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('無法連接資料庫:', err.message);
  } else {
    console.log('已連接 SQLite 資料庫');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);
});

// 登入
app.post('/login_interface', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號密碼' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    if (!user) return res.status(400).json({ error: '帳號不存在' });

    bcrypt.compare(password, user.password_hash, (err, result) => {
      if (err) return res.status(500).json({ error: '密碼比對錯誤' });
      if (!result) return res.status(400).json({ error: '密碼錯誤' });

      // 密碼正確，簽發 JWT
      const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '2h' });
      res.json({ token });
    });
  });
});

// 註冊
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號密碼' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: '密碼加密錯誤' });

    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    stmt.run(username, hash, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: '帳號已存在' });
        }
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '註冊成功' });
    });
    stmt.finalize();
  });
});

// JWT 驗證中間件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: '缺少授權Token' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '缺少Token' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token 無效或過期' });
    req.user = user; // 解析後的用戶資訊
    next();
  });
}

// 使用範例：保護 /save-result 路由
app.post('/save-result', authenticateToken, (req, res) => {
  const result = req.body;
  const filePath = path.join("C:", "Users", "sailboat", "Desktop", "result.txt");

  fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8", (err) => {
    if (err) {
      console.error("寫檔失敗", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
    res.json({ status: "ok", path: filePath });
  });
});

// 接收觀察資料並轉發到 n8n
app.post('/send-observations', authenticateToken, async (req, res) => {
  try {
    const { observation } = req.body;

    // 呼叫 n8n webhook
    const n8nRes = await fetch("http://localhost:5678/webhook/send-observation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observation })
    });

    const data = await n8nRes.json();
    res.json(data);

  } catch (error) {
    console.error("發送到 n8n 失敗:", error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

// 監聽 port 3001
app.listen(3001, () => {
  console.log("Server running at http://localhost:3001");
});

module.exports = app;
