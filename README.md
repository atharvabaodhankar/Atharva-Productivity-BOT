# AtharvaOS — Serverless AI Productivity Copilot & RAG Second Brain 🚀

[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Atharva_Produtivity_Bot)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![Amazon Bedrock Titan](https://img.shields.io/badge/Amazon_Bedrock-Titan_Embeddings_v2-0052CC?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon Polly](https://img.shields.io/badge/Amazon-Polly_Voice-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/polly/)
[![Groq AI](https://img.shields.io/badge/Groq-Qwen_3.6_27B_%7C_Vision-F55036?style=for-the-badge)](https://groq.com/)
[![MongoDB Atlas Vector](https://img.shields.io/badge/MongoDB-Atlas_Vector_Search-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Vercel](https://img.shields.io/badge/Vercel-Hosted-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**AtharvaOS** is an enterprise-grade serverless AI personal productivity operating system and **RAG-powered second brain** built on Node.js, AWS Lambda, Amazon Bedrock, and MongoDB Atlas. It functions as an energetic Telegram copilot, high-precision task planner, spoken audio briefer, and Telegram Mini App.

---

## 🏗️ System Architecture

![AtharvaOS System Architecture](assets/architecture-diagram.jpg)

```mermaid
flowchart TD
    subgraph ClientLayer["📱 Client Layer"]
        TG["👤 Telegram Messenger (Direct DM & Groups)"]
        MINI["📱 Telegram Mini App (/webapp)"]
        ADMIN["💻 Mission Control Console (/admin-console)"]
    end

    subgraph AWSCloud["⚡ AWS Serverless Cloud (ap-south-1)"]
        LAMBDA["⚡ AWS Lambda (AtharvaOS-Bot Core)"]
        EB["⏰ Amazon EventBridge (5m Cron Trigger)"]
        POLLY["🎙️ Amazon Polly (Matthew Voice Synthesis)"]
        TITAN["🧠 Amazon Bedrock (Titan Text Embeddings v2)"]
    end

    subgraph DataAndAI["🧠 AI & Data Persistence Layer"]
        GROQ["⚡ Groq AI Pool (Qwen 3.6 27B & Llama 3.2 Vision)"]
        MONGO[("📦 MongoDB Atlas (Vector Search & Knowledge Base)")]
        REDDIT["🎬 Reddit Streaming API"]
    end

    TG <-->|"Webhooks / Updates"| LAMBDA
    MINI <-->|"REST API"| LAMBDA
    ADMIN <-->|"REST API"| LAMBDA

    EB -->|"Scheduled 5m Ping"| LAMBDA
    LAMBDA -->|"Synthesize Spoken Briefing"| POLLY
    LAMBDA -->|"Generate 512d Embeddings"| TITAN
    LAMBDA -->|"Semantic Vector Search & Storage"| MONGO
    LAMBDA -->|"Contextual LLM Reasoning"| GROQ
    LAMBDA -->|"Stream Video Buffers"| REDDIT
```

---

## 🌟 Superpowers & Core Features

### 🧠 1. RAG Knowledge Engine (Amazon Titan Text Embeddings v2)
* **Semantic Vector Retrieval:** Uses Amazon Bedrock's **`amazon.titan-embed-text-v2:0`** in `ap-south-1` to generate 512-dimension normalized embeddings for every task, note, goal, bookmark, and study plan.
* **Instant Historical Recall:** Performs vector cosine similarity search across your entire historical knowledge base on every query. Ask *"What did I plan for Rust?"* or *"What did I note down about OS assignments?"* and AtharvaOS grounds its response in your past records.
* **Zero-Hallucination Context Grounding:** Injects real-time semantic context into LLM prompts without blowing context windows or incurring high token costs.

### 🎙️ 2. Amazon Polly AI Voice Notes (`/speak`)
* **Spoken Audio Briefings:** Generates native Telegram voice notes using Amazon Polly's **Matthew** neural voice.
* **Speech Pronunciation Sanitizer:** Automatically scrubs Markdown symbols, code blocks, bullet points, and URLs into smooth conversational speech.
* **Slash Commands & Natural Triggers:** Trigger via `/speak <prompt>`, `/voice <prompt>`, `/audio <prompt>`, or by simply asking *"speak to me"* or *"bol ke batao"*.
* **Daily Quota Governance:** Unlimited voice synthesis for the Creator/Owner; 5 free notes per day for guests.

### ⏰ 3. Automated Daily Briefings & Granular User Toggles
* **8:00 AM Morning Game Plan:** Prioritizes today's urgent deadlines, focus items, and daily momentum.
* **10:00 PM Nightly Accountability Check-In:** Reviews completed wins and highlights pending tasks before bed.
* **1-Tap Interactive Control Hub (`/reminders` / `/daily`):** Easily turn ON/OFF 8 AM Morning Briefings, 10 PM Night Check-Ins, or all daily reminders with instant button toggles.
* **Natural Voice/Text Controls:** Simply tell the bot *"stop morning messages"*, *"disable nightly check-in"*, or *"mute daily reminders"*.

### 👥 4. Group Privacy & Direct Slash Commands (`/ask` / `/ai`)
* **Strict Group Privacy Guardrail:** Automated personal reminders and daily summaries are **strictly excluded from group chats** to ensure your data stays 100% private.
* **Direct Group Queries (`/ask <question>`):** Group members can query the bot with `/ask`, `/ai`, or by tagging `@Atharva_Produtivity_Bot`.
* **Stateless Mention Parser:** Robust mention parsing ensures instant responses across all Telegram client variants.

### 📱 5. Telegram Mini App (Flo 101 Design)
* **Safe Sandbox Experience:** Accessible via the Telegram menu button `[🔲 Open AtharvaOS]` or chat menu.
* **Interactive SVG Progress Ring:** Real-time completion metrics, dynamic category filtering, and micro-animations.
* **Project-Task Hierarchy:** Organize subtasks neatly inside high-level project containers.

### 💬 6. Human-Paced Multi-Bubble Messaging
* **Conversational Pacing:** Automatically breaks multi-paragraph AI answers into natural multi-bubble messages.
* **Micro-Typing Simulation:** Displays live `"typing"` indicators between message bubbles for an organic conversation flow.

### 🎬 7. Reddit Video Streaming (`/video`)
* **Binary Buffer Streaming:** Streams raw Reddit `.mp4` video buffers directly into Telegram with `{ supports_streaming: true }`, ensuring instant scrubbing and native audio playback.

---

## 📋 Complete Command Reference

| Command | Description | Example |
|---|---|---|
| `/start` | Activate AtharvaOS and initialize your profile | `/start` |
| `/tasks` | View pending tasks organized by priority and urgency | `/tasks` |
| `/today` | Generate today's personalized action plan | `/today` |
| `/ask <query>` | Ask any question directly in DMs or group chats | `/ask what is dynamic programming?` |
| `/speak <prompt>` | Receive a spoken AI Voice Note (Amazon Polly Matthew voice) | `/speak Summarize my focus for today!` |
| `/reminders` | Interactive dashboard to view reminders & toggle morning/night briefings | `/reminders` |
| `/goals` | View long-term objectives and habit trackers | `/goals` |
| `/reflections` | View your 7-day retrospective growth log | `/reflections` |
| `/done <id>` | Mark a specific task completed by ID | `/done 6a813d35...` |
| `/delete <id>` | Delete a specific task or reminder | `/delete 6a813d35...` |
| `/video [subreddit]` | Stream a video buffer from any subreddit | `/video dankvideos` |
| `/motivate` | Instant high-energy motivation shot 🔥 | `/motivate` |
| `/roast` | Playful, witty Hinglish roast 😂 | `/roast` |
| `/help` | Complete interactive command guide | `/help` |

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
CHAT_ID=5275149287
MONGO_URI=mongodb+srv://user:pass@cluster0.mongodb.net/atharvaos?retryWrites=true&w=majority

# Amazon Bedrock (ap-south-1)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0

# LLM Reasoning & Fallback
GROQ_API_KEY=gsk_key1,gsk_key2
MEME_API_URL=https://redditreels.onrender.com
MEME_API_KEY=your_meme_api_key
ADMIN_SECRET=your_admin_secret
```

### 3. Run Embedding Backfill (One-time Setup)
```bash
# Embed all existing historical MongoDB records with Titan v2
node scripts/backfillEmbeddings.js
```

### 4. Run Locally
```bash
# Start Telegram Polling Bot
npm start

# Run Local Admin Console (optional)
npm run admin
```

---

## 🚀 Cloud Deployment

### AWS Lambda CI/CD (GitHub Actions)
The repository includes automated CI/CD (`.github/workflows/deploy.yml`) that builds, packages, and deploys updates to AWS Lambda whenever changes are pushed to `main`.

Required **GitHub Actions Secrets**:
* `AWS_ACCESS_KEY_ID` *(Lambda Deploy Role)*
* `AWS_SECRET_ACCESS_KEY` *(Lambda Deploy Role)*
* `BEDROCK_AWS_ACCESS_KEY_ID` *(Bedrock Titan & Polly Access)*
* `BEDROCK_AWS_SECRET_ACCESS_KEY` *(Bedrock Titan & Polly Access)*
* `BEDROCK_AWS_REGION` *(Default: `ap-south-1`)*
* `BEDROCK_EMBEDDING_MODEL_ID` *(Default: `amazon.titan-embed-text-v2:0`)*
* `BOT_TOKEN`
* `MONGO_URI`
* `GROQ_API_KEY`
* `CHAT_ID`

---

## 👤 Author

**Atharva Baodhankar**
* 🌐 GitHub: [@atharvabaodhankar](https://github.com/atharvabaodhankar)
* 💼 LinkedIn: [Atharva Baodhankar](https://linkedin.com/in/atharva-baodhankar/)
* 📸 Instagram: [@atharvabaodhankar](https://instagram.com/atharvabaodhankar/)
* 🤖 Telegram Bot: [@Atharva_Produtivity_Bot](https://t.me/Atharva_Produtivity_Bot)

---

## 📄 License
This project is open-source under the [ISC License](LICENSE).
