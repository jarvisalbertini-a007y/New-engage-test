// New standardized API helper that returns parsed JSON

interface ApiRequestOptions {
  method?: string;
  data?: any;
  headers?: HeadersInit;
}

export async function apiJsonRequest<T = any>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", data, headers = {} } = options;
  
  const response = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      errorText || `Request failed: ${response.status} ${response.statusText}`
    );
    (error as any).status = response.status;
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// Convenience methods for common operations
export const api = {
  get: <T = any>(url: string) => 
    apiJsonRequest<T>(url, { method: "GET" }),
  
  post: <T = any>(url: string, data?: any) =>
    apiJsonRequest<T>(url, { method: "POST", data }),
  
  put: <T = any>(url: string, data: any) =>
    apiJsonRequest<T>(url, { method: "PUT", data }),
  
  patch: <T = any>(url: string, data: any) =>
    apiJsonRequest<T>(url, { method: "PATCH", data }),
  
  delete: <T = any>(url: string) =>
    apiJsonRequest<T>(url, { method: "DELETE" }),
};