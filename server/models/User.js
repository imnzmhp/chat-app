const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  discriminator: String,
  hashedPassword: String,
  createdAt: { type: Date, default: Date.now },
});

// ユニーク制限：username + discriminatorのペア
userSchema.index({ username: 1, discriminator: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
