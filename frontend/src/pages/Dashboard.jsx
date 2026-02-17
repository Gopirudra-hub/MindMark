import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import * as api from '../api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [trend, setTrend] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [analyticsRes, trendRes, insightsRes] = await Promise.all([
        api.getGlobalAnalytics(),
        api.getPerformanceTrend(30),
        api.getInsights()
      ]);
      setAnalytics(analyticsRes.data);
      setTrend(trendRes.data);
      setInsights(insightsRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const chartData = {
    labels: trend.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Average Score',
        data: trend.map(d => d.avgScore),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
        spanGaps: true
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bookmarks"
          value={analytics?.totalBookmarks || 0}
          icon="📚"
        />
        <StatCard
          title="Average Score"
          value={`${analytics?.globalAvgScore || 0}%`}
          icon="📊"
          color={analytics?.globalAvgScore >= 70 ? 'green' : analytics?.globalAvgScore >= 50 ? 'yellow' : 'red'}
        />
        <StatCard
          title="Due Reviews"
          value={analytics?.dueReviewsCount || 0}
          icon="📅"
          color={analytics?.dueReviewsCount > 5 ? 'red' : 'green'}
        />
        <StatCard
          title="Weekly Trend"
          value={`${analytics?.improvementTrend > 0 ? '+' : ''}${analytics?.improvementTrend || 0}%`}
          icon={analytics?.improvementTrend >= 0 ? '📈' : '📉'}
          color={analytics?.improvementTrend >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Weakest Category Alert */}
      {analytics?.weakestCategory && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="font-medium text-yellow-800">Focus Area</h3>
              <p className="text-sm text-yellow-700">
                Your weakest category is <strong>{analytics.weakestCategory.name}</strong> with an average score of {Math.round(analytics.weakestCategory.avgScore)}%
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-semibold mb-4">Performance Trend (30 Days)</h2>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Insights */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Insights</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {insights.length === 0 ? (
              <p className="text-gray-500 text-sm">No insights yet. Start taking quizzes!</p>
            ) : (
              insights.slice(0, 5).map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/daily-review" className="card p-6 hover:bg-primary-50 transition-colors">
          <div className="flex items-center">
            <span className="text-3xl mr-4">🎯</span>
            <div>
              <h3 className="font-semibold">Daily Review</h3>
              <p className="text-sm text-gray-500">Take today's review quiz</p>
            </div>
          </div>
        </Link>
        <Link to="/bookmarks" className="card p-6 hover:bg-primary-50 transition-colors">
          <div className="flex items-center">
            <span className="text-3xl mr-4">📖</span>
            <div>
              <h3 className="font-semibold">Browse Bookmarks</h3>
              <p className="text-sm text-gray-500">View all saved content</p>
            </div>
          </div>
        </Link>
        <Link to="/analytics" className="card p-6 hover:bg-primary-50 transition-colors">
          <div className="flex items-center">
            <span className="text-3xl mr-4">📊</span>
            <div>
              <h3 className="font-semibold">View Analytics</h3>
              <p className="text-sm text-gray-500">Detailed performance data</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'text-primary-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600'
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function InsightCard({ insight }) {
  const priorityColors = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    positive: 'bg-green-50 border-green-200 text-green-800'
  };

  const priorityIcons = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
    positive: '✅'
  };

  return (
    <div className={`p-3 rounded-lg border ${priorityColors[insight.priority]}`}>
      <div className="flex items-start">
        <span className="mr-2">{priorityIcons[insight.priority]}</span>
        <p className="text-sm">{insight.message}</p>
      </div>
    </div>
  );
}
