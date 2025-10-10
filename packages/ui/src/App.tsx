import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { SourcesPage } from './pages/SourcesPage';
import { SagasPage } from './pages/SagasPage';

export const App: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<SourcesPage />} />
          <Route path="/sagas" element={<SourcesPage />} />
          <Route path="/sources/:name" element={<SagasPage />} />
        </Routes>
      </main>
    </>
  );
};
