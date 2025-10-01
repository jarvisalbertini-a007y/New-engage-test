import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export function useAuth() {
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