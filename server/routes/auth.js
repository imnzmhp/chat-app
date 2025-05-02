const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const User = require("../models/User");

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { userName, password, displayName } = req.body;

  if (!userName || !password) {
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
    const existingUser = await User.findOne({ userName });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "このユーザー名はすでに使われています" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ userName, hashedPassword, displayName });
    await newUser.save();

    res.status(201).json({ userName, displayName });
  } catch (err) {
    console.error("登録エラー:", err);
    res.status(500).json({ error: "ユーザー登録中にエラーが発生しました。" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { userName, password, displayName } = req.body;
  if (!userName || !password) {
    return res.status(400).json({ error: "UsernameとPasswordが必要です。" });
  }

  try {
    const user = await User.findOne({ userName });
    if (!user)
      return res.status(401).json({ error: "ユーザーが見つかりません" });

    const match = await bcrypt.compare(password, user.hashedPassword);
    if (!match)
      return res.status(401).json({ error: "パスワードが間違っています" });

    res.json({ userName: user.userName, displayName: user.displayName });
  } catch (err) {
    console.error("ログインエラー:", err);
    res.status(500).json({ error: "ログイン中にエラーが発生しました。" });
  }
});

router.put("/updateDisplayName", async (req, res) => {
  const { userName, newDisplayName } = req.body;

  if (!userName || !newDisplayName) {
    return res.status(400).json({ error: "必要な情報が不足しています。" });
  }

  try {
    const user = await User.findOneAndUpdate(
      { userName },
      { displayName: newDisplayName },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "ユーザーが見つかりません" });
    }

    res.json({ userName: user.userName, displayName: user.displayName });
  } catch (err) {
    console.error("表示名更新エラー:", err);
    res.status(500).json({ error: "表示名の更新に失敗しました。" });
  }
});

module.exports = router;
