# AtharvaOS — AI Productivity Copilot & Mission Control 🚀

[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Atharva_Produtivity_Bot)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![Amazon Polly](https://img.shields.io/badge/Amazon-Polly_Voice-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/polly/)
[![Groq AI](https://img.shields.io/badge/Groq-Qwen_3.6_27B_%7C_GPT_OSS_120B-F55036?style=for-the-badge)](https://groq.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Vercel](https://img.shields.io/badge/Vercel-Hosted-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**AtharvaOS** is a serverless AI personal productivity operating system and second brain designed as an energetic Telegram copilot, high-precision task planner, and monochrome mission control console.

---

## 🌟 Superpowers & Core Features

### 🎙️ 1. Amazon Polly AI Voice Notes (`/speak`)
* **Spoken Audio Briefings:** Generate native Telegram voice notes using Amazon Polly's standard **Matthew** voice.
* **Smart Speech Filter:** Automatically sanitizes markdown, URLs, code blocks, and formatting clutter into natural pronunciation.
* **Slash Commands & Triggers:** Trigger via `/speak <prompt>`, `/voice <prompt>`, `/audio <prompt>`, or naturally saying *"speak to me"* or *"bol ke batao"*.
* **Daily Quota Protection:** Unlimited for the Creator/Owner; 5 free voice notes per day for guest users.

### 📱 2. Telegram Mini App (Dual-Color Flo 101 Design)
* **Safe Sandbox Experience:** Public mini app accessible via the Telegram menu button `[🔲 Open AtharvaOS]` with zero admin privilege leakage.
* **Project-Task Hierarchy:** Seamlessly organize sub-tasks inside high-level project containers.
* **Interactive SVG Progress Ring:** Real-time completion percentage, quick filters, and smooth micro-animations.

### 🎛️ 3. Monochrome Mission Control (Admin POV Console)
* **Live User Directory:** Monitor all active Telegram threads and conversation histories in real-time.
* **Human Takeover & Media Dispatch:** Send live messages, photos, videos, and documents directly as the bot with instant Telegram delivery.
* **Message Editing & Deletion:** Real-time bilateral deletion and text/caption editing synchronized with Telegram.
* **Meme Approval & Quick-Cast:** Review user-requested memes with interactive confirmation modals or broadcast random memes instantly.

### 🎬 4. Reddit Video Streaming (`/video`)
* **Binary Buffer Streaming:** Streams raw Reddit `.mp4` video buffers directly into Telegram with `{ supports_streaming: true }`, ensuring audio playback, scrubbing, and native media controls.
* **Command:** `/video [subreddit]` (e.g. `/video dankvideos`, `/video wholesome`).

### 🧠 5. Multi-Key AI Failover & Vision OCR
* **Rotational Key Pool:** Automatic failover across multiple Groq API keys with exponential backoff.
* **Vision Document Parser:** Snap a photo of a handwritten checklist or whiteboard notes, and AtharvaOS extracts and categorizes tasks automatically.

### ⏰ 6. Serverless Cron Reminders (AWS EventBridge)
* **Automated Cron Triggers:** 5-minute deadline monitors, 8:00 AM Morning Game Plans, and 10:00 PM Nightly Reflections powered by Amazon EventBridge.

### 🛡️ 7. Enterprise Security Hardening
* **Zero Hardcoded Secrets:** Strict environment variable governance for all API tokens and admin passkeys.
* **ReDoS & RegExp Injection Protection:** User-supplied project and task queries are sanitized against regex injection.
* **Path Traversal Guards:** File server enforces directory confinement against traversal exploits.
* **DDoS & OOM Body Limits:** 35MB ceiling on all streaming payloads.

---

## 📋 Complete Command Reference

| Command | Description | Example |
|---|---|---|
| `/start` | Activate AtharvaOS and initialize user profile | `/start` |
| `/tasks` | View all pending tasks categorized by deadline urgency | `/tasks` |
| `/today` | Generate today's prioritized game plan | `/today` |
| `/speak <prompt>` | Receive a spoken AI Voice Note (Matthew voice) | `/speak Summarize my focus for today!` |
| `/video [sub]` | Stream a video buffer from any subreddit | `/video dankvideos` |
| `/done <id>` | Mark a specific task as completed | `/done 6a813d35...` |
| `/delete <id>` | Delete a task or reminder | `/delete 6a813d35...` |
| `/reminders` | List active deadline reminders | `/reminders` |
| `/goals` | View long-term objectives | `/goals` |
| `/reflections` | View 7-day retrospective log | `/reflections` |
| `/motivate` | Instant high-energy motivation boost | `/motivate` |
| `/roast` | Playful, loving Hinglish roast | `/roast` |
| `/help` | Comprehensive interactive command guide | `/help` |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Telegram Client
        TG["👤 User / Group Chat"]
        MA["📱 Telegram Mini App (/webapp/)"]
    end

    subgraph Mission Control
        AC["🎛️ Admin Console (/admin-console/)"]
    end

    subgraph AWS Cloud
        LAMBDA["⚡ AWS Lambda (atharvaos-bot)"]
        EB["⏰ Amazon EventBridge (5m Cron)"]
        POLLY["🎙️ Amazon Polly (Matthew Voice)"]
    end

    subgraph External Services
        GROQ["🧠 Groq AI (Llama 3.3 70B & Vision)"]
        MONGO["📦 MongoDB Atlas (Tasks, Transcripts, Alerts)"]
        REDDIT["🎬 Reddit API (Videos & Memes)"]
    end

    TG <-->|"Webhook / Updates"| LAMBDA
    MA <-->|"REST API"| LAMBDA
    AC <-->|"x-admin-secret API"| LAMBDA

    EB -->|"Scheduled Ping"| LAMBDA
    LAMBDA -->|"Synthesize Voice"| POLLY
    LAMBDA -->|"AI Reasoning"| GROQ
    LAMBDA -->|"Data Persistence"| MONGO
    LAMBDA -->|"Video Buffers"| REDDIT
```

---

## 🛠️ Local Development Setup

### 1. Clone & Install
```bash
git clone https://github.com/atharvabaodhankar/Atharva-Productivity-BOT.git
cd Atharva-Productivity-BOT
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file in the root directory:
```ini
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
GROQ_API_KEY=gsk_key1,gsk_key2,gsk_key3
MONGO_URI=mongodb+srv://user:pass@cluster0.mongodb.net/atharvaos?retryWrites=true&w=majority
CHAT_ID=5275149287
ADMIN_SECRET=Your_Custom_Secret_Key
MEME_API_URL=https://redditreels.onrender.com
MEME_API_KEY=your_meme_api_key
```

### 3. Run Locally
```bash
# Start Telegram Polling Bot
npm start

# Start Local Admin Mission Control (Port 4000)
npm run admin
```

---

## 🚀 Cloud Deployment

### 1. AWS Lambda Deployment (CI/CD)
The repository includes automated GitHub Actions (`.github/workflows/deploy.yml`) that packages and deploys updates to AWS Lambda whenever changes are pushed to `main`.

Required **GitHub Actions Secrets**:
* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `BOT_TOKEN`
* `MONGO_URI`
* `GROQ_API_KEY`
* `CHAT_ID`
* `ADMIN_SECRET`
* `MEME_API_URL`
* `MEME_API_KEY`

### 2. Vercel Frontend Deployment
Deploy the repository directly to Vercel:
* **Root Directory:** `./`
* **Static Output:** Routes `/` to `admin-console/index.html` and `/webapp/` to `webapp/index.html`.

---

## 👤 Author

**Atharva Baodhankar**
* 🌐 GitHub: [@atharvabaodhankar](https://github.com/atharvabaodhankar)
* ✈️ Telegram: [@op_athu](https://t.me/op_athu)
* 🤖 Bot: [@Atharva_Produtivity_Bot](https://t.me/Atharva_Produtivity_Bot)

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).
