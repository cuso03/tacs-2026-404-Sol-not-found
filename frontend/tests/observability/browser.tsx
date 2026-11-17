// Entry loaded only by the experiment's separate Vite server, never by the app.
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Discover from '../../src/pages/Discover';
import { queryClient } from '../../src/lib/queryClient';
import '../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <main className="mx-auto max-w-6xl p-6"><Discover /></main>
    </MemoryRouter>
  </QueryClientProvider>,
);
