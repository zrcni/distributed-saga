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
      const data = await api.getSagas(name);
      setSagas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sagas');
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async (sagaId: string) => {
    if (!name || !confirm('Are you sure you want to abort this saga?')) return;

    try {
      await api.abortSaga(name, sagaId);
      loadSagas();
    } catch (err) {
      alert(`Failed to abort saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading && sagas.length === 0) {
    return (
      <div className="container">
        <div className="loading">Loading sagas...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to sources
      </button>
      <h2>Sagas in {name}</h2>

      {error && <div className="error">{error}</div>}

      {sagas.length === 0 ? (
        <p>No sagas found</p>
      ) : (
        <div className="sagas-list">
          {sagas.map((saga) => (
            <div key={saga.sagaId} className="saga-card">
              <div className="saga-header">
                <div className="saga-info">
                  <div className="saga-id-label">Saga ID</div>
                  <div className="saga-id">{saga.sagaId}</div>
                </div>
                <span className={`saga-status ${saga.status}`}>{saga.status}</span>
              </div>

              {saga.tasks && saga.tasks.length > 0 && (
                <div className="tasks">
                  <div className="tasks-header">
                    <strong>Tasks ({saga.tasks.length})</strong>
                  </div>
                  <div className="tasks-list">
                    {saga.tasks.map((task, idx) => {
                      const isExecuting = task.status === 'started';
                      const isCompensating = task.status === 'compensating';
                      
                      return (
                        <div 
                          key={idx} 
                          className={`task ${isExecuting ? 'task-executing' : ''} ${isCompensating ? 'task-compensating' : ''}`}
                        >
                          <div className="task-info">
                            <div className="task-number">#{idx + 1}</div>
                            <div className="task-details">
                              <div className="task-name">{task.taskName}</div>
                              {isExecuting && (
                                <div className="task-indicator">
                                  <span className="spinner"></span>
                                  <span className="task-executing-text">Executing...</span>
                                </div>
                              )}
                              {isCompensating && (
                                <div className="task-indicator">
                                  <span className="spinner compensating-spinner"></span>
                                  <span className="task-compensating-text">Compensating...</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className={`task-status task-status-${task.status}`}>
                            {task.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {saga.status === 'active' && (
                <div className="actions">
                  <button
                    className="btn btn-abort"
                    onClick={() => handleAbort(saga.sagaId)}
                  >
                    Abort Saga
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
