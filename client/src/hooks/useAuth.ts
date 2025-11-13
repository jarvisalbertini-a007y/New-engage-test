import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

// Authentication is now properly enabled
const TESTING_MODE = false; // Real authentication is now required

export function useAuth() {
  // In testing mode, return mock authenticated user
  if (TESTING_MODE) {
    const mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User'
    };
    
    return {
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
      logout: () => console.log('[TEST] Logout called (no-op in testing mode)')
    };
  }
  
  // Normal authentication flow
  const { data: user, isLoading } = useQuery({
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