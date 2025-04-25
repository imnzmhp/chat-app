const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // ReactのURL
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ ユーザー接続:", socket.id);

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ ユーザー切断:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("🚀 サーバー起動中 http://localhost:3001");
});
