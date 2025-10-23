import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { SagaInfo } from '../services/Api';
import './SagaDetailPage.css';

export const SagaDetailPage: React.FC = () => {
  const { name, sagaId } = useParams<{ name: string; sagaId: string }>();
  const api = useApi();
  const navigate = useNavigate();
  const [saga, setSaga] = useState<SagaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (taskName: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskName)) {
        next.delete(taskName);
      } else {
        next.add(taskName);
      }
      return next;
    });
  };

  const isTaskExpanded = (taskName: string) => {
    return expandedTasks.has(taskName);
  };

  useEffect(() => {
    if (name && sagaId) {
      loadSaga();
      const interval = setInterval(loadSaga, 5000);
      return () => clearInterval(interval);
    }
  }, [name, sagaId]);

  const loadSaga = async () => {
    if (!name || !sagaId) return;
    try {
      setLoading(true);
      const data = await api.getSaga(name, sagaId, 'shallow');
      setSaga(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saga');
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    if (!name || !sagaId || !confirm('Are you sure you want to abort this saga?')) return;

    try {
      await api.abortSaga(name, sagaId);
      loadSaga();
    } catch (err) {
      alert(`Failed to abort saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async () => {
    if (!name || !sagaId || !confirm('Are you sure you want to delete this saga? This action cannot be undone.')) return;

    try {
      await api.deleteSaga(name, sagaId);
      // Navigate back to list after deletion
      navigate(`/sources/${name}`);
    } catch (err) {
      alert(`Failed to delete saga: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const navigateToSaga = (childSagaId: string) => {
    navigate(`/sources/${name}/sagas/${childSagaId}`);
  };

  const navigateBack = () => {
    if (saga?.parentSagaId) {
      // Navigate to parent saga
      navigate(`/sources/${name}/sagas/${saga.parentSagaId}`);
    } else {
      // Navigate to list
      navigate(`/sources/${name}`);
    }
  };

  if (loading && !saga) {
    return (
      <div className="saga-detail-page">
        <div className="loading">Loading saga details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saga-detail-page">
        <div className="error">{error}</div>
        <button onClick={navigateBack} className="back-button">← Back</button>
      </div>
    );
  }

  if (!saga) {
    return (
      <div className="saga-detail-page">
        <div className="error">Saga not found</div>
        <button onClick={navigateBack} className="back-button">← Back</button>
      </div>
    );
  }

  return (
    <div className="saga-detail-page">
      <div className="breadcrumbs">
        <button onClick={navigateBack} className="breadcrumb-button">
          ← {saga.parentSagaId ? 'Parent Saga' : 'All Sagas'}
        </button>
        {saga.parentSagaId && (
          <span className="breadcrumb-separator">/</span>
        )}
        <span className="current-saga">Saga: {saga.sagaId}</span>
      </div>

      <div className="saga-header">
        <div className="saga-title-section">
          <h2>Saga Details</h2>
          <div className={`saga-status status-${saga.status}`}>
            {saga.status === 'aborted' ? 'FAILED' : saga.status.toUpperCase()}
          </div>
        </div>
        <div className="saga-actions">
          {saga.status === 'active' && (
            <button onClick={handleAbort} className="btn btn-warning">
              Abort Saga
            </button>
          )}
          <button onClick={handleDelete} className="btn btn-danger">
            Delete Saga
          </button>
        </div>
      </div>

      <div className="saga-info-section">
        <div className="info-row">
          <strong>Saga ID:</strong>
          <code>{saga.sagaId}</code>
        </div>
        {saga.createdAt && (
          <div className="info-row">
            <strong>Created At:</strong>
            <span className="timestamp">{new Date(saga.createdAt).toLocaleString()}</span>
          </div>
        )}
        {saga.updatedAt && (
          <div className="info-row">
            <strong>Updated At:</strong>
            <span className="timestamp">{new Date(saga.updatedAt).toLocaleString()}</span>
          </div>
        )}
        {saga.parentSagaId && (
          <div className="info-row">
            <strong>Parent Saga:</strong>
            <button
              onClick={() => navigateToSaga(saga.parentSagaId!)}
              className="link-button"
            >
              {saga.parentSagaId}
            </button>
          </div>
        )}
        {saga.parentTaskId && (
          <div className="info-row">
            <strong>Parent Task:</strong>
            <code>{saga.parentTaskId}</code>
          </div>
        )}
      </div>

      {saga.job && (
        <div className="saga-data-section">
          <h3>Saga Data</h3>
          <div className="saga-data-content">
            <pre>{JSON.stringify(saga.job, null, 2)}</pre>
          </div>
        </div>
      )}

      {saga.tasks && saga.tasks.length > 0 && (
        <div className="tasks-section">
          <h3>Tasks ({saga.tasks.length})</h3>
          <div className="tasks-list">
            {saga.tasks.map((task) => (
              <div key={task.taskName} className="task-item">
                <div
                  className="task-header"
                  onClick={() => toggleTask(task.taskName)}
                >
                  <span className="task-toggle">
                    {isTaskExpanded(task.taskName) ? '▼' : '►'}
                  </span>
                  <span className="task-name">
                    {task.taskName}
                    {task.isOptional && <span className="optional-indicator" title="This task is optional">⭕</span>}
                    {task.error && <span className="error-indicator" title="This task has an error">⚠️</span>}
                  </span>
                  <span className={`task-status status-${task.status}`}>
                    {task.status}
                  </span>
                </div>
                {isTaskExpanded(task.taskName) && (
                  <div className="task-details">
                    {(task.startedAt || task.completedAt) && (
                      <div className="task-timestamps">
                        {task.startedAt && (
                          <div className="timestamp-item">
                            <strong>Started:</strong>
                            <span className="timestamp">{new Date(task.startedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {task.completedAt && (
                          <div className="timestamp-item">
                            <strong>Completed:</strong>
                            <span className="timestamp">{new Date(task.completedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {task.startedAt && task.completedAt && (
                          <div className="timestamp-item">
                            <strong>Duration:</strong>
                            <span className="duration">
                              {Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000)}s
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {task.error && (
                      <div className="task-error">
                        <strong>Error:</strong>
                        <pre className="error-content">{JSON.stringify(task.error, null, 2)}</pre>
                      </div>
                    )}
                    {task.data && (
                      <div className="task-data">
                        <strong>Data:</strong>
                        <pre>{JSON.stringify(task.data, null, 2)}</pre>
                      </div>
                    )}
                    {task.childSagas && task.childSagas.length > 0 && (
                      <div className="task-child-sagas">
                        <strong>Child Sagas ({task.childSagas.length}):</strong>
                        <ul>
                          {task.childSagas.map((childSaga) => (
                            <li key={childSaga.sagaId}>
                              <button
                                onClick={() => navigateToSaga(childSaga.sagaId)}
                                className="child-saga-link"
                              >
                                {childSaga.sagaId}
                              </button>
                              <span className={`saga-status-badge status-${childSaga.status}`}>
                                {childSaga.status === 'aborted' ? 'FAILED' : childSaga.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {saga.childSagas && saga.childSagas.length > 0 && (
        <div className="child-sagas-section">
          <h3>Child Sagas ({saga.childSagas.length})</h3>
          <div className="child-sagas-grid">
            {saga.childSagas.map((childSaga) => (
              <div
                key={childSaga.sagaId}
                className="child-saga-card"
                onClick={() => navigateToSaga(childSaga.sagaId)}
              >
                <div className="child-saga-id">{childSaga.sagaId}</div>
                <div className={`child-saga-status status-${childSaga.status}`}>
                  {childSaga.status === 'aborted' ? 'FAILED' : childSaga.status.toUpperCase()}
                </div>
                {childSaga.parentTaskId && (
                  <div className="child-saga-parent-task">
                    from task: {childSaga.parentTaskId}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
