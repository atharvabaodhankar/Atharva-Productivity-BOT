module.exports = (bot) => {
  bot.command("help", (ctx) => {
    const name = ctx.state.user ? ctx.state.user.firstName : "Friend";
    const helpText = `
🤖 AtharvaOS — AI Productivity Copilot!

Hey ${name}! Here is what you can ask me:

💬 Natural AI Conversation (Powered by Vision & Groq):
• Read Photos: Send an image of notes, a whiteboard, or a handwritten checklist with "Add these tasks".
• Add Tasks & Deadlines: "DSA exam next Monday at 2 PM", "Add project task #work"
• Reminders & Alarms: "Remind me to call mom in 30 mins"
• Goals & Habits: "Set a goal to run 5km every morning"
• Mark Done: "Mark my DSA task as complete"
• Delete / Clear: "Delete my study note" or "Clear all tasks"
• Vibe & Chat: "Roast me", "Motivate me", or ask for study tips!

📋 Quick Slash Commands:
/tasks — View your pending tasks with deadline urgency
/today — Get your daily morning/evening action plan
/speak <prompt> — Get a spoken AI Voice Note (Matthew voice) 🎙️
/video [subreddit] — Stream random Reddit video (.mp4) 🎬
/reminders — View active reminders
/goals — View your long-term goals
/reflections — View your 7-day growth log
/done <id> — Mark task completed
/delete <id> — Delete task
/motivate — Instant shot of energy 🔥
/roast — Playful Hinglish roast 😂
/help — Show this guide

Let's crush those goals together! 🚀
    `;
    ctx.reply(helpText);
  });
};
