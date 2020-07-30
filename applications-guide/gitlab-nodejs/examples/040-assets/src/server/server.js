/* eslint no-unused-vars: "warn" */
"use strict";

var express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
const async = require("async");
const app = express();
const http = require("http").Server(app);
var morgan = require("morgan");
const router = express.Router();
const io = require("socket.io")(http);
var formidable = require("formidable");
var md5 = require("md5");
const ioMetrics = require("socket.io-prometheus");
const promClient = require("prom-client");
const promRegister = promClient.register;
const promBundle = require("express-prom-bundle");
const metricsMiddleware = promBundle({ includeMethod: true });

// Get ENV vars
const PORT = Number(process.env.PORT) || 3000;
const COOKIE_SECRET = process.env.COOKIE_SECRET || "supersecret";
// Enable access log
app.use(morgan("combined"));
app.use('/assets', express.static(__dirname + '/assets'));
// Enable metrics for express
app.use(metricsMiddleware);


// Redis connect
const expSession = require("express-session");

var session = expSession({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: false,
});
var sharedsession = require("express-socket.io-session");
app.use(session);

// Use express-session in socket.io
io.use(
  sharedsession(session, {
    autoSave: true,
  })
);


app.set("views", path.join(__dirname, "/", "views"));
app.engine("html", require("ejs").renderFile);
app.use(cookieParser(COOKIE_SECRET));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(function (req, res, next) {
  res.locals.key = req.session.key;
  next();
});

io.use(function (socket, next) {
  session(socket.handshake, {}, next);
});

// This is an important function.
// This function does the database handling task.
// We also use async here for control flow.

// socketio function
io.sockets.on("connection", function (socket) {
  socket.on("login", function (_userdata) {
    socket.handshake.session.save();
    socket.username = socket.handshake.session["key"]["name"];
    io.emit("is_online",
              "🔵 <i>" +
              socket.username +
              " join the chat..</i>"
          )
  });


  socket.on("disconnect", function (_username) {
    io.emit("is_online",
              "🔴 <i>" +
              socket.username +
              " left the chat..</i>",
          )
  });

  socket.on("chat_message", function (message) {
            io.emit( "chat_message",
                '<img height="32" width="32" src="http://placehold.it/32x32"/> <strong>' +
                socket.username +
                "</strong>: " +
                message,
            )
    });
});
// Metrics for prometheus from socket.io
ioMetrics(io);

/**
    --- Router Code begins here.
**/

router.get("/", function (req, res) {
  if (req.session.key) {
    res.render("chat.ejs", {
      name: req.session.key["name"],
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/login", function (req, res) {
  if (req.session.key) {
    res.redirect("/");
  } else {
    res.render("login.ejs");
  }
});

router.post("/login", function (req, res) {
        const response = {
            name: req.body.user_name
        }
        req.session.key = response;
        res.json({ error: false, message: "Login success." });
});

router.get("/profile", function (req, res) {
  if (req.session.key) {
    res.render("profile.ejs", {
      name: req.session.key["name"],
      avatar: CDN_PREFIX + "/" + req.session.key["avatarUrl"],
    });
  } else {
    res.redirect("/");
  }
});


router.get("/logout", function (req, res) {
  if (req.session.key) {
    req.session.destroy(function () {
      res.redirect("/");
    });
  } else {
    res.redirect("/");
  }
});

router.get("/healthz", function (req, res) {
  pool.query("SELECT NOW() as now", (err, result) => {
    if (err) {
      console.log(err.stack);
      res.status(500).send("ERROR");
    } else {
      res.status(200).send("OK");
    }
  });
});

router.get("/metrics", (req, res) => {
  res.set("Content-Type", promRegister.contentType);
  res.end(promRegister.metrics());
});

app.use("/", router);

const server = http.listen(PORT, function (_req, _res) {
  console.log(`Server is listening on port ${PORT}`);
});
