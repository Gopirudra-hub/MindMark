import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';

export default function DailyReview() {
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    loadDailyReview();
  }, []);

  async function loadDailyReview() {
    try {
      const res = await api.getDailyReview();
      setReviewData(res.data);
    } catch (error) {
      console.error('Failed to load daily review:', error);
    } finally {
      setLoading(false);
    }
  }

  function startQuiz() {
    setQuizStarted(true);
    setStartTime(Date.now());
    setCurrentQuestion(0);
    setAnswers({});
  }

  function handleAnswer(questionId, answer) {
    setAnswers({ ...answers, [questionId]: answer });
  }

  function nextQuestion() {
    if (currentQuestion < reviewData.questions.length - 1) {
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
      const res = await api.submitDailyReview({
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

  if (result) {
    return <QuizResult result={result} onRetry={() => window.location.reload()} />;
  }

  if (!reviewData || reviewData.questions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Daily Review</h1>
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h2>
          <p className="text-gray-500 mb-4">
            No bookmarks due for review today. Great job staying on top of your learning!
          </p>
          <Link to="/bookmarks" className="btn btn-primary">
            Browse Bookmarks
          </Link>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Daily Review</h1>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Today's Review Session</h2>
              <p className="text-gray-500">
                {reviewData.totalDue} bookmark(s) due • {reviewData.questions.length} questions
              </p>
            </div>
            <button onClick={startQuiz} className="btn btn-primary">
              Start Review
            </button>
          </div>

          <h3 className="font-medium mb-3">Bookmarks to review:</h3>
          <div className="space-y-2">
            {reviewData.bookmarks.map(bookmark => (
              <div key={bookmark.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{bookmark.title}</p>
                  {bookmark.category && (
                    <span className="text-sm text-gray-500">{bookmark.category}</span>
                  )}
                </div>
                <Link to={`/bookmarks/${bookmark.id}`} className="text-primary-600 hover:underline text-sm">
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const question = reviewData.questions[currentQuestion];
  const totalQuestions = reviewData.questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Daily Review</h1>
        <span className="text-sm text-gray-500">
          Question {currentQuestion + 1} of {totalQuestions}
        </span>
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
        {question.bookmarkTitle && (
          <p className="text-sm text-gray-500 mb-2">From: {question.bookmarkTitle}</p>
        )}
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
            placeholder="Enter your answer..."
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

          <span className="text-sm text-gray-500">
            {answeredCount} of {totalQuestions} answered
          </span>

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

function QuizResult({ result, onRetry }) {
  const scoreColor = result.score >= 80 ? 'text-green-600' :
                     result.score >= 50 ? 'text-yellow-600' :
                     'text-red-600';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Review Complete!</h1>

      <div className="card p-6 text-center">
        <div className={`text-6xl font-bold mb-2 ${scoreColor}`}>
          {Math.round(result.score)}%
        </div>
        <p className="text-gray-500 mb-4">
          {result.correct} of {result.total} correct • {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
        </p>
        <p className="text-sm text-gray-500">
          {result.bookmarksReviewed} bookmark(s) reviewed
        </p>
      </div>

      {/* Results breakdown */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Results</h2>
        <div className="space-y-3">
          {result.results.map((r, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                r.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{r.questionText}</p>
                  {r.bookmarkTitle && (
                    <p className="text-sm text-gray-500 mt-1">From: {r.bookmarkTitle}</p>
                  )}
                </div>
                <span className="text-xl ml-4">{r.isCorrect ? '✓' : '✗'}</span>
              </div>
              {!r.isCorrect && (
                <div className="mt-2 text-sm">
                  <p><strong>Your answer:</strong> {r.selectedAnswer}</p>
                  <p className="text-green-700"><strong>Correct answer:</strong> {r.correctAnswer}</p>
                </div>
              )}
              {r.explanation && (
                <p className="mt-2 text-sm text-gray-600">
                  <strong>Explanation:</strong> {r.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Link to="/" className="btn btn-secondary">
          Back to Dashboard
        </Link>
        <button onClick={onRetry} className="btn btn-primary">
          Review Again
        </button>
      </div>
    </div>
  );
}
