# Bookmart - AI Bookmark Learning & Retention System

An intelligent bookmark management system that extracts content, generates AI-powered summaries and questions, tracks quiz attempts, schedules revision, and provides performance analytics.

## 🚀 Features

- **📚 Smart Bookmarking**: Save and categorize web content with automatic content extraction
- **🤖 AI-Powered Learning**: Generate summaries, key concepts, and various question types (MCQ, short answer, scenario-based, flashcards)
- **📝 Quiz System**: Test your knowledge with multiple quiz modes (mixed, timed, specific types)
- **📅 Revision Scheduling**: Spaced repetition based on performance (rule-based scheduling)
- **📊 Analytics Dashboard**: Track performance trends, identify weak areas, measure progress
- **💡 Smart Insights**: Rule-based insights about learning patterns and recommendations
- **🔌 Chrome Extension**: Quick save and generate content from any webpage

## 🏗️ Architecture

```
Chrome Extension (Thin Client)
        ↓
Web Dashboard (React SPA)
        ↓
Backend API (Node + Express)
        ↓
PostgreSQL
        ↓
AI Provider (Local Ollama OR Cloud API)
```

## 📦 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Chart.js
- **Backend**: Node.js 20+, Express, Prisma ORM, Zod validation
- **Database**: PostgreSQL 15
- **AI**: Ollama (local) or OpenAI API (cloud)
- **Extension**: Chrome Manifest V3

## 🛠️ Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Chrome browser (for extension)

### Quick Start with Docker

1. **Clone and start services**:

   ```bash
   cd Bookmart-project
   docker-compose up -d
   ```

2. **Initialize database**:

   ```bash
   docker-compose exec backend npx prisma db push
   ```

3. **Pull Ollama model** (for local AI):

   ```bash
   docker-compose exec ollama ollama pull llama2
   ```

4. **Access the application**:
   - Dashboard: http://localhost:5173
   - API: http://localhost:3000
   - Ollama: http://localhost:11434

### Install Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder
5. The Bookmart icon will appear in your toolbar

### Local Development (without Docker)

1. **Setup Backend**:

   ```bash
   cd backend
   npm install

   # Create .env file
   echo "DATABASE_URL=postgresql://user:pass@localhost:5432/bookmart" > .env
   echo "AI_PROVIDER=local" >> .env
   echo "AI_BASE_URL=http://localhost:11434" >> .env

   # Push schema and start
   npx prisma db push
   npm run dev
   ```

2. **Setup Frontend**:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Start Ollama** (optional, for local AI):
   ```bash
   ollama serve
   ollama pull llama2
   ```

## 📁 Project Structure

```
Bookmart-project/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── src/
│   │   ├── index.js           # Express app entry
│   │   ├── routes/            # API routes
│   │   │   ├── bookmarks.js
│   │   │   ├── categories.js
│   │   │   ├── tags.js
│   │   │   ├── quiz.js
│   │   │   ├── analytics.js
│   │   │   ├── insights.js
│   │   │   └── ai.js
│   │   └── services/          # Business logic
│   │       ├── aiProvider.js
│   │       ├── revisionEngine.js
│   │       ├── analyticsService.js
│   │       └── insightEngine.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js             # API client
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Bookmarks.jsx
│   │       ├── BookmarkDetail.jsx
│   │       ├── Categories.jsx
│   │       ├── DailyReview.jsx
│   │       ├── Quiz.jsx
│   │       └── Analytics.jsx
│   ├── package.json
│   └── Dockerfile
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── background.js
│   └── content.js
└── docker-compose.yml
```

## 🔌 API Endpoints

### Bookmarks

- `GET /api/bookmarks` - List bookmarks with filters
- `POST /api/bookmarks` - Create bookmark
- `GET /api/bookmarks/:id` - Get bookmark details
- `PUT /api/bookmarks/:id` - Update bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark

### Categories

- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Rename category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/merge` - Merge categories

### Quiz

- `GET /api/quiz/bookmark/:id` - Get quiz questions
- `POST /api/quiz/submit` - Submit quiz
- `GET /api/quiz/daily-review` - Get daily review
- `POST /api/quiz/daily-review/submit` - Submit daily review

### AI Generation

- `POST /api/ai/generate-summary` - Generate summary
- `POST /api/ai/generate-questions` - Generate questions
- `POST /api/ai/regenerate` - Force regeneration

### Analytics

- `GET /api/analytics` - Global analytics
- `GET /api/analytics/trend` - Performance trend
- `GET /api/analytics/category/:id` - Category analytics
- `GET /api/analytics/bookmark/:id` - Bookmark analytics

### Insights

- `GET /api/insights` - All insights
- `GET /api/insights/category/:id` - Category insights
- `GET /api/insights/bookmark/:id` - Bookmark insights

## ⚙️ Configuration

### Environment Variables

**Backend**:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
AI_PROVIDER=local|cloud
AI_BASE_URL=http://ollama:11434
CLOUD_API_KEY=sk-xxx  # For cloud AI
CLOUD_API_URL=https://api.openai.com/v1
PORT=3000
NODE_ENV=development|production
```

**Frontend**:

```env
VITE_API_URL=http://localhost:3000
```

## 📅 Revision Scheduling Rules

| Score  | Next Review |
| ------ | ----------- |
| ≥ 80%  | 5 days      |
| 50-79% | 3 days      |
| < 50%  | 1 day       |

## 🚀 Production Deployment

1. **Switch to cloud AI**:

   ```env
   AI_PROVIDER=cloud
   CLOUD_API_KEY=your-api-key
   ```

2. **Use managed PostgreSQL** (e.g., Neon, Supabase, Railway)

3. **Deploy services**:
   - Backend: Railway, Render, or any Docker host
   - Frontend: Vercel, Netlify, or any static host

4. **Update extension API URL** in `popup.js` and `background.js`

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
