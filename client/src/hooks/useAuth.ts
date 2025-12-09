import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export interface User {
  id?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

// Authentication can be bypassed in demo mode for testing
const TESTING_MODE = window.location.hostname === 'localhost' && 
  new URLSearchParams(window.location.search).get('demo') === 'true';

export function useAuth(): { user: User | undefined; isLoading: boolean; isAuthenticated: boolean; logout: () => void } {
  // In testing mode, return mock authenticated user
  if (TESTING_MODE) {
    const mockUser: User = {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: undefined
    };
    
    return {
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
      logout: () => console.log('[TEST] Logout called (no-op in testing mode)')
    };
  }
  
  // Normal authentication flow
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const logout = useCallback(() => {
    // The logout endpoint redirects to the OIDC provider's logout endpoint
    // and then redirects back to the homepage
    window.location.href = '/api/logout';
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}