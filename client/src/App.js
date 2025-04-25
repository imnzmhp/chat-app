import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://192.168.50.29:3001");

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [username, setUsername] = useState(""); // 確定した名前
  const [tempName, setTempName] = useState(""); // 入力中の名前

  useEffect(() => {
    const savedName = localStorage.getItem("chat_username");
    if (savedName) {
      setUsername(savedName);
    }
  }, []);

  const sendMessage = () => {
    if (message.trim() === "") return;
    socket.emit("send_message", { message, username });
    setMessage("");
  };

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, `${data.username}: ${data.message}`]);
    });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>🗨️ チャットアプリ</h1>

      {!username ? (
        // ✅ ユーザー名を入力する画面（最初だけ表示）
        <div>
          <h2>ニックネームを入力してね！</h2>
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                if (tempName.trim() !== "") {
                  const trimmedName = tempName.trim();
                  setUsername(trimmedName);
                  localStorage.setItem("chat_username", trimmedName); // ← ここで保存！
                }
              }
            }}
          />
        </div>
      ) : (
        // ✅ チャット画面（名前が決まったら表示）
        <>
          <div>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage}>送信</button>
          </div>
          <div style={{ marginTop: 20 }}>
            {chat.map((msg, i) => (
              <div key={i}>💬 {msg}</div>
            ))}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("chat_username");
              setUsername("");
            }}
          >
            名前を変更する
          </button>
        </>
      )}
    </div>
  );
}

export default App;
