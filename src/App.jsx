import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import Home from './pages/Home';
import TripResult from './pages/TripResult';
import DepartureBoard from './pages/DepartureBoard';
import Filter from './pages/Filter';

import SplitLayout from './components/SplitLayout';
import { useMediaQuery } from './hooks/useMediaQuery';

const BottomNav = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: isDesktop ? 'auto' : 0,
      width: isDesktop ? 450 : '100%',
      background: 'var(--surface-color)',
      borderTop: '1px solid #333',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '12px 0',
      zIndex: 1000
    }}>
      <div style={{
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 400
      }}>
        © Tanvir 2026
      </div>
    </nav>
  );
};


function App() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <FilterProvider>
      <Router>
        <Routes>
          <Route element={<SplitLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/trip/:originId/:destinationId" element={<TripResult />} />
            <Route path="/stop/:stopId/departures" element={<DepartureBoard />} />
            <Route path="/filter" element={<Filter />} />
          </Route>
        </Routes>
        <BottomNav />
      </Router>
    </FilterProvider>
  );
}

export default App;
