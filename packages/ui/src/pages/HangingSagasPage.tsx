import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { SagaInfo, Source } from '../services/Api';
import './HangingSagasPage.css';

const HANGING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface HangingSagaWithSource extends SagaInfo {
  sourceName: string;
}

export const HangingSagasPage: React.FC = () => {
  const api = useApi();
  const navigate = useNavigate();
  const [hangingSagas, setHangingSagas] = useState<HangingSagaWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHangingSagas();
    const interval = setInterval(loadHangingSagas, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadHangingSagas = async () => {
    try {
      setLoading(true);
      
      // Get all sources
      const sources = await api.getSources();
      
      // Get all sagas from all sources
      const allSagasPromises = sources.map(async (source: Source) => {
        try {
          const sagas = await api.getSagas(source.name, false);
          return sagas.map(saga => ({ ...saga, sourceName: source.name }));
        } catch (err) {
          console.error(`Failed to load sagas from ${source.name}:`, err);
          return [];
        }
      });
      
      const allSagasArrays = await Promise.all(allSagasPromises);
      const allSagas = allSagasArrays.flat();
      
      // Filter for hanging sagas (active status and running > 24 hours)
      const now = Date.now();
      const hanging = allSagas.filter(saga => {
        if (saga.status !== 'active') return false;
        
        const createdAt = saga.createdAt ? new Date(saga.createdAt).getTime() : null;
        if (!createdAt) return false;
        
        const runningTime = now - createdAt;
        return runningTime > HANGING_THRESHOLD_MS;
      });
      
      // Sort by oldest first
      hanging.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
      
      setHangingSagas(hanging);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hanging sagas');
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async (sourceName: string, sagaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to abort this saga?')) return;

    try {
      await api.abortSaga(sourceName, sagaId);
      loadHangingSagas();
    } catch (err) {
      alert(`Failed to abort saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (sourceName: string, sagaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saga? This action cannot be undone.')) return;

    try {
      await api.deleteSaga(sourceName, sagaId);
      loadHangingSagas();
    } catch (err) {
      alert(`Failed to delete saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSagaClick = (sourceName: string, sagaId: string) => {
    navigate(`/sources/${sourceName}/sagas/${sagaId}`);
  };

  const formatRunningTime = (createdAt: string | undefined): string => {
    if (!createdAt) return 'Unknown';
    
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const diffMs = now - created;
    
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  if (loading && hangingSagas.length === 0) {
    return (
      <div className="container">
        <div className="loading">Loading hanging sagas...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header-row">
        <div className="header-title">
          <h2>Hanging Sagas</h2>
          <p className="subtitle">
            Sagas that have been running for more than 24 hours
          </p>
        </div>
        
        <div className="saga-count-badge">
          <span className="count-number">{hangingSagas.length}</span>
          <span className="count-label">hanging saga{hangingSagas.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {hangingSagas.length === 0 ? (
        <div className="no-hanging-sagas">
          <div className="success-icon">✓</div>
          <p>No hanging sagas found</p>
          <p className="subtitle">All sagas are completing within the expected timeframe</p>
        </div>
      ) : (
        <div className="sagas-list">
          {hangingSagas.map((saga) => (
            <div
              key={`${saga.sourceName}-${saga.sagaId}`}
              className="saga-card hanging"
              onClick={() => handleSagaClick(saga.sourceName, saga.sagaId)}
            >
              <div className="saga-header-card">
                <div className="saga-info">
                  <div className="saga-source">
                    <strong>Source:</strong> <span className="source-badge">{saga.sourceName}</span>
                  </div>
                  <div>
                    <strong>ID:</strong> <code>{saga.sagaId}</code>
                  </div>
                </div>
                <div className={`saga-status-badge status-${saga.status}`}>
                  {saga.status.toUpperCase()}
                </div>
              </div>

              <div className="hanging-info">
                <div className="hanging-badge">
                  ⚠️ Running for {formatRunningTime(saga.createdAt)}
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

              {saga.createdAt && (
                <div className="saga-timestamp">
                  <span className="timestamp-label">Created:</span>
                  <span className="timestamp-value">{new Date(saga.createdAt).toLocaleString()}</span>
                </div>
              )}

              <div className="saga-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => handleAbort(saga.sourceName, saga.sagaId, e)}
                  className="btn-small btn-warning"
                >
                  Abort
                </button>
                <button
                  onClick={(e) => handleDelete(saga.sourceName, saga.sagaId, e)}
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
