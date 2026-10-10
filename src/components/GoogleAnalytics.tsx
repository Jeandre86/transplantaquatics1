import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function isPrivateRoute(pathname: string) {
  return /^\/(admin|profile|dashboard|writer|login|submit|coach)(\/|$)/.test(pathname);
}

/** Optional GA4 tracking with explicit page views for this single-page app. */
export default function GoogleAnalytics() {
  const { pathname, search } = useLocation();
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  useEffect(() => {
    if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId) || isPrivateRoute(pathname)) return;

    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    if (document.documentElement.dataset.gaInitialized !== measurementId) {
      window.gtag('js', new Date());
      // Page views are sent below on React Router location changes.
      window.gtag('config', measurementId, { send_page_view: false });
      document.documentElement.dataset.gaInitialized = measurementId;
    }

    if (!document.getElementById('google-analytics-script')) {
      const script = document.createElement('script');
      script.id = 'google-analytics-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    }
  }, [measurementId, pathname]);

  useEffect(() => {
    if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId) || isPrivateRoute(pathname) || !window.gtag) return;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${pathname}${search}`,
    });
  }, [measurementId, pathname, search]);

  return null;
}
