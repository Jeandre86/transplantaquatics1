const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'IMG', 'IFRAME']);

function safeUrl(value: string, allowMailto = false) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' || url.protocol === 'http:' || (allowMailto && url.protocol === 'mailto:') ? url.href : '';
  } catch { return ''; }
}

export function sanitizeArticleHtml(html: string) {
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return null;
    if (!allowedTags.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => { const cleaned = cleanNode(child); if (cleaned) fragment.appendChild(cleaned); });
      return fragment;
    }
    const clean = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'A') {
      const href = safeUrl(node.getAttribute('href') ?? '', true);
      if (href) { clean.setAttribute('href', href); clean.setAttribute('rel', 'noopener noreferrer'); }
    }
    if (node.tagName === 'IMG') {
      const src = safeUrl(node.getAttribute('src') ?? '');
      if (!src) return null;
      clean.setAttribute('src', src);
      clean.setAttribute('alt', node.getAttribute('alt') ?? '');
      clean.className = 'my-8 h-auto max-h-[560px] w-full object-cover';
    }
    if (node.tagName === 'IFRAME') {
      let parsed: URL;
      try { parsed = new URL(node.getAttribute('src') ?? ''); } catch { return null; }
      const youtube = parsed.hostname === 'www.youtube-nocookie.com' && /^\/embed\/[A-Za-z0-9_-]+$/.test(parsed.pathname);
      const vimeo = parsed.hostname === 'player.vimeo.com' && /^\/video\/[0-9]+$/.test(parsed.pathname);
      if (!youtube && !vimeo) return null;
      clean.setAttribute('src', parsed.href);
      clean.setAttribute('title', node.getAttribute('title') || 'Embedded video');
      clean.setAttribute('loading', 'lazy');
      clean.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      clean.setAttribute('allowfullscreen', '');
      clean.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      clean.className = 'my-8 aspect-video w-full border-0';
      return clean;
    }
    Array.from(node.childNodes).forEach(child => { const cleaned = cleanNode(child); if (cleaned) clean.appendChild(cleaned); });
    return clean;
  };
  const container = document.createElement('div');
  Array.from(documentNode.body.childNodes).forEach(child => { const cleaned = cleanNode(child); if (cleaned) container.appendChild(cleaned); });
  return container.innerHTML;
}

export function articleHtmlToText(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.body.querySelectorAll('p,h2,h3,blockquote,li,br').forEach(node => node.appendChild(document.createTextNode('\n')));
  return parsed.body.textContent?.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim() ?? '';
}
