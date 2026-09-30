import { useEffect, useRef } from 'react';
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Underline, Video } from 'lucide-react';
import { sanitizeArticleHtml } from '../lib/articleContent';

type Props = { value: string; onChange: (value: string) => void; minHeight?: number; dark?: boolean };

export default function RichArticleEditor({ value, onChange, minHeight = 360, dark = false }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldClass = dark ? 'border-[var(--navy-light)] bg-[var(--navy)] text-white' : 'border-neutral-200 bg-white text-neutral-900';
  const mutedClass = dark ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950';

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== sanitizeArticleHtml(value)) editor.innerHTML = sanitizeArticleHtml(value);
  }, [value]);

  const run = (command: string, parameter?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, parameter);
    if (editorRef.current) onChange(sanitizeArticleHtml(editorRef.current.innerHTML));
  };
  const insertImage = () => {
    const source = window.prompt('Paste an image URL (https://…)');
    if (!source) return;
    const alt = window.prompt('Add a short image description for accessibility', '') ?? '';
    run('insertHTML', `<p><img src="${source.replaceAll('"', '&quot;')}" alt="${alt.replaceAll('"', '&quot;')}"></p><p><em>${alt.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</em></p>`);
  };
  const insertLink = () => {
    const url = window.prompt('Paste a link (https://…)');
    if (url) run('createLink', url);
  };
  const insertVideo = () => {
    const rawUrl = window.prompt('Paste a YouTube or Vimeo video URL');
    if (!rawUrl) return;
    try {
      const url = new URL(rawUrl);
      let embedUrl = '';
      if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
        const videoId = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? '';
        if (/^[A-Za-z0-9_-]+$/.test(videoId)) embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
      } else if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
        const videoId = url.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
        if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
      }
      if (!embedUrl) { window.alert('Use a valid YouTube or Vimeo video URL.'); return; }
      run('insertHTML', `<p><iframe src="${embedUrl}" title="Embedded video"></iframe></p>`);
    } catch { window.alert('Enter a valid video URL.'); }
  };
  const tools = [
    { label: 'Bold', icon: Bold, action: () => run('bold') },
    { label: 'Italic', icon: Italic, action: () => run('italic') },
    { label: 'Underline', icon: Underline, action: () => run('underline') },
    { label: 'Heading 2', icon: Heading2, action: () => run('formatBlock', 'h2') },
    { label: 'Heading 3', icon: Heading3, action: () => run('formatBlock', 'h3') },
    { label: 'Quote', icon: Quote, action: () => run('formatBlock', 'blockquote') },
    { label: 'Bulleted list', icon: List, action: () => run('insertUnorderedList') },
    { label: 'Numbered list', icon: ListOrdered, action: () => run('insertOrderedList') },
    { label: 'Add link', icon: Link2, action: insertLink },
    { label: 'Add image', icon: ImagePlus, action: insertImage },
    { label: 'Embed video', icon: Video, action: insertVideo },
  ];

  return <div className={`overflow-hidden border ${fieldClass}`}>
    <div className={`flex flex-wrap gap-1 border-b p-2 ${dark ? 'border-[var(--navy-light)]' : 'border-neutral-200'}`} aria-label="Article formatting">
      {tools.map(({ label, icon: Icon, action }) => <button key={label} type="button" aria-label={label} title={label} onMouseDown={event => event.preventDefault()} onClick={action} className={`flex size-9 items-center justify-center transition-colors ${mutedClass}`}><Icon size={16} /></button>)}
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Article body" aria-multiline="true" onInput={event => onChange(sanitizeArticleHtml(event.currentTarget.innerHTML))} className={`prose prose-neutral max-w-none px-4 py-4 text-base leading-8 outline-none ${dark ? 'prose-invert' : ''}`} style={{ minHeight }} data-placeholder="Write your story…" />
    <div className={`border-t px-4 py-2 font-mono text-[10px] ${dark ? 'border-[var(--navy-light)] text-white/40' : 'border-neutral-200 text-neutral-400'}`}>Format your story with headings, quotes, lists, links and images.</div>
  </div>;
}
