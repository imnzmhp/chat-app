const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");

// Helper: discriminatorを発行
async function generateDiscriminator(username) {
  for (let i = 1; i <= 9999; i++) {
    const code = i.toString().padStart(4, "0"); // 0001〜9999
    const exists = await User.findOne({ username, discriminator: code });
    if (!exists) return code;
  }
  throw new Error("Discriminator limit exceeded");
}

// POST /register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const discriminator = await generateDiscriminator(username);
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({ username, discriminator, hashedPassword });

  try {
    await newUser.save();
    res.status(201).json({
      userId: `${username}#${discriminator}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to register user" });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  const { userId, password } = req.body;
  const [username, discriminator] = userId.split("#");

  const user = await User.findOne({ username, discriminator });
  if (!user) return res.status(401).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.hashedPassword);
  if (!match) return res.status(401).json({ error: "Invalid password" });

  res.json({ message: "Login success", userId });
});

module.exports = router;
