import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { Source } from '../services/Api';
import './SourcesPage.css';

export const SourcesPage: React.FC = () => {
  const api = useApi();
  const navigate = useNavigate();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      setLoading(true);
      const data = await api.getSources();
      setSources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading sources...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Saga Sources</h2>
      <div className="sources-grid">
        {sources.map((source) => (
          <div
            key={source.name}
            className="source-card"
            onClick={() => navigate(`/sources/${source.name}`)}
          >
            <div className="source-name">{source.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
