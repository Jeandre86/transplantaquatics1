import { useEffect } from 'react';

/**
 * Fires `callback` for the search shortcut or slash when focus is outside editable controls.
 * Cleans up the event listener on unmount.
 */
export function useKeyboardSearch(callback: () => void): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        (e.target as HTMLElement)?.isContentEditable;

      const searchShortcut = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
      const slashShortcut = e.key === '/' && !e.metaKey && !e.ctrlKey;
      if ((searchShortcut || slashShortcut) && !isEditable) {
        e.preventDefault();
        callback();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
}
