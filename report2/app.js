const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const fs = require("fs");
var dotenv = require('dotenv');
var mysql = require('mysql2/promise');
const cors = require("cors");


dotenv.config();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// 加入 CORS 中間件，允許所有來源跨域
app.use(cors({
  origin: ['http://172.20.10.2:3001'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

// 靜態檔案目錄
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// 儲存報告 API
app.post("/save-result", (req, res) => {
  const result = req.body;

  const recordId = result.record_id || "unknown";
  const imagingDate = result.imaging_date ? result.imaging_date.replace(/-/g, "") : "nodate";
  const fileName = `${recordId}_${imagingDate}.txt`;  // 例如 1_20250818.json
  const filePath = path.join("C:", "Users", "sailboat", "case_data", fileName);

  fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8", (err) => {
    if (err) {
      console.error("寫檔失敗", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
    res.json({ status: "ok", path: filePath });
  });
});

// 儲存報告 API
app.post("/save-before-result", (req, res) => {
  const result = req.body;

  const recordId = result.record_id || "unknown";
  const imagingDate = result.imaging_date ? result.imaging_date.replace(/-/g, "") : "nodate";
  const fileName = `${recordId}_${imagingDate}.txt`;  // 例如 1_20250818.json
  const filePath = path.join("C:", "Users", "sailboat", "before-case_data", fileName);

  fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8", (err) => {
    if (err) {
      console.error("寫檔失敗", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
    res.json({ status: "ok", path: filePath });
  });
});

// ===== MySQL 連線池 =====
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ===== 登入 API =====
const axios = require('axios');

app.post('/api/login', async (req, res) => {
  try {
    const { doctorId, password } = req.body || {};
    if (!doctorId || !password) {
      return res.status(400).json({ ok: false, msg: '缺少帳號或密碼' });
    }

    // 呼叫 n8n workflow
    const n8nResponse = await axios.post('http://172.20.10.2:5678/webhook/login', {
      doctorId,
      password,
    });

    const users = n8nResponse.data; // 這裡是一個陣列
    console.log(users);

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({ ok: false, msg: '找不到使用者資料' });
    }

    // 找出 doctorId 對應的 user
    const user = users.find(u => u.username === doctorId);

    if (!user) {
      return res.status(401).json({ ok: false, msg: '帳號不存在' });
    }

    // 密碼比對（目前是明碼）
    if (user.password_hash !== password) {
      return res.status(401).json({ ok: false, msg: '密碼錯誤' });
    }

    // 登入成功
    res.json({
      ok: true,
      user: { id: user.id, username: user.username },
      //token: 'demo-token'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: '伺服器錯誤' });
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
app.listen(3001, "0.0.0.0",() => {
  console.log("Server running at http://localhost:3001");
});

module.exports = app;
