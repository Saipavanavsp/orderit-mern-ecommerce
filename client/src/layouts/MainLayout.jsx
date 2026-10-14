// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/Header.jsx';
import { Footer } from '../components/Footer.jsx';
import { ChatWidget } from '../components/ChatWidget.jsx';
import { useAsync } from '../hooks/index.js';
import { catalogApi } from '../services/index.js';

export function MainLayout() {
  const { data } = useAsync(() => catalogApi.categories().then((r) => r.data.categories), []);
  const categories = data || [];
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header categories={categories} />
      <main id="main" className="flex-1">
        <Outlet context={{ categories }} />
      </main>
      <Footer categories={categories} />
      <ChatWidget />
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10">
      <Outlet />
    </div>
  );
}
