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
  console.log("✅ user connected:", socket.id);

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ user disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("🚀 Server running at http://localhost:3001");
});
