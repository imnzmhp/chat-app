import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:3000");

function App() {
  const [userId, setUserId] = useState(localStorage.getItem("userId") || "");
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [discriminator, setDiscriminator] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [roomName, setRoomName] = useState("");
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const API_BASE = "http://localhost:3000/api/auth";
  const ROOM_API = "http://localhost:3000/rooms";

  useEffect(() => {
    fetchRooms();

    socket.on("receiveMessage", ({ message, sender }) => {
      setMessages((prev) => [
        ...prev,
        { message, sender, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("chatHistory", (history) => {
      setMessages((prev) => [...prev, ...history]);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("chatHistory");
    };
  }, []);

  const fetchRooms = async () => {
    const res = await axios.get(ROOM_API);
    setRooms(res.data);
  };

  const handleLoginSuccess = (userId) => {
    localStorage.setItem("userId", userId);
    setUserId(userId);
    setMessage("");
    socket.emit("setUsername", userId);
  };

  const handleRegister = async () => {
    if (authMode === "register" && password !== confirmPassword) {
      setMessage("パスワードが一致しません");
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/register`, {
        username,
        password,
      });
      handleLoginSuccess(res.data.userId);
    } catch (err) {
      setMessage(err.response?.data?.error || "登録エラー");
    }
  };

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/login`, {
        userId: `${username}#${discriminator}`,
        password,
      });
      handleLoginSuccess(res.data.userId);
    } catch (err) {
      setMessage(err.response?.data?.error || "ログインエラー");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    setUserId("");
    setUsername("");
    setPassword("");
    setDiscriminator("");
    setCurrentRoom(null);
    setMessages([]);
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    try {
      await axios.post(ROOM_API, {
        roomName,
        creatorSocketId: socket.id,
        creatorUserId: userId,
      });
      setRoomName("");
      fetchRooms();
    } catch (err) {
      if (err.response?.status === 409) {
        alert("同じルーム名がすでに存在します");
      } else {
        alert("ルーム作成に失敗しました");
      }
    }
  };

  const joinRoom = (name) => {
    socket.emit("setUsername", userId);
    socket.emit("joinRoom", {
      roomName: name,
      username: userId,
    });
    setCurrentRoom(name);
    setMessages([]);
  };

  const sendMessage = () => {
    if (messageInput.trim() && currentRoom) {
      socket.emit("sendMessage", {
        roomName: currentRoom,
        message: messageInput,
        sender: userId,
      });
      setMessageInput("");
    }
  };

  const deleteRoom = async (roomName) => {
    await axios.post(`${ROOM_API}/${roomName}/delete`, {
      requesterUserId: userId,
    });
    if (currentRoom === roomName) {
      setCurrentRoom(null);
      setMessages([]);
    }
    fetchRooms();
  };

  const formatDateTime = (iso) => {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    if (isToday) return `今日 ${timeStr}`;
    if (isYesterday) return `昨日 ${timeStr}`;
    return `${date.getFullYear()}/${
      date.getMonth() + 1
    }/${date.getDate()} ${timeStr}`;
  };

  if (!userId) {
    return (
      <div style={{ padding: "20px" }}>
        <h1>{authMode === "register" ? "新規登録" : "ログイン"}</h1>
        {authMode === "register" ? (
          <>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  handleRegister();
              }}
            />
            <br />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  authMode === "register" ? handleRegister() : handleLogin();
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "非表示" : "表示"}
            </button>

            {authMode === "register" && (
              <>
                <br />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="確認用パスワード"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing)
                      handleRegister();
                  }}
                />
              </>
            )}

            <br />
            <button onClick={handleRegister}>登録</button>
            <br />
            <button onClick={() => setAuthMode("login")}>
              ログインに切り替え
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />{" "}
            <span>#</span>
            <input
              type="text"
              placeholder="1234"
              value={discriminator}
              onChange={(e) => setDiscriminator(e.target.value)}
              maxLength={4}
            />
            <br />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  handleLogin();
              }}
            />
            <br />
            <button onClick={handleLogin}>ログイン</button>
            <br />
            <button onClick={() => setAuthMode("register")}>
              新規登録に切り替え
            </button>
          </>
        )}
        {message && <p style={{ color: "red" }}>{message}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>チャットアプリ</h1>
      <p>ログイン中: {userId}</p>
      <button onClick={handleLogout}>ログアウト</button>

      {!currentRoom && (
        <>
          <h2>ルーム作成</h2>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="ルーム名を入力"
          />
          <button onClick={createRoom}>作成</button>

          <h2>ルーム一覧</h2>
          <ul>
            {rooms.map((room) => (
              <li key={room._id} style={{ marginBottom: "10px" }}>
                {room.roomName}
                <button
                  style={{ marginLeft: "10px" }}
                  onClick={() => joinRoom(room.roomName)}
                >
                  入室
                </button>
                {room.creatorUserId === userId && (
                  <button
                    style={{ marginLeft: "5px", color: "red" }}
                    onClick={() => deleteRoom(room.roomName)}
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {currentRoom && (
        <>
          <h2>ルーム：{currentRoom}</h2>
          <div
            style={{
              border: "1px solid black",
              padding: "10px",
              height: "300px",
              overflowY: "scroll",
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={
                  msg.sender === "System"
                    ? {
                        fontStyle: "italic",
                        color: "gray",
                        textAlign: "center",
                        margin: "8px 0",
                      }
                    : {}
                }
              >
                {msg.sender === "System" ? (
                  <>
                    {msg.message}
                    <div style={{ fontSize: "0.75em", color: "#888" }}>
                      {msg.timestamp ? formatDateTime(msg.timestamp) : ""}
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{msg.sender}</strong>: {msg.message}
                    <span
                      style={{
                        marginLeft: "8px",
                        color: "#888",
                        fontSize: "0.8em",
                      }}
                    >
                      {msg.timestamp ? formatDateTime(msg.timestamp) : ""}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>

          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="メッセージを入力"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing)
                sendMessage();
            }}
          />
          <button onClick={sendMessage}>送信</button>

          <div>
            <button
              style={{ marginTop: "10px" }}
              onClick={() => {
                socket.emit("leaveRoom", currentRoom);
                setCurrentRoom(null);
                setMessages([]);
              }}
            >
              退室
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
