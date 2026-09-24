import { useEffect } from 'react';

/**
 * Fires `callback` when the user presses "/" outside of an input or textarea.
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

      if (e.key === '/' && !isEditable && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        callback();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
}
