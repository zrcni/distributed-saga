import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { SagaInfo } from '../services/Api';
import './SagasPage.css';

export const SagasPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const api = useApi();
  const navigate = useNavigate();
  const [sagas, setSagas] = useState<SagaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideCompletedSagas, setHideCompletedSagas] = useState(true);

  useEffect(() => {
    if (name) {
      loadSagas();
      const interval = setInterval(loadSagas, 5000);
      return () => clearInterval(interval);
    }
  }, [name]);

  const loadSagas = async () => {
    if (!name) return;
    try {
      setLoading(true);
      const data = await api.getSagas(name, true);
      setSagas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sagas');
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async (sagaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!name || !confirm('Are you sure you want to abort this saga?')) return;

    try {
      await api.abortSaga(name, sagaId);
      loadSagas();
    } catch (err) {
      alert(`Failed to abort saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (sagaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!name || !confirm('Are you sure you want to delete this saga? This action cannot be undone.')) return;

    try {
      await api.deleteSaga(name, sagaId);
      loadSagas();
    } catch (err) {
      alert(`Failed to delete saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSagaClick = (sagaId: string) => {
    navigate(`/sources/${name}/sagas/${sagaId}`);
  };

  if (loading && sagas.length === 0) {
    return (
      <div className="container">
        <div className="loading">Loading sagas...</div>
      </div>
    );
  }

  let displayedSagas = hideCompletedSagas 
    ? sagas.filter(saga => saga.status !== 'completed')
    : sagas;

  const totalSagasCount = sagas.length;
  const completedSagasCount = sagas.filter(saga => saga.status === 'completed').length;

  return (
    <div className="container">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to sources
      </button>
      
      <div className="header-row">
        <div className="header-title">
          <h2>Root Sagas in {name}</h2>
          <p className="subtitle">Click on a saga to view its details and child sagas</p>
        </div>
        
        <div className="view-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={hideCompletedSagas}
              onChange={(e) => setHideCompletedSagas(e.target.checked)}
            />
            <span>Hide completed sagas</span>
          </label>
          <span className="saga-count">
            {totalSagasCount} root saga{totalSagasCount !== 1 ? 's' : ''}
            {completedSagasCount > 0 && (
              <span className="completed-count"> • {completedSagasCount} completed</span>
            )}
          </span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {displayedSagas.length === 0 ? (
        <p>No sagas found</p>
      ) : (
        <div className="sagas-list">
          {displayedSagas.map((saga) => (
            <div
              key={saga.sagaId}
              className="saga-card"
              onClick={() => handleSagaClick(saga.sagaId)}
            >
              <div className="saga-header-card">
                <div className="saga-info">
                  <strong>ID:</strong> <code>{saga.sagaId}</code>
                </div>
                <div className={`saga-status-badge status-${saga.status}`}>
                  {saga.status.toUpperCase()}
                </div>
              </div>

              <div className="saga-stats">
                {saga.tasks && (
                  <span className="stat-badge">
                    {saga.tasks.length} task{saga.tasks.length !== 1 ? 's' : ''}
                  </span>
                )}
                {saga.childSagas && saga.childSagas.length > 0 && (
                  <span className="stat-badge">
                    {saga.childSagas.length} child saga{saga.childSagas.length !== 1 ? 's' : ''}
                  </span>
                )}
                {saga.tasks && saga.tasks.some(task => task.error) && (
                  <span className="stat-badge error-badge" title="This saga has tasks with errors">
                    ⚠️ Has Errors
                  </span>
                )}
              </div>

              <div className="saga-actions" onClick={(e) => e.stopPropagation()}>
                {saga.status === 'active' && (
                  <button
                    onClick={(e) => handleAbort(saga.sagaId, e)}
                    className="btn-small btn-warning"
                  >
                    Abort
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(saga.sagaId, e)}
                  className="btn-small btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
