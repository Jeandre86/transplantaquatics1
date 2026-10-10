import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Loads Google Auto ads on News pages when a publisher ID is configured. */
export default function AdSenseLoader() {
  const { pathname } = useLocation();

  useEffect(() => {
    const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID?.trim();
    if (!publisherId) return;

    // Google ads are currently enabled only for the News feed and its articles.
    if (!/^\/from-the-pool-deck(?:\/|$)/.test(pathname)) return;

    const normalizedId = publisherId.startsWith('ca-pub-')
      ? publisherId
      : publisherId.startsWith('pub-')
        ? `ca-${publisherId}`
        : `ca-pub-${publisherId}`;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="google-adsense-account"]');
    if (meta) meta.content = normalizedId;
    else {
      const accountMeta = document.createElement('meta');
      accountMeta.name = 'google-adsense-account';
      accountMeta.content = normalizedId;
      document.head.appendChild(accountMeta);
    }

    if (document.getElementById('google-adsense-script')) return;
    const script = document.createElement('script');
    script.id = 'google-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${normalizedId}`;
    document.head.appendChild(script);
  }, [pathname]);

  return null;
}
