import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [trend, setTrend] = useState([]);
  const [categoryAnalytics, setCategoryAnalytics] = useState([]);
  const [weakestBookmarks, setWeakestBookmarks] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    loadAnalyticsData();
  }, [trendDays]);

  async function loadAnalyticsData() {
    try {
      const [analyticsRes, trendRes, categoriesRes, weakestRes, reviewsRes] = await Promise.all([
        api.getGlobalAnalytics(),
        api.getPerformanceTrend(trendDays),
        api.getAllCategoriesAnalytics(),
        api.getWeakestBookmarks(10),
        api.getReviewStats()
      ]);
      
      setAnalytics(analyticsRes.data);
      setTrend(trendRes.data);
      setCategoryAnalytics(categoriesRes.data);
      setWeakestBookmarks(weakestRes.data);
      setReviewStats(reviewsRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  const trendChartData = {
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
        spanGaps: true,
        yAxisID: 'y'
      },
      {
        label: 'Attempts',
        data: trend.map(d => d.attempts),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        tension: 0.3,
        type: 'bar',
        yAxisID: 'y1'
      }
    ]
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Score %' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Attempts' }
      }
    }
  };

  const categoryChartData = {
    labels: categoryAnalytics.map(c => c.name),
    datasets: [{
      label: 'Average Score',
      data: categoryAnalytics.map(c => c.avgScore),
      backgroundColor: categoryAnalytics.map(c => 
        c.avgScore >= 70 ? 'rgba(34, 197, 94, 0.7)' :
        c.avgScore >= 50 ? 'rgba(234, 179, 8, 0.7)' :
        'rgba(239, 68, 68, 0.7)'
      ),
      borderWidth: 1
    }]
  };

  const reviewChartData = {
    labels: ['Due Today', 'Overdue', 'Never Reviewed', 'Reviewed This Week'],
    datasets: [{
      data: [
        reviewStats?.dueToday || 0,
        reviewStats?.overdue || 0,
        reviewStats?.neverReviewed || 0,
        reviewStats?.reviewedThisWeek || 0
      ],
      backgroundColor: [
        'rgba(59, 130, 246, 0.7)',
        'rgba(239, 68, 68, 0.7)',
        'rgba(156, 163, 175, 0.7)',
        'rgba(34, 197, 94, 0.7)'
      ]
    }]
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bookmarks"
          value={analytics?.totalBookmarks || 0}
          icon="📚"
        />
        <StatCard
          title="Total Attempts"
          value={analytics?.totalAttempts || 0}
          icon="📝"
        />
        <StatCard
          title="Global Average"
          value={`${analytics?.globalAvgScore || 0}%`}
          icon="📊"
          color={analytics?.globalAvgScore >= 70 ? 'green' : analytics?.globalAvgScore >= 50 ? 'yellow' : 'red'}
        />
        <StatCard
          title="Compliance Rate"
          value={`${analytics?.reviewComplianceRate || 0}%`}
          icon="✅"
          color={analytics?.reviewComplianceRate >= 80 ? 'green' : 'yellow'}
        />
      </div>

      {/* Performance Trend */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Performance Trend</h2>
          <select
            value={trendDays}
            onChange={(e) => setTrendDays(parseInt(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="h-80">
          <Line data={trendChartData} options={trendChartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Category Performance</h2>
          {categoryAnalytics.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No category data yet</p>
          ) : (
            <div className="h-64">
              <Bar
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true, max: 100 }
                  },
                  plugins: {
                    legend: { display: false }
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Review Status */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Review Status</h2>
          {reviewStats ? (
            <div className="h-64 flex items-center justify-center">
              <Doughnut
                data={reviewChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' }
                  }
                }}
              />
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No review data</p>
          )}
        </div>
      </div>

      {/* Weakest Bookmarks */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Weakest Bookmarks (Need Review)</h2>
        {weakestBookmarks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No quiz data yet. Start taking quizzes!</p>
        ) : (
          <div className="space-y-2">
            {weakestBookmarks.map((bookmark, index) => (
              <Link
                key={bookmark.id}
                to={`/bookmarks/${bookmark.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 w-6">{index + 1}</span>
                  <div>
                    <p className="font-medium">{bookmark.title}</p>
                    {bookmark.category && (
                      <span className="text-sm text-gray-500">{bookmark.category}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${
                    bookmark.avgScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {bookmark.avgScore}%
                  </span>
                  <p className="text-xs text-gray-500">{bookmark.attemptCount} attempts</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Category Details */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Category Details</h2>
        {categoryAnalytics.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No categories yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-center py-3 px-4">Bookmarks</th>
                  <th className="text-center py-3 px-4">Attempts</th>
                  <th className="text-center py-3 px-4">Avg Score</th>
                  <th className="text-center py-3 px-4">Weak Items</th>
                </tr>
              </thead>
              <tbody>
                {categoryAnalytics.map(cat => (
                  <tr key={cat.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{cat.name}</td>
                    <td className="text-center py-3 px-4">{cat.totalBookmarks}</td>
                    <td className="text-center py-3 px-4">{cat.totalAttempts}</td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-bold ${
                        cat.avgScore >= 70 ? 'text-green-600' :
                        cat.avgScore >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {cat.avgScore || 0}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      {cat.weakBookmarks?.length || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
