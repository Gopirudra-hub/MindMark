import { useState, useEffect } from 'react';
import * as api from '../api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const res = await api.getCategories();
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(name) {
    try {
      const res = await api.createCategory({ name });
      setCategories([...categories, res.data]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category');
    }
  }

  async function handleRename(id, newName) {
    try {
      await api.updateCategory(id, { name: newName });
      setCategories(categories.map(c => c.id === id ? { ...c, name: newName } : c));
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to rename category:', error);
      alert('Failed to rename category');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure? Bookmarks in this category will become uncategorized.')) return;
    try {
      await api.deleteCategory(id);
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category');
    }
  }

  async function handleMerge(sourceId, targetId) {
    try {
      await api.mergeCategories(sourceId, targetId);
      setCategories(categories.filter(c => c.id !== sourceId));
      setShowMergeModal(false);
      loadCategories(); // Reload to get updated counts
    } catch (error) {
      console.error('Failed to merge categories:', error);
      alert('Failed to merge categories');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMergeModal(true)}
            className="btn btn-secondary"
            disabled={categories.length < 2}
          >
            Merge
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            + Create Category
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">No categories yet. Create one to organize your bookmarks!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {categories.map(category => (
            <CategoryCard
              key={category.id}
              category={category}
              isEditing={editingCategory === category.id}
              onEdit={() => setEditingCategory(category.id)}
              onSave={(newName) => handleRename(category.id, newName)}
              onCancel={() => setEditingCategory(null)}
              onDelete={() => handleDelete(category.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CategoryModal
          title="Create Category"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <MergeModal
          categories={categories}
          onClose={() => setShowMergeModal(false)}
          onMerge={handleMerge}
        />
      )}
    </div>
  );
}

function CategoryCard({ category, isEditing, onEdit, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(category.name);

  return (
    <div className="card p-4 flex items-center justify-between">
      <div className="flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
            <button onClick={() => onSave(name)} className="btn btn-primary text-sm">
              Save
            </button>
            <button onClick={onCancel} className="btn btn-secondary text-sm">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span>{category._count?.bookmarks || 0} bookmarks</span>
              <span>{category.totalAttempts || 0} quiz attempts</span>
              {category.avgScore !== null && (
                <span className={`font-medium ${
                  category.avgScore >= 70 ? 'text-green-600' :
                  category.avgScore >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  Avg: {category.avgScore}%
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryModal({ title, initialName = '', onClose, onSubmit }) {
  const [name, setName] = useState(initialName);

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Category name"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MergeModal({ categories, onClose, onMerge }) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (sourceId && targetId && sourceId !== targetId) {
      onMerge(sourceId, targetId);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Merge Categories</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merge this category
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select source category</option>
              {categories.filter(c => c.id !== targetId).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Into this category
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select target category</option>
              {categories.filter(c => c.id !== sourceId).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <p className="text-sm text-gray-500">
            The source category will be deleted and all its bookmarks will be moved to the target category.
          </p>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!sourceId || !targetId || sourceId === targetId}
              className="btn btn-danger"
            >
              Merge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
