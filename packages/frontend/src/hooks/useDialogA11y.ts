import { useEffect, useRef } from 'react';

/**
 * Keyboard and focus behaviour every modal needs.
 *
 * The app hand-rolls its dialogs as `fixed inset-0` overlays, and none of them
 * managed focus. Three things went wrong as a result, and all three hurt
 * ordinary mouse-and-keyboard users, not only assistive-technology ones:
 *
 *  - Escape did nothing, so a dialog opened by accident had to be dismissed by
 *    finding and clicking Cancel.
 *  - Tab walked straight out of the dialog and into the page behind it, so
 *    keying through a form ended up typing into the screen underneath.
 *  - Closing the dialog dropped focus back to the top of the document, losing
 *    the caller's place in a long ward list.
 *
 * Attach the returned ref to the dialog's outermost element:
 *
 *     const ref = useDialogA11y({ open, onClose: handleCancel });
 *     return <div ref={ref} role="dialog" aria-modal="true" …>
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  initialFocus,
}: {
  open: boolean;
  /** Called on Escape. Omit to make the dialog non-dismissable by keyboard. */
  onClose?: () => void;
  /** Focus this when the dialog opens, instead of the first focusable thing. */
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    // Remember where focus was so it can be handed back on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Deliberately no layout-based visibility test here. offsetParent and
    // getClientRects both depend on a rendered box, which makes the trap behave
    // differently under test than in a browser; the selector already excludes
    // disabled and hidden controls, and a dialog's own contents are on screen.
    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
      );

    // Move focus in, so the first Tab stays inside the dialog.
    const target = initialFocus?.current ?? focusables()[0] ?? container;
    target?.focus?.();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        // Nothing to move to; keep focus on the dialog rather than the page.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !container?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Hand focus back to whatever opened the dialog, if it is still there.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.();
      }
    };
  }, [open, onClose, initialFocus]);

  return containerRef;
}
