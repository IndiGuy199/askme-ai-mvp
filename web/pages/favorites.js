import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import Layout from '../components/Layout';
import ReactMarkdown from 'react-markdown';

export default function Favorites() {
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingFavorite, setEditingFavorite] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', category: '', notes: '' });
  const router = useRouter();

  const categories = [
    { value: 'all', label: 'All Favorites' },
    { value: 'motivation', label: 'Motivation' },
    { value: 'health', label: 'Health & Fitness' },
    { value: 'mindset', label: 'Mindset' },
    { value: 'habits', label: 'Habits' },
    { value: 'relationships', label: 'Relationships' },
    { value: 'career', label: 'Career' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      await fetchFavorites(session.user.email);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        await fetchFavorites(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchFavorites = async (email) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/favorites?email=${encodeURIComponent(email)}&category=${selectedCategory}`);
      const data = await response.json();
      
      if (response.ok) {
        setFavorites(data.favorites || []);
      } else {
        console.error('Failed to fetch favorites:', data.error);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteFavorite = async (favoriteId) => {
    if (!confirm('Are you sure you want to delete this favorite?')) return;
    
    try {
      const response = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          favorite_id: favoriteId
        })
      });
      
      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
      } else {
        const data = await response.json();
        alert('Failed to delete favorite: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting favorite:', error);
      alert('Error deleting favorite');
    }
  };

  const startEditing = (favorite) => {
    setEditingFavorite(favorite.id);
    setEditForm({
      title: favorite.title || '',
      category: favorite.category || '',
      notes: favorite.notes || ''
    });
  };

  const saveEdit = async () => {
    try {
      const response = await fetch('/api/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          favorite_id: editingFavorite,
          ...editForm
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFavorites(prev => prev.map(fav => 
          fav.id === editingFavorite ? data.favorite : fav
        ));
        setEditingFavorite(null);
      } else {
        const data = await response.json();
        alert('Failed to update favorite: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
      alert('Error updating favorite');
    }
  };

  const filteredFavorites = favorites.filter(favorite => {
    const matchesSearch = searchTerm === '' || 
      favorite.message_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      favorite.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      favorite.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  useEffect(() => {
    if (user) {
      fetchFavorites(user.email);
    }
  }, [selectedCategory]);

  if (loading) {
    return (
      <Layout title="My Favorites">
        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Favorites">
      <div className="container-fluid py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10 col-xl-8">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h1 className="h3 mb-1">My Saved Advice</h1>
                <p className="text-muted mb-0">
                  {favorites.length} saved snippet{favorites.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button 
                className="btn btn-outline-primary"
                onClick={() => router.push('/chat')}
              >
                <i className="bi bi-chat-dots me-2"></i>
                Back to Chat
              </button>
            </div>

            {/* Filters */}
            <div className="row mb-4">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Filter by Category</label>
                <select 
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Search</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search your saved advice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Favorites List */}
            {filteredFavorites.length === 0 ? (
              <div className="text-center py-5">
                <i className="bi bi-star display-1 text-muted mb-3"></i>
                <h4 className="text-muted">No saved advice yet</h4>
                <p className="text-muted mb-4">
                  Start a conversation in the chat and save helpful advice snippets for quick access.
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={() => router.push('/chat')}
                >
                  <i className="bi bi-chat-dots me-2"></i>
                  Start Chatting
                </button>
              </div>
            ) : (
              <div className="row g-4">
                {filteredFavorites.map((favorite) => (
                  <div key={favorite.id} className="col-12">
                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        {editingFavorite === favorite.id ? (
                          // Edit Mode
                          <div>
                            <div className="mb-3">
                              <label className="form-label small">Title (optional)</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editForm.title}
                                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Give this advice a title..."
                              />
                            </div>
                            <div className="mb-3">
                              <label className="form-label small">Category</label>
                              <select
                                className="form-select"
                                value={editForm.category}
                                onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                              >
                                <option value="">No category</option>
                                {categories.slice(1).map(cat => (
                                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="mb-3">
                              <label className="form-label small">Notes (optional)</label>
                              <textarea
                                className="form-control"
                                rows="3"
                                value={editForm.notes}
                                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Add your own notes about this advice..."
                              />
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-primary btn-sm" onClick={saveEdit}>
                                <i className="bi bi-check me-1"></i>Save
                              </button>
                              <button 
                                className="btn btn-outline-secondary btn-sm" 
                                onClick={() => setEditingFavorite(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div>
                            <div className="d-flex justify-content-between align-items-start mb-3">
                              <div className="flex-grow-1">
                                {favorite.title && (
                                  <h5 className="card-title mb-2">{favorite.title}</h5>
                                )}
                                {favorite.category && (
                                  <span className="badge bg-secondary me-2 mb-2">{favorite.category}</span>
                                )}
                                <small className="text-muted d-block">
                                  Saved {new Date(favorite.created_at).toLocaleDateString()}
                                </small>
                              </div>
                              <div className="dropdown">
                                <button 
                                  className="btn btn-sm btn-outline-secondary dropdown-toggle"
                                  data-bs-toggle="dropdown"
                                >
                                  <i className="bi bi-three-dots"></i>
                                </button>
                                <ul className="dropdown-menu">
                                  <li>
                                    <button 
                                      className="dropdown-item"
                                      onClick={() => startEditing(favorite)}
                                    >
                                      <i className="bi bi-pencil me-2"></i>Edit
                                    </button>
                                  </li>
                                  <li>
                                    <button 
                                      className="dropdown-item text-danger"
                                      onClick={() => deleteFavorite(favorite.id)}
                                    >
                                      <i className="bi bi-trash me-2"></i>Delete
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <div className="p-3 bg-light rounded">
                                <ReactMarkdown>{favorite.message_content}</ReactMarkdown>
                              </div>
                            </div>
                            
                            {favorite.notes && (
                              <div className="alert alert-info">
                                <strong>Your notes:</strong> {favorite.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
