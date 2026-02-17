import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as api from '../api';

export default function Quiz() {
  const { bookmarkId } = useParams();
  const navigate = useNavigate();
  const [bookmark, setBookmark] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('mixed');
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    loadBookmarkAndQuestions();
  }, [bookmarkId]);

  useEffect(() => {
    if (mode === 'timed' && quizStarted && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (mode === 'timed' && timeRemaining === 0) {
      submitQuiz();
    }
  }, [timeRemaining, quizStarted, mode]);

  async function loadBookmarkAndQuestions() {
    try {
      const bookmarkRes = await api.getBookmark(bookmarkId);
      setBookmark(bookmarkRes.data);
    } catch (error) {
      console.error('Failed to load bookmark:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz() {
    try {
      const res = await api.getQuizQuestions(bookmarkId, { mode, limit: 10 });
      if (res.data.questions.length === 0) {
        alert('No questions available. Generate questions first.');
        return;
      }
      setQuestions(res.data.questions);
      setQuizStarted(true);
      setStartTime(Date.now());
      setCurrentQuestion(0);
      setAnswers({});
      
      if (mode === 'timed') {
        // 30 seconds per question
        setTimeRemaining(res.data.questions.length * 30);
      }
    } catch (error) {
      console.error('Failed to start quiz:', error);
    }
  }

  function handleAnswer(questionId, answer) {
    setAnswers({ ...answers, [questionId]: answer });
  }

  function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  function prevQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }

  async function submitQuiz() {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const res = await api.submitQuiz({
        bookmarkId,
        answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({
          questionId,
          selectedAnswer
        })),
        timeTaken
      });
      setResult(res.data);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      alert('Failed to submit quiz');
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

  if (result) {
    return (
      <QuizResult 
        result={result} 
        bookmark={bookmark}
        onRetry={() => {
          setResult(null);
          setQuizStarted(false);
        }}
      />
    );
  }

  if (!quizStarted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to={`/bookmarks/${bookmarkId}`} className="text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quiz</h1>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">{bookmark.title}</h2>
          
          {bookmark.questions?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No questions generated yet</p>
              <Link to={`/bookmarks/${bookmarkId}`} className="btn btn-primary">
                Generate Questions
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quiz Mode
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { value: 'mixed', label: 'Mixed', desc: 'All question types' },
                    { value: 'mcq', label: 'MCQ', desc: 'Multiple choice only' },
                    { value: 'short', label: 'Short Answer', desc: 'Written responses' },
                    { value: 'flashcard', label: 'Flashcards', desc: 'Quick recall' },
                    { value: 'timed', label: 'Timed', desc: '30s per question' }
                  ].map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        mode === m.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium">{m.label}</p>
                      <p className="text-xs text-gray-500">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {bookmark.questions?.length || 0} questions available
                </p>
                <button onClick={startQuiz} className="btn btn-primary">
                  Start Quiz
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{bookmark.title}</h1>
        <div className="flex items-center gap-4">
          {mode === 'timed' && timeRemaining !== null && (
            <span className={`text-lg font-mono ${
              timeRemaining < 30 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </span>
          )}
          <span className="text-sm text-gray-500">
            {currentQuestion + 1} / {totalQuestions}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all"
          style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-xs rounded ${
            question.type === 'mcq' ? 'bg-blue-100 text-blue-700' :
            question.type === 'short' ? 'bg-purple-100 text-purple-700' :
            question.type === 'scenario' ? 'bg-orange-100 text-orange-700' :
            'bg-green-100 text-green-700'
          }`}>
            {question.type.toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded ${
            question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
            question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {question.difficulty}
          </span>
        </div>

        <h2 className="text-lg font-medium mb-4">{question.questionText}</h2>

        {question.type === 'mcq' && question.options ? (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(question.id, option)}
                className={`w-full p-3 text-left rounded-lg border transition-colors ${
                  answers[question.id] === option
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            rows={4}
            placeholder={question.type === 'flashcard' 
              ? "What's on the back of this card?"
              : "Enter your answer..."
            }
          />
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={prevQuestion}
            disabled={currentQuestion === 0}
            className="btn btn-secondary"
          >
            Previous
          </button>

          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={`w-8 h-8 rounded-full text-sm ${
                  i === currentQuestion
                    ? 'bg-primary-600 text-white'
                    : answers[questions[i].id]
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQuestion === totalQuestions - 1 ? (
            <button
              onClick={submitQuiz}
              disabled={answeredCount < totalQuestions}
              className="btn btn-success"
            >
              Submit
            </button>
          ) : (
            <button onClick={nextQuestion} className="btn btn-primary">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizResult({ result, bookmark, onRetry }) {
  const scoreColor = result.score >= 80 ? 'text-green-600' :
                     result.score >= 50 ? 'text-yellow-600' :
                     'text-red-600';

  const scoreMessage = result.score >= 80 ? 'Excellent work!' :
                       result.score >= 50 ? 'Good effort! Keep practicing.' :
                       'Keep learning! Review the material.';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Quiz Complete!</h1>

      <div className="card p-6 text-center">
        <div className={`text-6xl font-bold mb-2 ${scoreColor}`}>
          {Math.round(result.score)}%
        </div>
        <p className="text-xl mb-2">{scoreMessage}</p>
        <p className="text-gray-500">
          {result.correct} of {result.total} correct • {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
        </p>
        <p className="text-sm text-primary-600 mt-4">
          Next review: {new Date(result.nextReviewAt).toLocaleDateString()}
        </p>
      </div>

      {/* Weak questions */}
      {result.weakQuestions.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">
            Questions to Review ({result.weakQuestions.length})
          </h2>
          <div className="space-y-3">
            {result.weakQuestions.map((q, index) => (
              <div key={index} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="font-medium">{q.questionText}</p>
                <p className="text-sm mt-2">
                  <strong>Your answer:</strong> {q.selectedAnswer}
                </p>
                <p className="text-sm text-green-700">
                  <strong>Correct answer:</strong> {q.correctAnswer}
                </p>
                {q.explanation && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Explanation:</strong> {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All results */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">All Results</h2>
        <div className="space-y-3">
          {result.results.map((r, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                r.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="font-medium flex-1">{r.questionText}</p>
                <span className="text-xl ml-4">{r.isCorrect ? '✓' : '✗'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Link to={`/bookmarks/${bookmark.id}`} className="btn btn-secondary">
          Back to Bookmark
        </Link>
        <button onClick={onRetry} className="btn btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}
