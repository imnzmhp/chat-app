const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
// 認証APIのルーティング
app.use("/api/auth", authRoutes);

// MongoDB接続
mongoose
  .connect("mongodb://localhost:27017/chatapp")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error", err));

const roomSchema = new mongoose.Schema({
  roomName: String,
  creatorSocketId: String,
  creatorUserId: String,
  createdAt: { type: Date, default: Date.now },
  scheduledDeleteAt: Date,
});
const Room = mongoose.model("Room", roomSchema);

const userUsernames = {};

// 永続タイマー: 1分ごとに scheduledDeleteAt を確認し、削除実行
setInterval(async () => {
  const now = new Date();
  const expiredRooms = await Room.find({ scheduledDeleteAt: { $lte: now } });
  for (const room of expiredRooms) {
    await Room.findByIdAndDelete(room._id);
    console.log(`🗑️ Room ${room.roomName} (${room._id}) deleted by scheduler`);
  }
}, 60000);

app.post("/rooms", async (req, res) => {
  const { roomName, creatorSocketId, creatorUserId } = req.body;
  if (!roomName || !creatorSocketId || !creatorUserId) {
    return res
      .status(400)
      .json({ error: "roomName, creatorSocketId, creatorUserId are required" });
  }
  const newRoom = new Room({ roomName, creatorSocketId, creatorUserId });
  await newRoom.save();
  res.status(201).json(newRoom);
});

app.get("/rooms", async (req, res) => {
  const rooms = await Room.find();
  res.json(rooms);
});

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
  console.log(
    `🗑️ Room ${room.roomName} (${roomId}) deleted manually by ${requesterUserId}`
  );
  res.json({ message: "Room deleted successfully" });
});

// Socket.io通信
io.on("connection", (socket) => {
  // ユーザーの接続
  console.log(`🟢 User connected: ${socket.id}`);

  socket.on("setUsername", (username) => {
    userUsernames[socket.id] = username;
    console.log(`👤 ${socket.id} set username to ${username}`);
  });

  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
    await Room.findByIdAndUpdate(roomId, { scheduledDeleteAt: null });
    console.log(
      `🔵 ${socket.id} joined room ${roomId} (delete timer cancelled)`
    );
  });

  // メッセージ送信
  socket.on("sendMessage", ({ roomId, message }) => {
    const sender = userUsernames[socket.id] || "Unknown";
    io.to(roomId).emit("receiveMessage", { message, sender });
  });

  socket.on("disconnecting", async () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const socketsInRoom = await io.in(roomId).fetchSockets();
        if (socketsInRoom.length === 1) {
          const deletionTime = new Date(Date.now() + 60000); // 1分後
          await Room.findByIdAndUpdate(roomId, {
            scheduledDeleteAt: deletionTime,
          });
          console.log(
            `🕒 Room ${roomId} scheduled for deletion at ${deletionTime.toISOString()}`
          );
        }
      }
    }
  });

  // ユーザーの切断
  socket.on("disconnect", () => {
    delete userUsernames[socket.id];
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// サーバー起動
server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
