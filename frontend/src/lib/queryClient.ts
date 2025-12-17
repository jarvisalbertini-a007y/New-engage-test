import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getUserFriendlyMessage, parseApiError, type ParsedError } from "@/lib/error-utils";
import { handleGlobalError } from "@/hooks/use-error-handler";

export interface ApiError extends Error {
  status?: number;
  parsedError?: ParsedError;
}

async function createApiError(res: Response): Promise<ApiError> {
  const parsedError = await parseApiError(res);
  const error = new Error(`${res.status}: ${parsedError.message}`) as ApiError;
  error.status = res.status;
  error.parsedError = parsedError;
  return error;
}

async function handleErrorResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const error = await createApiError(res);
    
    // Log the error for debugging
    console.error("API Error:", {
      status: res.status,
      url: res.url,
      message: error.parsedError?.message,
    });

    // Optionally trigger global error handler for specific status codes
    // This allows consuming code to either catch the error or let it bubble up
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await handleErrorResponse(res);
    return res;
  } catch (error) {
    // If it's a network error (not an API error), enhance it
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      const networkError = new Error("Network error: Unable to connect to the server") as ApiError;
      networkError.parsedError = getUserFriendlyMessage(error);
      throw networkError;
    }
    throw error;
  }
}

export async function apiRequestWithErrorHandling(
  method: string,
  url: string,
  data?: unknown | undefined,
  context?: string,
): Promise<Response> {
  try {
    return await apiRequest(method, url, data);
  } catch (error) {
    handleGlobalError(error, context || `${method} ${url}`);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await handleErrorResponse(res);
      return await res.json();
    } catch (error) {
      // Enhance network errors
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        const networkError = new Error("Network error: Unable to connect to the server") as ApiError;
        networkError.parsedError = getUserFriendlyMessage(error);
        throw networkError;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
      onError: (error) => {
        // Log mutation errors globally
        console.error("Mutation error:", error);
      },
    },
  },
});

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const apiError = error as ApiError;
    if (apiError.parsedError) {
      return apiError.parsedError.message;
    }
    return error.message;
  }
  return "An unexpected error occurred";
}

export function getErrorDetails(error: unknown): ParsedError {
  if (error instanceof Error) {
    const apiError = error as ApiError;
    if (apiError.parsedError) {
      return apiError.parsedError;
    }
  }
  return getUserFriendlyMessage(error);
}
