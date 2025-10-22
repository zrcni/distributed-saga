import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUIConfig } from '../hooks/useUIConfig';
import './Header.css';

export const Header: React.FC = () => {
  const { boardTitle = 'Saga Dashboard' } = useUIConfig();
  const location = useLocation();

  const isHangingPage = location.pathname.includes('/hanging');

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-text">
            <h1>{boardTitle}</h1>
            <p>Monitor and manage your distributed sagas</p>
          </div>
          <nav className="header-nav">
            <Link 
              to="/" 
              className={`nav-link ${!isHangingPage ? 'active' : ''}`}
            >
              All Sources
            </Link>
            <Link 
              to="/hanging" 
              className={`nav-link ${isHangingPage ? 'active' : ''}`}
            >
              Hanging Sagas
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
