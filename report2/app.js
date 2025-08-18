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
/*app.use(cors());*/

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

require('dotenv').config();

async function initDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    console.log('✅ MySQL connected!');
    global.db = connection;
  } catch (err) {
    console.error('❌ MySQL connection failed:', err);
    process.exit(1);
  }
}

initDB();


// ===== 登入 API =====
app.post('/api/login', async (req, res) => {
  const { doctorId, password } = req.body;
  try {
    const [rows] = await global.db.execute(
        'SELECT * FROM users WHERE username = ? AND password_hash = ?',
        [doctorId, password]
    );
    if (rows.length > 0) {
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
