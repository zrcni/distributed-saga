import React from 'react';
import { useUIConfig } from '../hooks/useUIConfig';
import './Header.css';

export const Header: React.FC = () => {
  const { boardTitle = 'Saga Dashboard' } = useUIConfig();

  return (
    <header className="header">
      <div className="header-container">
        <h1>{boardTitle}</h1>
        <p>Monitor and manage your distributed sagas</p>
      </div>
    </header>
  );
};
