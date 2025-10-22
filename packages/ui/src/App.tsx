import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { SourcesPage } from './pages/SourcesPage';
import { SagasPage } from './pages/SagasPage';
import { SagaDetailPage } from './pages/SagaDetailPage';
import { HangingSagasPage } from './pages/HangingSagasPage';

export const App: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<SourcesPage />} />
          <Route path="/sagas" element={<SourcesPage />} />
          <Route path="/hanging" element={<HangingSagasPage />} />
          <Route path="/sources/:name" element={<SagasPage />} />
          <Route path="/sources/:name/sagas/:sagaId" element={<SagaDetailPage />} />
        </Routes>
      </main>
    </>
  );
};
