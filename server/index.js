const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");

// MongoDB接続
mongoose
  .connect("mongodb://localhost:27017/chatapp")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ルームスキーマとモデル
const roomSchema = new mongoose.Schema({
  roomName: String,
  createdAt: { type: Date, default: Date.now },
  creatorSocketId: String,
  creatorUserId: String, // ← 追加！！
});
const Room = mongoose.model("Room", roomSchema);

// ExpressとSocket.io初期設定
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

// 認証API追加
app.use("/api/auth", authRoutes);

// ユーザー管理（socket.id => username）
const userUsernames = {};

// ルーム削除タイマー管理
const roomDeleteTimers = {};

// ルーム一覧取得
app.get("/rooms", async (req, res) => {
  const rooms = await Room.find();
  res.json(rooms);
});

// 新しいルーム作成
app.post("/rooms", async (req, res) => {
  const { roomName, creatorSocketId, creatorUserId } = req.body;
  if (!roomName || !creatorSocketId || !creatorUserId) {
    return res.status(400).json({
      error: "Room name, creatorSocketId, and creatorUserId are required",
    });
  }
  const newRoom = new Room({ roomName, creatorSocketId, creatorUserId });
  await newRoom.save();
  res.status(201).json(newRoom);
});

// ルーム手動削除（作成者だけ）
app.post("/rooms/:roomId/delete", async (req, res) => {
  const { requesterUserId } = req.body;
  const { roomId } = req.params;

  const room = await Room.findById(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.creatorUserId !== requesterUserId) {
    return res
      .status(403)
      .json({ error: "Only the creator can delete this room" });
  }

  await Room.findByIdAndDelete(roomId);
  console.log(`🗑️ Room ${roomId} deleted manually by ${requesterUserId}`);

  if (roomDeleteTimers[roomId]) {
    clearTimeout(roomDeleteTimers[roomId]);
    delete roomDeleteTimers[roomId];
  }

  res.json({ message: "Room deleted successfully" });
});

// Socket.io通信
io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  // Username登録
  socket.on("setUsername", (username) => {
    userUsernames[socket.id] = username;
    console.log(`👤 ${socket.id} set username: ${username}`);
  });

  // ルーム参加
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`🔵 ${socket.id} joined room ${roomId}`);

    if (roomDeleteTimers[roomId]) {
      clearTimeout(roomDeleteTimers[roomId]);
      delete roomDeleteTimers[roomId];
      console.log(`❎ Delete timer for room ${roomId} canceled.`);
    }
  });

  // メッセージ送信
  socket.on("sendMessage", ({ roomId, message }) => {
    const username = userUsernames[socket.id] || "名無し";
    io.to(roomId).emit("receiveMessage", { message, sender: username });
    console.log(`✉️ ${username} sent message to room ${roomId}: ${message}`);
  });

  // 切断前処理
  socket.on("disconnecting", async () => {
    const rooms = [...socket.rooms];

    for (const roomId of rooms) {
      if (roomId !== socket.id) {
        const socketsInRoom = await io.in(roomId).fetchSockets();
        if (socketsInRoom.length <= 1) {
          console.log(`👀 Room ${roomId} is now empty. Starting delete timer.`);
          if (roomDeleteTimers[roomId]) {
            clearTimeout(roomDeleteTimers[roomId]);
          }
          roomDeleteTimers[roomId] = setTimeout(async () => {
            await Room.findByIdAndDelete(roomId);
            console.log(`🗑️ Room ${roomId} deleted after timeout.`);
            delete roomDeleteTimers[roomId];
          }, 5 * 60 * 1000); // 5分
        }
      }
    }
  });

  // 切断時
  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
    delete userUsernames[socket.id];
  });
});

// サーバー起動
server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
