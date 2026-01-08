import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Onboarding } from './components/Onboarding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useConnectionStatus } from './hooks/useStats';
import { usePrefetchStats } from './hooks/usePrefetchStats';

// Lazy load all pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Quality = lazy(() => import('./pages/Quality'));
const Media = lazy(() => import('./pages/Media'));
const MediaDetail = lazy(() => import('./pages/MediaDetail'));
const Playback = lazy(() => import('./pages/Playback'));
const Indexers = lazy(() => import('./pages/Indexers'));
const Settings = lazy(() => import('./pages/Settings'));
const Movies = lazy(() => import('./pages/Movies'));
const TVShows = lazy(() => import('./pages/TVShows'));
const ReleaseGroups = lazy(() => import('./pages/ReleaseGroups'));
const Genres = lazy(() => import('./pages/Genres'));
const Records = lazy(() => import('./pages/Records'));
const Subtitles = lazy(() => import('./pages/Subtitles'));

// Loading spinner for Suspense fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const { data: status, isLoading } = useConnectionStatus();
  
  // Prefetch stats for all time ranges in background
  usePrefetchStats();

  // Show full-page loader only during initial connection check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show onboarding if no connections configured
  if (!status?.hasConnections) {
    return <Onboarding />;
  }

  // Render app - this only happens once after isLoading becomes false
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/tv" element={<TVShows />} />
          <Route path="/release-groups" element={<ReleaseGroups />} />
          <Route path="/genres" element={<Genres />} />
          <Route path="/records" element={<Records />} />
          <Route path="/subtitles" element={<Subtitles />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/media" element={<Media />} />
          <Route path="/media/:id" element={<MediaDetail />} />
          <Route path="/playback" element={<Playback />} />
          <Route path="/indexers" element={<Indexers />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
