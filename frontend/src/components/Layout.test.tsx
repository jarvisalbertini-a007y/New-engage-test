/// <reference types="jest" />
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';

const mockLogout = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'seller@example.com',
      firstName: 'Seller',
      role: 'sales',
      onboardingCompleted: true,
    },
    logout: mockLogout,
  }),
}));

function renderLayout(root: Root, route: string) {
  return act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="*" element={<div>Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  });
}

function findNavLink(container: HTMLDivElement, label: string): HTMLAnchorElement {
  const links = Array.from(container.querySelectorAll('a'));
  const match = links.find((link) => (link.textContent || '').includes(label));
  if (!match) {
    throw new Error(`Nav link not found: ${label}`);
  }
  return match as HTMLAnchorElement;
}

describe('Layout navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it('shows Sales Intelligence in authenticated navigation', async () => {
    await renderLayout(root, '/dashboard');
    expect(container.textContent).toContain('Sales Intelligence');
  });

  it('marks Sales Intelligence route as active when selected', async () => {
    await renderLayout(root, '/sales-intelligence');
    const salesLink = findNavLink(container, 'Sales Intelligence');
    expect(salesLink.className).toContain('bg-primary');
    expect(salesLink.className).toContain('text-white');
  });
});
