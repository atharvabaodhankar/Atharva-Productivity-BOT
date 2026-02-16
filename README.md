# AtharvaOS — Your Energetic Productivity Buddy! 🚀

AtharvaOS is an AI-powered personal productivity assistant built as a Telegram bot with PERSONALITY!
It's like having that friend who roasts you lovingly but always has your back - keeping you motivated, cracking jokes, and making sure you crush your goals! 💪

This isn't just another boring productivity tool. AtharvaOS is your **hype man, accountability partner, and second brain** all rolled into one energetic package!

---

## What Makes AtharvaOS Different? 🔥

* **Fun & Energetic** - Uses Hinglish, cracks jokes, and keeps things entertaining
* **Roasts You (Lovingly)** - Calls out procrastination with humor, never mean
* **Celebrates Wins** - Goes CRAZY when you complete tasks! 🎉
* **Smart Memory** - Remembers everything automatically
* **Actually Helpful** - Real productivity advice, not generic BS

Think of it as your future, more disciplined self... but way more fun! 😎

---

## Overview

AtharvaOS is designed to:

* Remember important information automatically
* Track assignments, exams, projects, and goals
* Provide context-aware AI responses
* Suggest actionable next steps
* Detect deadlines and send reminders
* Encourage disciplined, consistent work habits

Instead of using multiple productivity tools, AtharvaOS centralizes:

* Notes
* Tasks
* Reminders
* Ideas
* Planning

inside a Telegram chat interface.

---

## Key Features

## Personality Features 🎭

### Energetic & Fun
- Uses Hinglish (Hindi + English mix) - "bhai", "yaar", "chal", "arre"
- Tons of emojis and energy! 🔥💪🚀
- Gen-Z humor and meme references
- Time-based greetings (morning/afternoon/evening)

### Motivational Beast
- Celebrates every win like it's the Super Bowl! 🎉
- Provides instant motivation with `/motivate` command
- Hypes you up when you're working hard
- Reminds you of your "why" when you need it

### Playful Roasting
- Gently calls out procrastination with humor
- `/roast` command for when you need tough love
- Shows overdue tasks with funny warnings
- Never mean, always supportive underneath

### Smart & Helpful
- Tracks pending task count for context
- Shows days left on deadlines with urgency levels
- Randomized responses keep it fresh
- Actually useful productivity advice

---

## Key Features

### AI Productivity Assistant

* Powered by Groq LLM
* Acts as a focused, practical productivity coach
* Provides step-by-step plans instead of generic advice
* Uses stored memory to give personalized responses

---

### Task Management Commands

**NEW!** Complete task management system:

* `/tasks` - View all pending tasks with IDs
* `/reminders` - View active reminders
* `/goals` - View your goals
* `/today` - Get today's summary
* `/done <id>` - Mark task as complete
* `/delete <id>` - Delete a task/reminder
* `/help` - View all available commands

---

### Daily Summary (Auto-Scheduled)

**NEW!** Every morning at 8 AM, receive:

* Tasks due today
* Upcoming deadlines
* Motivational message to start your day

---

### Automatic Memory System (Second Brain)

The bot automatically detects and stores important information such as:

* Tasks
* Assignments
* Exams
* Projects
* Goals
* Ideas
* Notes
* Reminders

No manual commands required.

---

### Context-Aware Responses

Before generating replies, AtharvaOS:

* Fetches recent memories
* Injects them into AI context
* Produces personalized guidance

Example:

If a DBMS assignment is stored, the bot will prioritize it when planning your day.

---

### Task Recall System

Ask:

```
What are my tasks
```

The bot:

* Fetches all stored tasks
* Sorts by deadline
* Displays a clean formatted list

---

### Automatic Deadline Detection

When the user mentions:

* dates
* tomorrow
* Monday
* specific deadlines

The system:

* Extracts date
* Stores it in database
* Tracks upcoming events

---

### Reminder Engine

Background scheduler:

* Checks upcoming deadlines
* Sends reminders automatically
* Notifies before due time

---

### Clean Telegram Formatting

* Structured responses
* Bullet lists
* Headings
* Actionable steps

---

## Tech Stack

**Backend**

* Node.js
* Telegraf (Telegram Bot Framework)

**AI**

* Groq API
* LLaMA / OSS models

**Database**

* MongoDB Atlas

**Automation**

* node-cron (scheduler)

---

## Architecture

```
User (Telegram)
      ↓
Telegram Bot (Telegraf)
      ↓
Message Processing Layer
      ↓
AI Classifier (Groq)
      ↓
Memory Storage (MongoDB)
      ↓
Context Injection
      ↓
AI Response Generator
      ↓
Reminder Scheduler
```

---

## How It Works

1. User sends message to bot
2. AI classifies if message is important
3. Important information is stored in MongoDB with user's chat ID
4. Recent memory is injected into AI context
5. AI generates a structured productivity response
6. Scheduler monitors deadlines and sends reminders
7. Daily summary sent automatically at 8 AM
8. Users can manage tasks with commands (/tasks, /done, /delete)

---

## Available Commands

* `/start` - Wake up your productivity buddy! 🚀
* `/tasks` - See what's pending (with spicy deadline warnings 🔥)
* `/reminders` - Check active reminders
* `/goals` - View your goals
* `/today` - Get today's game plan with time-based greetings
* `/done <id>` - Mark task complete (GET HYPED! 🎉)
* `/delete <id>` - Delete a task/reminder
* `/motivate` - Need a boost? Get instant motivation! 💪
* `/roast` - Get playfully roasted (builds character 😂)
* `/help` - View all commands

**Pro Tip:** Just chat naturally! The bot understands context and will store important stuff automatically while keeping the conversation fun! 😎

---

## Installation

### 1. Clone Repository

```
git clone <repo-url>
cd atharvaos-bot
```

---

### 2. Install Dependencies

```
npm install
```

---

### 3. Create `.env`

```
BOT_TOKEN=your_telegram_bot_token
GROQ_API_KEY=your_groq_api_key
MONGO_URI=your_mongodb_connection_string
CHAT_ID=your_telegram_chat_id
```

---

### 4. Run the Bot

```
node index.js
```

---

## Project Structure

```
atharvaos-bot
 ├── index.js
 ├── ai.js
 ├── memoryAI.js
 ├── memoryModel.js
 ├── taskService.js
 ├── reminderService.js
 ├── .env
 └── package.json
```

---

## Use Cases

* Personal productivity management
* Assignment tracking
* Exam preparation
* Project planning
* Second brain knowledge storage
* Daily planning assistant

---

## Future Improvements

* ~~Priority detection engine~~ ✅ Task completion tracking added
* ~~Daily schedule generator~~ ✅ Daily summary at 8 AM added
* ~~Task management~~ ✅ Mark done, delete commands added
* Recurring reminders (every Monday, daily, etc.)
* Focus mode system with Pomodoro timer
* Web dashboard with analytics
* Multi-device sync
* Voice note transcription
* Habit tracking
* Natural language date parsing improvements
* Snooze reminders
* Priority levels (high/medium/low)

---

## Project Vision

AtharvaOS aims to become a **personal productivity operating system** that:

* Understands user goals
* Tracks work automatically
* Encourages disciplined execution
* Acts like a future, more focused version of the user

---

## Author

**Atharva Baodhankar**
Web Developer | Blockchain Enthusiast | AI Builder

---

## License

This project is intended for personal productivity and educational purposes.
