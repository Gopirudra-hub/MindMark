import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedCategory, filter]);

  async function loadData() {
    try {
      setLoading(true);
      const params = {};
      
      if (selectedCategory) params.categoryId = selectedCategory;
      if (filter === 'due') params.dueToday = 'true';
      if (filter === 'weak') params.weakTopics = 'true';
      if (filter === 'high') params.highScore = 'true';
      if (filter === 'low') params.lowScore = 'true';
      if (filter === 'stale') params.notReviewed = 'true';
      
      const [bookmarksRes, categoriesRes, tagsRes] = await Promise.all([
        api.getBookmarks(params),
        api.getCategories(),
        api.getTags()
      ]);
      
      setBookmarks(bookmarksRes.data.bookmarks);
      setCategories(categoriesRes.data);
      setTags(tagsRes.data);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredBookmarks = bookmarks.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.url.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;
    try {
      await api.deleteBookmark(id);
      setBookmarks(bookmarks.filter(b => b.id !== id));
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bookmarks</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Add Bookmark
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All</option>
            <option value="due">Due Today</option>
            <option value="weak">Weak Topics</option>
            <option value="high">High Score</option>
            <option value="low">Low Score</option>
            <option value="stale">Not Reviewed</option>
          </select>
        </div>
      </div>

      {/* Bookmarks List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">No bookmarks found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBookmarks.map(bookmark => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateBookmarkModal
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newBookmark) => {
            setBookmarks([newBookmark, ...bookmarks]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function BookmarkCard({ bookmark, onDelete }) {
  const latestAttempt = bookmark.quizAttempts?.[0];
  const score = latestAttempt?.score;

  return (
    <div className="card p-4 flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <Link
          to={`/bookmarks/${bookmark.id}`}
          className="text-lg font-medium text-gray-900 hover:text-primary-600 truncate block"
        >
          {bookmark.title}
        </Link>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:text-primary-600 max-w-xs"
          >
            {new URL(bookmark.url).hostname}
          </a>
          {bookmark.category && (
            <span className="px-2 py-0.5 bg-gray-100 rounded-full">
              {bookmark.category.name}
            </span>
          )}
          {bookmark._count?.questions > 0 && (
            <span>{bookmark._count.questions} questions</span>
          )}
        </div>
        <div className="flex gap-1 mt-2">
          {bookmark.tags?.map(bt => (
            <span
              key={bt.tag.id}
              className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full"
            >
              {bt.tag.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        {score !== undefined && (
          <div className={`text-lg font-bold ${
            score >= 80 ? 'text-green-600' : 
            score >= 50 ? 'text-yellow-600' : 
            'text-red-600'
          }`}>
            {Math.round(score)}%
          </div>
        )}

        <Link
          to={`/quiz/${bookmark.id}`}
          className="btn btn-secondary text-sm"
        >
          Quiz
        </Link>

        <button
          onClick={() => onDelete(bookmark.id)}
          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CreateBookmarkModal({ categories, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.createBookmark({
        title,
        url,
        content: content || undefined,
        categoryId: categoryId || undefined
      });
      onCreated(res.data);
    } catch (error) {
      console.error('Failed to create bookmark:', error);
      alert('Failed to create bookmark');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add Bookmark</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content (optional)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Paste the page content for AI summary generation..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
