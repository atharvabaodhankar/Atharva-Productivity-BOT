const User = require("../models/User");

async function getOrCreateUser(telegramUser) {
  if (!telegramUser || !telegramUser.id) {
    return null;
  }

  const telegramId = telegramUser.id;
  let user = await User.findOne({ telegramId });

  if (!user) {
    user = await User.create({
      telegramId,
      firstName: telegramUser.first_name || "Champ",
      lastName: telegramUser.last_name || "",
      username: telegramUser.username || "",
      timezone: "Asia/Kolkata",
    });
  } else {
    // Update name/username if changed in Telegram
    let updated = false;
    if (telegramUser.first_name && user.firstName !== telegramUser.first_name) {
      user.firstName = telegramUser.first_name;
      updated = true;
    }
    if (telegramUser.username && user.username !== telegramUser.username) {
      user.username = telegramUser.username;
      updated = true;
    }
    if (updated) {
      await user.save();
    }
  }

  return user;
}

async function updateUserTimezone(telegramId, timezone) {
  return await User.findOneAndUpdate(
    { telegramId },
    { timezone },
    { new: true }
  );
}

module.exports = {
  getOrCreateUser,
  updateUserTimezone,
};
