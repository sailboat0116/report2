const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const fs = require("fs");
const cors = require("cors");

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

// 儲存報告 API
app.post("/save-result", (req, res) => {
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
