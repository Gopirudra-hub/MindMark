import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import * as api from '../api';

export default function BookmarkDetail() {
  const { id } = useParams();
  const [bookmark, setBookmark] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [insights, setInsights] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadBookmarkData();
  }, [id]);

  async function loadBookmarkData() {
    try {
      setLoading(true);
      const [bookmarkRes, analyticsRes, insightsRes] = await Promise.all([
        api.getBookmark(id),
        api.getBookmarkAnalytics(id),
        api.getBookmarkInsights(id)
      ]);
      setBookmark(bookmarkRes.data);
      setAnalytics(analyticsRes.data);
      setInsights(insightsRes.data);
    } catch (error) {
      console.error('Failed to load bookmark:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSummary() {
    setGenerating(true);
    try {
      const res = await api.generateSummary(id, 'all');
      setBookmark({
        ...bookmark,
        summary: res.data.summary,
        detailedSummary: res.data.detailedSummary,
        keyConcepts: res.data.keyConcepts
      });
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('Failed to generate summary. Make sure AI service is running.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateQuestions() {
    setGenerating(true);
    try {
      const res = await api.generateQuestions(id);
      setBookmark({
        ...bookmark,
        questions: res.data.questions
      });
    } catch (error) {
      console.error('Failed to generate questions:', error);
      alert('Failed to generate questions. Make sure AI service is running.');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!bookmark) {
    return <div className="text-center py-8">Bookmark not found</div>;
  }

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'questions', label: 'Questions' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'insights', label: 'Insights' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{bookmark.title}</h1>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline text-sm"
            >
              {bookmark.url}
            </a>
            <div className="flex items-center gap-3 mt-3">
              {bookmark.category && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {bookmark.category.name}
                </span>
              )}
              {bookmark.tags?.map(bt => (
                <span
                  key={bt.tag.id}
                  className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                >
                  {bt.tag.name}
                </span>
              ))}
            </div>
          </div>
          <Link to={`/quiz/${id}`} className="btn btn-primary">
            Start Quiz
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {activeTab === 'summary' && (
          <SummaryTab
            bookmark={bookmark}
            onGenerate={handleGenerateSummary}
            generating={generating}
          />
        )}
        {activeTab === 'questions' && (
          <QuestionsTab
            questions={bookmark.questions}
            onGenerate={handleGenerateQuestions}
            generating={generating}
          />
        )}
        {activeTab === 'quiz' && (
          <QuizTab bookmarkId={id} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab analytics={analytics} />
        )}
        {activeTab === 'insights' && (
          <InsightsTab insights={insights} />
        )}
      </div>
    </div>
  );
}

function SummaryTab({ bookmark, onGenerate, generating }) {
  if (!bookmark.summary) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No summary generated yet</p>
        <button
          onClick={onGenerate}
          disabled={generating || !bookmark.content}
          className="btn btn-primary"
        >
          {generating ? 'Generating...' : 'Generate Summary'}
        </button>
        {!bookmark.content && (
          <p className="text-sm text-gray-400 mt-2">
            Content is required to generate a summary
          </p>
        )}
      </div>
    );
  }

  let keyConcepts = bookmark.keyConcepts;
  if (typeof keyConcepts === 'string') {
    try {
      keyConcepts = JSON.parse(keyConcepts);
    } catch {
      keyConcepts = null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Summary</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{bookmark.summary}</p>
      </div>

      {bookmark.detailedSummary && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Detailed Summary</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{bookmark.detailedSummary}</p>
        </div>
      )}

      {keyConcepts && Array.isArray(keyConcepts) && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Key Concepts</h3>
          <div className="grid gap-3">
            {keyConcepts.map((concept, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">{concept.concept}</h4>
                <p className="text-sm text-gray-600">{concept.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={generating}
        className="btn btn-secondary"
      >
        {generating ? 'Regenerating...' : 'Regenerate'}
      </button>
    </div>
  );
}

function QuestionsTab({ questions, onGenerate, generating }) {
  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No questions generated yet</p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="btn btn-primary"
        >
          {generating ? 'Generating...' : 'Generate Questions'}
        </button>
      </div>
    );
  }

  const groupedQuestions = {
    mcq: questions.filter(q => q.type === 'mcq'),
    short: questions.filter(q => q.type === 'short'),
    scenario: questions.filter(q => q.type === 'scenario'),
    flashcard: questions.filter(q => q.type === 'flashcard')
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedQuestions).map(([type, qs]) => {
        if (qs.length === 0) return null;
        const labels = {
          mcq: 'Multiple Choice',
          short: 'Short Answer',
          scenario: 'Scenario Based',
          flashcard: 'Flashcards'
        };
        return (
          <div key={type}>
            <h3 className="text-lg font-semibold mb-3">{labels[type]} ({qs.length})</h3>
            <div className="space-y-3">
              {qs.map((question, index) => (
                <div key={question.id} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium">{index + 1}. {question.questionText}</p>
                  {question.options && (
                    <ul className="mt-2 ml-4 space-y-1">
                      {question.options.map((opt, i) => (
                        <li key={i} className={`text-sm ${
                          opt === question.correctAnswer ? 'text-green-600 font-medium' : 'text-gray-600'
                        }`}>
                          {String.fromCharCode(65 + i)}. {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  {question.type !== 'mcq' && (
                    <p className="mt-2 text-sm text-green-600">
                      <strong>Answer:</strong> {question.correctAnswer}
                    </p>
                  )}
                  {question.explanation && (
                    <p className="mt-2 text-sm text-gray-500">
                      <strong>Explanation:</strong> {question.explanation}
                    </p>
                  )}
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                    question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                    question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {question.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button
        onClick={onGenerate}
        disabled={generating}
        className="btn btn-secondary"
      >
        {generating ? 'Regenerating...' : 'Regenerate Questions'}
      </button>
    </div>
  );
}

function QuizTab({ bookmarkId }) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500 mb-4">Ready to test your knowledge?</p>
      <Link to={`/quiz/${bookmarkId}`} className="btn btn-primary">
        Start Quiz
      </Link>
    </div>
  );
}

function AnalyticsTab({ analytics }) {
  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No quiz attempts yet. Take a quiz to see analytics!</p>
      </div>
    );
  }

  const chartData = {
    labels: analytics.scoreProgression.map((_, i) => `Attempt ${i + 1}`),
    datasets: [{
      label: 'Score',
      data: analytics.scoreProgression.map(p => p.score),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      tension: 0.3
    }]
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-500">Total Attempts</p>
          <p className="text-2xl font-bold">{analytics.totalAttempts}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-500">Average Score</p>
          <p className="text-2xl font-bold text-primary-600">{analytics.avgScore}%</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-500">Days Since Review</p>
          <p className="text-2xl font-bold">{analytics.daysSinceLastReview ?? 'Never'}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-500">Total Questions</p>
          <p className="text-2xl font-bold">{analytics.totalQuestions}</p>
        </div>
      </div>

      {analytics.scoreProgression.length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Score Progression</h3>
          <div className="h-64">
            <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}

      {analytics.weakQuestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Weak Questions</h3>
          <div className="space-y-2">
            {analytics.weakQuestions.map(q => (
              <div key={q.questionId} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm">{q.questionText}</p>
                <p className="text-xs text-red-600 mt-1">
                  Correct rate: {Math.round(q.correctRate * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightsTab({ insights }) {
  if (insights.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No insights yet. Take more quizzes to get personalized insights!</p>
      </div>
    );
  }

  const priorityColors = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    positive: 'bg-green-50 border-green-200 text-green-800'
  };

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg border ${priorityColors[insight.priority]}`}
        >
          {insight.message}
        </div>
      ))}
    </div>
  );
}
