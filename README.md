# AtharvaOS — Personal Productivity & Second Brain Telegram Bot

AtharvaOS is an AI-powered personal productivity assistant built as a Telegram bot.
It acts like a **Second Brain + Productivity Coach**, helping track tasks, remember important information, detect deadlines, and keep the user focused on execution.

This project combines **AI, automation, memory systems, and reminders** into a single personal operating system.

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

### AI Productivity Assistant

* Powered by Groq LLM
* Acts as a focused, practical productivity coach
* Provides step-by-step plans instead of generic advice
* Uses stored memory to give personalized responses

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
3. Important information is stored in MongoDB
4. Recent memory is injected into AI context
5. AI generates a structured productivity response
6. Scheduler monitors deadlines and sends reminders

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

* Priority detection engine
* Daily schedule generator
* Focus mode system
* Web dashboard with analytics
* Multi-device sync
* Voice note transcription
* Habit tracking

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
