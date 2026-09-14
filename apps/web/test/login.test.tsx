import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQueryClient } from './utils/render';
import LoginPage from '../src/app/login/page';

const replace = vi.fn();
const login = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login }),
  ApiError: class ApiError extends Error {},
}));

describe('LoginPage', () => {
  beforeEach(() => {
    replace.mockClear();
    login.mockClear();
  });

  it('submits phone and password, then redirects to the dashboard', async () => {
    login.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(<LoginPage />);

    await user.type(screen.getByPlaceholderText('10-digit phone number'), '9999999999');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('9999999999', 'password123'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a validation error for a too-short phone number without calling login', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LoginPage />);

    await user.type(screen.getByPlaceholderText('10-digit phone number'), '123');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(login).not.toHaveBeenCalled());
  });
});
