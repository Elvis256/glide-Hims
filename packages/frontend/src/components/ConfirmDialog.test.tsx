/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

afterEach(cleanup);

/**
 * These cover the keyboard behaviour of a confirmation, which is where a
 * destructive action is either caught or waved through.
 */
describe('ConfirmDialog', () => {
  const base = {
    open: true,
    title: 'Delete backup',
    message: 'This cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('opens with focus on Cancel, not on the destructive action', async () => {
    // Confirm used to carry autoFocus. Someone who has just pressed Enter to
    // submit the form behind presses it once more out of habit and the delete
    // goes through without the dialog ever being read.
    render(<ConfirmDialog {...base} confirmLabel="Delete" />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Delete' }));
  });

  it('a stray Enter on open cancels rather than confirms', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.keyboard('{Enter}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onCancel={onCancel} />);

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while the action is running', async () => {
    // The request is already on its way; dismissing would only hide it.
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} loading onCancel={onCancel} />);

    await userEvent.keyboard('{Escape}');

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('announces itself as a dialog, with its title and message attached', () => {
    render(<ConfirmDialog {...base} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const titleId = dialog.getAttribute('aria-labelledby');
    const messageId = dialog.getAttribute('aria-describedby');
    expect(document.getElementById(titleId!)?.textContent).toBe('Delete backup');
    expect(document.getElementById(messageId!)?.textContent).toBe('This cannot be undone.');
  });

  it('keeps Tab inside the dialog instead of walking onto the page behind', async () => {
    render(
      <>
        <button>behind the overlay</button>
        <ConfirmDialog {...base} confirmLabel="Delete" />
      </>,
    );

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const del = screen.getByRole('button', { name: 'Delete' });

    expect(document.activeElement).toBe(cancel);
    await userEvent.tab();
    expect(document.activeElement).toBe(del);
    // Past the last control, focus comes back round rather than leaving.
    await userEvent.tab();
    expect(document.activeElement).toBe(cancel);
  });

  it('hands focus back to whatever opened it', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Delete backup';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(<ConfirmDialog {...base} />);
    expect(document.activeElement).not.toBe(opener);

    rerender(<ConfirmDialog {...base} open={false} />);
    expect(document.activeElement).toBe(opener);

    opener.remove();
  });

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
