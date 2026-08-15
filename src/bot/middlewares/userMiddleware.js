const { getOrCreateUser } = require("../../services/userService");

async function userMiddleware(ctx, next) {
  if (ctx.from) {
    try {
      const user = await getOrCreateUser(ctx.from);
      ctx.state.user = user;
    } catch (err) {
      console.error("User registration error in middleware:", err.message);
    }
  }
  return next();
}

module.exports = { userMiddleware };
