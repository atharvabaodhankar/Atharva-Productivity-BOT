module.exports = (bot) => {
  bot.command(["help", "guide"], (ctx) => {
    const name = ctx.state.user ? ctx.state.user.firstName : "Friend";
    const helpText = `
🤖 <b>AtharvaOS — AI Productivity Copilot & Second Brain</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━

Hey <b>${name}</b>! Here is what I can do for you:

💬 <b>Natural AI Intelligence:</b>
• <b>Ask Anything & Get Code:</b> <i>"program for c++ for loop"</i>, <i>"explain dynamic programming"</i>
• <b>Vision OCR:</b> Send a photo of notes, whiteboard, or study checklist to extract tasks automatically!
• <b>Schedule Reminders:</b> <i>"Remind me in 15 mins to stretch"</i>, <i>"Remind me daily at 8 PM to read"</i>
• <b>Manage Briefings:</b> <i>"Stop morning messages"</i>, <i>"Turn off nightly check-in"</i>, <i>"Mute daily reminders"</i>
• <b>Set Goals & Habits:</b> <i>"Goal: 5km run every morning"</i>, <i>"Note down: ideas for side project"</i>
• <b>Spoken Voice Briefings:</b> Ask <i>"bol ke batao"</i>, <i>"speak to me"</i>, or <code>/speak &lt;prompt&gt;</code> for Amazon Polly Matthew AI voice notes! 🎙️

📋 <b>Quick Slash Commands:</b>
• <code>/tasks</code> — View pending tasks with priority badges & 1-tap complete buttons
• <code>/today</code> — Get your personalized action plan for today
• <code>/done [1 | task_name]</code> — 1-tap or number-based task completion
• <code>/reminders</code> — Interactive hub to manage reminders & briefing schedules
• <code>/goals</code> — Track your long-term goals & milestones
• <code>/reflections</code> — View your 7-day retrospective self-growth log
• <code>/speak &lt;prompt&gt;</code> — Spoken AI Voice Note synthesized via Amazon Polly
• <code>/delete</code> — Interactive menu to delete specific tasks or reminders
• <code>/motivate</code> — Instant high-voltage motivation boost 🔥
• <code>/roast</code> — Playful Hinglish roast 😂
• <code>/owner</code> — Meet creator Atharva Baodhankar 🚀

💡 <i>Tap the menu button <b>[🔲 Open AtharvaOS]</b> anytime to launch the Mini App!</i>
`;
    ctx.reply(helpText, { parse_mode: "HTML" });
  });
};
