# AtharvaOS — AI Productivity Copilot 🚀

[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Atharva_Produtivity_Bot)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon-Bedrock_Nova-0052CC?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon Polly](https://img.shields.io/badge/Amazon-Polly_Voice-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/polly/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Vercel](https://img.shields.io/badge/Vercel-Hosted-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**AtharvaOS** is a serverless AI personal productivity operating system and second brain designed as an energetic Telegram copilot, high-precision task planner, and productivity engine powered by **Amazon Bedrock (Nova Micro & Nova Lite)**.

---

## 🌟 Superpowers & Core Features

### 🧠 1. Amazon Bedrock Foundation Models & Multimodal Vision
* **Amazon Nova Micro (`apac.amazon.nova-micro-v1:0`):** Ultra-low latency reasoning, dynamic conversational planning, structured JSON tool execution, and contextual memory operations.
* **Amazon Nova Lite (`apac.amazon.nova-lite-v1:0`):** Multimodal document & image analysis — snap a photo of handwritten notes or a whiteboard checklist and AtharvaOS extracts, schedules, and categorizes tasks automatically.
* **Titan Embeddings (`amazon.titan-embed-text-v2:0`):** Semantic vector retrieval for long-term user memory and context.
* **Resilient Multi-Key Fallback:** Built-in failover to high-throughput Groq LLM pool if Bedrock limits are reached.

### 🎙️ 2. Amazon Polly AI Voice Notes (`/speak`)
* **Spoken Audio Briefings:** Generate native Telegram voice notes using Amazon Polly's standard **Matthew** voice.
* **Smart Speech Filter:** Automatically sanitizes markdown, URLs, code blocks, and formatting clutter into natural pronunciation.
* **Slash Commands & Triggers:** Trigger via `/speak <prompt>`, `/voice <prompt>`, `/audio <prompt>`, or naturally saying *"speak to me"* or *"bol ke batao"*.
* **Daily Quota Protection:** Unlimited for the Creator/Owner; 5 free voice notes per day for guest users.

### 📱 3. Telegram Mini App (Dual-Color Flo 101 Design)
* **Safe Sandbox Experience:** Public mini app accessible via the Telegram menu button `[🔲 Open AtharvaOS]` or chat menu.
* **Project-Task Hierarchy:** Seamlessly organize sub-tasks inside high-level project containers.
* **Interactive SVG Progress Ring:** Real-time completion percentage, quick filters, and smooth micro-animations.

### 💬 4. Natural Human-Paced Multi-Bubble Messaging
* **Conversational Pacing:** Automatically breaks multi-sentence or multi-paragraph responses into natural message bubbles.
* **Micro-Typing Indicators:** Shows live `"typing"` status between bubbles for realistic conversational flow with zero extra server invocations.

### 🎬 5. Reddit Video Streaming (`/video`)
* **Binary Buffer Streaming:** Streams raw Reddit `.mp4` video buffers directly into Telegram with `{ supports_streaming: true }`, ensuring audio playback, scrubbing, and native media controls.
* **Command:** `/video [subreddit]` (e.g. `/video dankvideos`, `/video wholesome`).

### ⏰ 6. Serverless Cron Reminders (AWS EventBridge)
* **Automated Cron Triggers:** 5-minute deadline monitors, 8:00 AM Morning Game Plans, and 10:00 PM Nightly Reflections powered by Amazon EventBridge.

### 🛡️ 7. Enterprise Security Hardening
* **Zero Hardcoded Secrets:** Strict environment variable governance for all API tokens and keys.
* **Multi-Account AWS Credential Isolation:** Explicit credential separation between AWS Lambda execution and Amazon Bedrock inference.
* **ReDoS & RegExp Injection Protection:** User-supplied project and task queries are sanitized against regex injection.
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

    subgraph AWS Cloud Account A [Lambda Host]
        LAMBDA["⚡ AWS Lambda (AtharvaOS-Bot)"]
        EB["⏰ Amazon EventBridge (5m Cron)"]
        POLLY["🎙️ Amazon Polly (Matthew Voice)"]
    end

    subgraph AWS Cloud Account B [AI Foundation Models]
        BEDROCK_TEXT["🧠 Amazon Bedrock (Nova Micro - Text & Tools)"]
        BEDROCK_VISION["👁️ Amazon Bedrock (Nova Lite - Multimodal Vision)"]
    end

    subgraph External Services
        GROQ["⚡ Groq AI (Fallback LLM Pool)"]
        MONGO["📦 MongoDB Atlas (Tasks, Transcripts, Alerts)"]
        REDDIT["🎬 Reddit API (Videos & Memes)"]
    end

    TG <-->|"Webhook / Updates"| LAMBDA
    MA <-->|"REST API"| LAMBDA

    EB -->|"Scheduled Ping"| LAMBDA
    LAMBDA -->|"Synthesize Voice"| POLLY
    LAMBDA -->|"Cross-Account IAM / Keys"| BEDROCK_TEXT
    LAMBDA -->|"Cross-Account IAM / Keys"| BEDROCK_VISION
    LAMBDA -.->|"Resilient Fallback"| GROQ
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
CHAT_ID=5275149287
MONGO_URI=mongodb+srv://user:pass@cluster0.mongodb.net/atharvaos?retryWrites=true&w=majority

# Amazon Bedrock (Account B)
BEDROCK_AWS_REGION=ap-south-1
BEDROCK_AWS_ACCESS_KEY_ID=your_bedrock_access_key
BEDROCK_AWS_SECRET_ACCESS_KEY=your_bedrock_secret_key
BEDROCK_LLM_MODEL_ID=apac.amazon.nova-micro-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0

# Fallbacks & Extras
GROQ_API_KEY=gsk_key1,gsk_key2
MEME_API_URL=https://redditreels.onrender.com
MEME_API_KEY=your_meme_api_key
ADMIN_SECRET=your_admin_secret
```

### 3. Run Locally
```bash
# Start Telegram Polling Bot
npm start
```

---

## 🚀 Cloud Deployment

### 1. AWS Lambda Deployment (CI/CD)
The repository includes automated GitHub Actions (`.github/workflows/deploy.yml`) that packages and deploys updates to AWS Lambda whenever changes are pushed to `main`.

Required **GitHub Actions Secrets**:
* `AWS_ACCESS_KEY_ID` *(Account A - Deploying to Lambda)*
* `AWS_SECRET_ACCESS_KEY` *(Account A - Deploying to Lambda)*
* `BEDROCK_AWS_ACCESS_KEY_ID` *(Account B - Amazon Bedrock Access)*
* `BEDROCK_AWS_SECRET_ACCESS_KEY` *(Account B - Amazon Bedrock Access)*
* `BEDROCK_AWS_REGION` *(Default: `ap-south-1`)*
* `BEDROCK_LLM_MODEL_ID` *(Default: `apac.amazon.nova-micro-v1:0`)*
* `BEDROCK_EMBEDDING_MODEL_ID` *(Default: `amazon.titan-embed-text-v2:0`)*
* `BOT_TOKEN`
* `MONGO_URI`
* `CHAT_ID`
* `GROQ_API_KEY`
* `MEME_API_URL`
* `MEME_API_KEY`
* `ADMIN_SECRET`

### 2. Vercel Frontend Deployment
Deploy the repository directly to Vercel for hosting the Telegram Mini App (`/webapp/`).

---

## 👤 Author

**Atharva Baodhankar**
* 🌐 GitHub: [@atharvabaodhankar](https://github.com/atharvabaodhankar)
* ✈️ Telegram: [@op_athu](https://t.me/op_athu)
* 🤖 Bot: [@Atharva_Produtivity_Bot](https://t.me/Atharva_Produtivity_Bot)

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).
