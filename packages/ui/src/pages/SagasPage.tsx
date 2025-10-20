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
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showOnlyRootSagas, setShowOnlyRootSagas] = useState(true);

  const toggleTask = (sagaId: string, taskName: string) => {
    const key = `${sagaId}-${taskName}`;
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isTaskExpanded = (sagaId: string, taskName: string) => {
    return expandedTasks.has(`${sagaId}-${taskName}`);
  };

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

  // Filter sagas based on toggle
  const displayedSagas = showOnlyRootSagas 
    ? sagas.filter(saga => !saga.parentSagaId)
    : sagas;

  const rootSagasCount = sagas.filter(saga => !saga.parentSagaId).length;
  const totalSagasCount = sagas.length;

  return (
    <div className="container">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to sources
      </button>
      
      <div className="header-row">
        <h2>Sagas in {name}</h2>
        
        <div className="view-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showOnlyRootSagas}
              onChange={(e) => setShowOnlyRootSagas(e.target.checked)}
            />
            <span>Show only root sagas</span>
          </label>
          <span className="saga-count">
            {showOnlyRootSagas 
              ? `${rootSagasCount} root saga${rootSagasCount !== 1 ? 's' : ''}`
              : `${totalSagasCount} total saga${totalSagasCount !== 1 ? 's' : ''} (${rootSagasCount} root)`
            }
          </span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {displayedSagas.length === 0 ? (
        <p>No sagas found</p>
      ) : (
        <div className="sagas-list">
          {displayedSagas.map((saga) => {
            const isRootSaga = !saga.parentSagaId;
            
            return (
              <div key={saga.sagaId} className={`saga-card ${isRootSaga ? 'root-saga' : ''}`} id={`saga-${saga.sagaId}`}>
                <div className="saga-header">
                  <div className="saga-info">
                    <div className="saga-id-label">
                      Saga ID
                      {isRootSaga && <span className="root-saga-badge">Root Saga</span>}
                    </div>
                    <div className="saga-id">{saga.sagaId}</div>
                    {saga.parentSagaId && (
                      <div className="parent-saga-link">
                        <span className="parent-saga-label">Parent:</span>
                        <a 
                          href={`#saga-${saga.parentSagaId}`}
                          className="parent-saga-id"
                          onClick={(e) => {
                            e.preventDefault();
                            const parentElement = document.getElementById(`saga-${saga.parentSagaId}`);
                            if (parentElement) {
                              parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              parentElement.classList.add('highlight-parent');
                              setTimeout(() => parentElement.classList.remove('highlight-parent'), 2000);
                            }
                          }}
                        >
                          {saga.parentSagaId}
                        </a>
                      </div>
                    )}
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
                      const hasChildren = task.childSagas && task.childSagas.length > 0;
                      const isExpanded = isTaskExpanded(saga.sagaId, task.taskName);
                      
                      return (
                        <div key={idx} className="task-container">
                          <div 
                            className={`task ${isExecuting ? 'task-executing' : ''} ${isCompensating ? 'task-compensating' : ''} ${hasChildren ? 'task-has-children' : ''}`}
                            onClick={() => hasChildren && toggleTask(saga.sagaId, task.taskName)}
                            style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                          >
                            <div className="task-info">
                              <div className="task-number">#{idx + 1}</div>
                              <div className="task-details">
                                <div className="task-name">
                                  {hasChildren && (
                                    <span className="task-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                  )}
                                  {task.taskName}
                                  {hasChildren && (
                                    <span className="task-children-badge">
                                      {task.childSagas!.length} child saga{task.childSagas!.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
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

                          {/* Child Sagas under this task */}
                          {hasChildren && isExpanded && (
                            <div className="task-child-sagas">
                              {task.childSagas!.map((child, childIdx) => (
                                <div key={child.sagaId} className={`task-child-saga task-child-saga-${child.status}`}>
                                  <div className="task-child-number">#{childIdx + 1}</div>
                                  <div className="task-child-info">
                                    <div className="task-child-id">{child.sagaId}</div>
                                    {child.tasks && child.tasks.length > 0 && (
                                      <div className="task-child-tasks">
                                        {child.tasks.map((childTask, taskIdx) => (
                                          <span 
                                            key={taskIdx} 
                                            className={`task-child-task-badge task-child-task-${childTask.status}`}
                                            title={`${childTask.taskName}: ${childTask.status}`}
                                          >
                                            {childTask.taskName}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`task-child-status ${child.status}`}>
                                    {child.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
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
          );
        })}
        </div>
      )}
    </div>
  );
};
