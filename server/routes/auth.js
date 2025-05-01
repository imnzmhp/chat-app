const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const User = require("../models/User");

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const discriminator = Math.floor(1000 + Math.random() * 9000).toString();

  if (!username || !password) {
    return res.status(400).json({ error: "UsernameとPasswordが必要です。" });
  }

  const allowedChars = /^[A-Za-z0-9!@#$%^&*()_\-+=.?]{8,64}$/;
  if (!allowedChars.test(password)) {
    return res.status(400).json({
      error:
        "パスワードは8〜64文字で、英数字と !@#$%^&*()_-+=.? のみ使用できます。",
    });
  }

  try {
    const userId = `${username}#${discriminator}`;
    const existing = await User.findOne({ username, discriminator });
    if (existing) {
      return res.status(409).json({ error: "同じユーザーがすでに存在します" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, discriminator, hashedPassword });
    await newUser.save();

    res.status(201).json({ userId });
  } catch (err) {
    console.error("登録エラー:", err);
    res.status(500).json({ error: "ユーザー登録中にエラーが発生しました。" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: "UserIDとPasswordが必要です。" });
  }

  try {
    const [username, discriminator] = userId.split("#");
    const user = await User.findOne({ username, discriminator });
    if (!user)
      return res.status(401).json({ error: "ユーザーが見つかりません" });

    const match = await bcrypt.compare(password, user.hashedPassword);
    if (!match)
      return res.status(401).json({ error: "パスワードが間違っています" });

    res.json({ userId });
  } catch (err) {
    console.error("ログインエラー:", err);
    res.status(500).json({ error: "ログイン中にエラーが発生しました。" });
  }
});

module.exports = router;
