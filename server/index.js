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
app.use("/api/auth", authRoutes);

// MongoDB接続
mongoose
  .connect("mongodb://localhost:27017/chatapp")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error", err));

// ルームスキーマとモデル
const roomSchema = new mongoose.Schema({
  roomName: { type: String, unique: true },
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

// ルーム作成
app.post("/rooms", async (req, res) => {
  const { roomName, creatorSocketId, creatorUserId } = req.body;
  if (!roomName || !creatorSocketId || !creatorUserId) {
    return res
      .status(400)
      .json({ error: "roomName, creatorSocketId, creatorUserId are required" });
  }

  try {
    const existing = await Room.findOne({ roomName });
    if (existing) {
      return res.status(409).json({ error: "同じルーム名がすでに存在します" });
    }

    const newRoom = new Room({ roomName, creatorSocketId, creatorUserId });
    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (err) {
    console.error("Room creation error:", err);
    res.status(500).json({ error: "ルーム作成中にエラーが発生しました" });
  }
});

// ルーム削除
app.post("/rooms/:roomName/delete", async (req, res) => {
  const { requesterUserId } = req.body;
  const { roomName } = req.params;

  const room = await Room.findOne({ roomName });
  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.creatorUserId !== requesterUserId) {
    return res
      .status(403)
      .json({ error: "Only the creator can delete this room" });
  }

  await Room.deleteOne({ roomName });
  console.log(`🗑️ Room ${roomName} deleted manually by ${requesterUserId}`);
  res.json({ message: "Room deleted successfully" });
});

// ルーム一覧取得
app.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    console.error("Failed to fetch rooms:", err);
    res.status(500).json({ error: "ルーム一覧の取得に失敗しました" });
  }
});

// Socket.io通信
io.on("connection", (socket) => {
  // ユーザーの接続
  console.log(`🟢 User connected: ${socket.id}`);

  // ユーザー名の設定
  // ユーザー名は socket.id をキーにして保存
  socket.on("setUsername", (username) => {
    userUsernames[socket.id] = username;
    console.log(`👤 ${socket.id} set username to ${username}`);
  });

  // ルーム入室
  socket.on("joinRoom", async ({ roomName, username }) => {
    if (username) {
      userUsernames[socket.id] = username;
    }

    const room = await Room.findOne({ roomName });
    if (!room) return;

    const roomId = room._id.toString(); // socket.join にはIDでもOK
    socket.join(roomId); // 内部ルーム名としては_idを使ってもいい
    await Room.findByIdAndUpdate(room._id, { scheduledDeleteAt: null });

    const finalUsername = userUsernames[socket.id] || "不明ユーザー";
    console.log(`🔵 ${finalUsername} joined room ${roomName}`);

    // 入室通知
    io.to(roomId).emit("receiveMessage", {
      message: `${finalUsername} が入室しました`,
      sender: "System",
    });
  });

  // ルーム退室
  socket.on("leaveRoom", async (roomName) => {
    const username = userUsernames[socket.id] || "不明ユーザー";

    const room = await Room.findOne({ roomName });
    if (!room) return;

    const roomId = room._id.toString();
    socket.leave(roomId);

    // 退室通知
    io.to(roomId).emit("receiveMessage", {
      message: `${username} が退室しました`,
      sender: "System",
    });
    console.log(`🟠 ${username} left room ${roomName}`);

    // ルームのメンバー数を確認
    // ルームに誰もいなければ，ルーム削除予定時間を設定
    const socketsInRoom = await io.in(roomId).fetchSockets();
    if (socketsInRoom.length === 0) {
      const deletionTime = new Date(Date.now() + 60000);
      await Room.findByIdAndUpdate(room._id, {
        scheduledDeleteAt: deletionTime,
      });
      console.log(
        `🕒 Room ${roomName} scheduled for deletion at ${deletionTime.toISOString()}`
      );
    }
  });

  // メッセージ送信
  socket.on("sendMessage", async ({ roomName, message }) => {
    const sender = userUsernames[socket.id] || "Unknown";
    const room = await Room.findOne({ roomName });
    if (!room) return;

    const roomId = room._id.toString();
    io.to(roomId).emit("receiveMessage", { message, sender });
  });

  // 切断時の処理
  socket.on("disconnecting", async () => {
    const username = userUsernames[socket.id] || "不明ユーザー";

    for (const joinedRoomId of socket.rooms) {
      if (joinedRoomId !== socket.id) {
        const room = await Room.findById(joinedRoomId);
        if (!room) continue;

        const roomId = room._id.toString();

        // 退室通知
        io.to(roomId).emit("receiveMessage", {
          message: `${username} が退室しました`,
          sender: "System",
        });
        console.log(`🟠 ${username} left room ${room.roomName}`);

        // ルームのメンバー数を確認
        // ルームに誰もいなければ，ルーム削除予定時間を設定
        const socketsInRoom = await io.in(roomId).fetchSockets();
        if (socketsInRoom.length === 0) {
          const deletionTime = new Date(Date.now() + 60000);
          await Room.findByIdAndUpdate(room._id, {
            scheduledDeleteAt: deletionTime,
          });
          console.log(
            `🕒 Room ${
              room.roomName
            } scheduled for deletion at ${deletionTime.toISOString()}`
          );
        }
      }
    }
    // ユーザー切断
    delete userUsernames[socket.id];
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// サーバー起動
server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
