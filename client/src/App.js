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

  const API_BASE = "http://localhost:3000/api/auth";
  const ROOM_API = "http://localhost:3000/rooms";

  useEffect(() => {
    fetchRooms();

    socket.on("receiveMessage", ({ message, sender }) => {
      setMessages((prev) => [...prev, { message, sender }]);
    });

    return () => {
      socket.off("receiveMessage");
    };
  }, []);

  // ルーム一覧を取得する関数
  const fetchRooms = async () => {
    const res = await axios.get(ROOM_API);
    setRooms(res.data);
  };

  // ログイン成功時の処理
  const handleLoginSuccess = (userId) => {
    localStorage.setItem("userId", userId);
    setUserId(userId);
    setMessage("");
    socket.emit("setUsername", userId); // ← 追加するのはここ！
  };

  // 新規登録処理
  const handleRegister = async () => {
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

  // ログイン処理
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

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem("userId");
    setUserId("");
    setUsername("");
    setPassword("");
    setDiscriminator("");
    setCurrentRoom(null);
    setMessages([]);
  };

  // ルーム作成処理
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

  // ルームに入室する処理
  const joinRoom = (name) => {
    socket.emit("setUsername", userId);
    socket.emit("joinRoom", {
      roomName: name,
      username: userId,
    });
    setCurrentRoom(name);
    setMessages([]);
  };

  // メッセージ送信処理
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

  // ルーム削除処理
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
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  handleRegister();
              }}
            />
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
              <div key={idx}>
                <strong>{msg.sender}</strong>: {msg.message}
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
