# 🔍 RAGgit - Chat with Any GitHub Repository

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.0.1-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Groq-LLaMA_3.3-orange?style=for-the-badge" alt="Groq">
</p>

RAGgit is a **Retrieval-Augmented Generation (RAG)** application that allows you to have intelligent conversations with any public GitHub repository. Simply submit a repository URL, and within seconds you can ask questions about the codebase, understand its architecture, or get help with implementation details.

## ✨ Features

- 🚀 **Instant Repository Ingestion** - Submit any public GitHub repo and start chatting
- 🧠 **Semantic Code Search** - Uses vector embeddings to find the most relevant code snippets
- 💬 **Intelligent Conversations** - Powered by Groq's LLaMA 3.3 70B model for accurate responses
- 📊 **Real-time Status Updates** - Track repository processing progress
- 🔄 **Async Processing** - Background workers handle large repositories efficiently
- 🎯 **Smart File Filtering** - Prioritizes source code over tests and documentation

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  Supabase Edge   │────▶│   PostgreSQL    │
│   (Frontend)    │     │    Functions     │     │   + pgvector    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       ▼                        │
        │               ┌──────────────┐                 │
        │               │  GitHub API  │                 │
        │               └──────────────┘                 │
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Chat API     │────▶│ Jina Embeddings  │     │   pgmq Queue    │
│   (Groq LLM)    │     │   (1024 dims)    │     │   (Job Queue)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 16.0.1 (App Router, Turbopack) |
| **Database** | Supabase PostgreSQL with pgvector |
| **Embeddings** | Jina Embeddings v3 (1024 dimensions) |
| **LLM** | Groq - LLaMA 3.3 70B Versatile |
| **Queue** | pgmq (PostgreSQL Message Queue) |
| **Edge Functions** | Supabase Edge Functions (Deno) |
| **Styling** | Tailwind CSS |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Groq API key
- Jina AI API key
- GitHub Personal Access Token (optional, for higher rate limits)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/raggit.git
   cd raggit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your credentials (see [Environment Variables](#-environment-variables) section)

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/` folder
   - Deploy the Edge Function:
     ```bash
     supabase functions deploy repo-processor
     ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the app**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔐 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
SCALEUP_SUPABASE_URL=https://your-project.supabase.co
SCALEUP_SUPABASE_ANON_KEY=your-anon-key
SCALEUP_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Services
SCALEUP_JINA_API_KEY=your-jina-api-key
GROQ_API_KEY=your-groq-api-key

# GitHub (optional - for higher rate limits)
GITHUB_TOKEN=your-github-pat
```

See `.env.example` for a complete template.

## 📁 Project Structure

```
raggit/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/          # Chat API endpoint (Groq + RAG)
│   │   │   └── process-repo/  # Repository submission endpoint
│   │   ├── chat/[id]/         # Chat page for specific repo
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   ├── RepoInputForm.tsx  # Repository URL input
│   │   └── RepoList.tsx       # List of processed repos
│   └── lib/
│       ├── serverClients.ts   # Server-side Supabase client
│       └── supabaseClient.ts  # Browser-side Supabase client
├── supabase/
│   ├── functions/
│   │   └── repo-processor/    # Edge Function for processing repos
│   └── migrations/            # Database migrations
└── docs/
    └── scale-up-plan.md       # Architecture documentation
```

## 🔧 API Reference

### POST `/api/process-repo`

Submit a new repository for processing.

**Request:**
```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

**Response:**
```json
{
  "success": true,
  "repo": {
    "id": "uuid",
    "name": "owner/repo",
    "status": "PENDING"
  }
}
```

### POST `/api/chat`

Send a message to chat with a repository.

**Request:**
```json
{
  "repoId": "uuid",
  "message": "How does the authentication work?"
}
```

**Response:**
```json
{
  "reply": "Based on the codebase, authentication is handled by..."
}
```

## 📊 Database Schema

### Tables

- **`repositories`** - Stores repository metadata and processing status
- **`repo_chunks`** - Stores code chunks with vector embeddings

### Key Functions

- **`match_code_chunks`** - Performs semantic similarity search using pgvector

## 🎯 How It Works

1. **Submit Repository** - Enter a GitHub URL on the home page
2. **Queue Processing** - The repo is added to a PostgreSQL message queue
3. **Edge Function Processing**:
   - Fetches repository structure via GitHub API
   - Filters and prioritizes source code files
   - Chunks code into meaningful segments
   - Generates embeddings using Jina AI
   - Stores chunks with vectors in PostgreSQL
4. **Chat Interface**:
   - User asks a question
   - Question is embedded using Jina AI
   - Semantic search finds relevant code chunks
   - Context + question sent to Groq LLM
   - Response streamed back to user

## ⚠️ Limitations

- **Repository Size**: Large repos (>150 files) are automatically filtered
- **Processing Time**: Edge Functions have a ~60s timeout
- **Rate Limits**: GitHub API has rate limits (higher with token)
- **Public Repos Only**: Currently only supports public repositories

## 🛠️ Development

### Running locally

```bash
# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Deploying Edge Functions

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy repo-processor
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [Groq](https://groq.com/) - Fast AI inference
- [Jina AI](https://jina.ai/) - Neural search company
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search for PostgreSQL

---

<p align="center">
  Made with ❤️ by the RAGgit Team
</p>
