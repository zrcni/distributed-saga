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
                <div className="saga-id">{saga.sagaId}</div>
                <span className={`saga-status ${saga.status}`}>{saga.status}</span>
              </div>

              {saga.tasks && saga.tasks.length > 0 && (
                <div className="tasks">
                  <strong>Tasks:</strong>
                  {saga.tasks.map((task, idx) => (
                    <div key={idx} className="task">
                      <div className="task-name">{task.taskName}</div>
                      <span className={`task-status ${task.status}`}>{task.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* {saga.status === 'active' && (
                <div className="actions">
                  <button
                    className="btn btn-abort"
                    onClick={() => handleAbort(saga.sagaId)}
                  >
                    Abort
                  </button>
                </div>
              )} */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
