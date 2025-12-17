export interface ParsedError {
  title: string;
  message: string;
  nextSteps: string[];
  technicalDetails: string;
  errorCode?: string;
  statusCode?: number;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
  details?: string;
}

const ERROR_TYPE_MAPPING: Record<string, { title: string; message: string; nextSteps: string[] }> = {
  NetworkError: {
    title: "Connection Problem",
    message: "Unable to connect to the server. Please check your internet connection.",
    nextSteps: [
      "Check your internet connection",
      "Try refreshing the page",
      "Wait a moment and try again"
    ]
  },
  TypeError: {
    title: "Application Error",
    message: "Something unexpected happened in the application.",
    nextSteps: [
      "Refresh the page to reset the application",
      "Clear your browser cache",
      "Try again in a few minutes"
    ]
  },
  SyntaxError: {
    title: "Data Format Error",
    message: "There was a problem processing the server response.",
    nextSteps: [
      "Refresh the page and try again",
      "If the problem persists, contact support"
    ]
  },
  ReferenceError: {
    title: "Application Error",
    message: "The application encountered an unexpected issue.",
    nextSteps: [
      "Refresh the page",
      "Report this issue if it continues"
    ]
  }
};

const HTTP_STATUS_MAPPING: Record<number, { title: string; message: string; nextSteps: string[] }> = {
  400: {
    title: "Invalid Request",
    message: "The request couldn't be processed due to invalid data.",
    nextSteps: [
      "Check the information you entered",
      "Make sure all required fields are filled",
      "Try submitting again"
    ]
  },
  401: {
    title: "Authentication Required",
    message: "You need to log in to access this feature.",
    nextSteps: [
      "Log in to your account",
      "If you're already logged in, try logging out and back in",
      "Check if your session has expired"
    ]
  },
  403: {
    title: "Access Denied",
    message: "You don't have permission to access this resource.",
    nextSteps: [
      "Check if you have the required permissions",
      "Contact your administrator for access",
      "Make sure you're using the correct account"
    ]
  },
  404: {
    title: "Not Found",
    message: "The requested resource could not be found.",
    nextSteps: [
      "Check if the URL is correct",
      "The item may have been moved or deleted",
      "Go back and try navigating to this page again"
    ]
  },
  408: {
    title: "Request Timeout",
    message: "The server took too long to respond.",
    nextSteps: [
      "Check your internet connection",
      "Try again in a few moments",
      "If the problem persists, the server may be busy"
    ]
  },
  429: {
    title: "Too Many Requests",
    message: "You've made too many requests. Please slow down.",
    nextSteps: [
      "Wait a few minutes before trying again",
      "Reduce the frequency of your requests",
      "Contact support if you need higher limits"
    ]
  },
  500: {
    title: "Server Error",
    message: "Something went wrong on our end. We're working to fix it.",
    nextSteps: [
      "Try again in a few minutes",
      "Refresh the page",
      "If the problem persists, contact support"
    ]
  },
  502: {
    title: "Service Unavailable",
    message: "The server is temporarily unavailable.",
    nextSteps: [
      "Wait a few moments and try again",
      "Check our status page for outages",
      "Contact support if the issue persists"
    ]
  },
  503: {
    title: "Service Unavailable",
    message: "The service is temporarily unavailable for maintenance.",
    nextSteps: [
      "Please try again later",
      "Check our status page for updates",
      "The service should be back shortly"
    ]
  },
  504: {
    title: "Gateway Timeout",
    message: "The server didn't respond in time.",
    nextSteps: [
      "Try again in a few moments",
      "Check your internet connection",
      "Contact support if the problem continues"
    ]
  }
};

export async function parseApiError(response: Response): Promise<ParsedError> {
  const statusCode = response.status;
  let body: ApiErrorResponse = {};
  
  try {
    const text = await response.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Response body is not JSON or empty
  }

  const statusInfo = HTTP_STATUS_MAPPING[statusCode] || {
    title: "Request Failed",
    message: `The request failed with status ${statusCode}.`,
    nextSteps: [
      "Try again in a few moments",
      "Refresh the page",
      "Contact support if the problem persists"
    ]
  };

  const serverMessage = body.message || body.error || body.details;
  
  return {
    title: statusInfo.title,
    message: serverMessage || statusInfo.message,
    nextSteps: statusInfo.nextSteps,
    technicalDetails: formatTechnicalDetails({
      status: statusCode,
      statusText: response.statusText,
      url: response.url,
      body
    }),
    errorCode: body.code || `HTTP_${statusCode}`,
    statusCode
  };
}

export function getUserFriendlyMessage(error: unknown): ParsedError {
  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      return {
        ...ERROR_TYPE_MAPPING.NetworkError,
        technicalDetails: formatTechnicalDetails(error),
        nextSteps: ERROR_TYPE_MAPPING.NetworkError.nextSteps
      };
    }

    // Check for HTTP status code in error message (from apiRequest)
    const statusMatch = error.message.match(/^(\d{3}):/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1], 10);
      const statusInfo = HTTP_STATUS_MAPPING[statusCode];
      if (statusInfo) {
        return {
          ...statusInfo,
          technicalDetails: formatTechnicalDetails(error),
          errorCode: `HTTP_${statusCode}`,
          statusCode
        };
      }
    }

    // Check error type mapping
    const errorType = error.constructor.name;
    const typeInfo = ERROR_TYPE_MAPPING[errorType];
    if (typeInfo) {
      return {
        ...typeInfo,
        technicalDetails: formatTechnicalDetails(error),
        nextSteps: typeInfo.nextSteps
      };
    }

    // Default error handling
    return {
      title: "Something Went Wrong",
      message: error.message || "An unexpected error occurred.",
      nextSteps: [
        "Try again",
        "Refresh the page",
        "Contact support if the problem persists"
      ],
      technicalDetails: formatTechnicalDetails(error)
    };
  }

  // Handle non-Error objects
  if (typeof error === "string") {
    return {
      title: "Error",
      message: error,
      nextSteps: ["Try again", "Refresh the page"],
      technicalDetails: error
    };
  }

  return {
    title: "Unknown Error",
    message: "An unexpected error occurred.",
    nextSteps: [
      "Try again",
      "Refresh the page",
      "Contact support if the problem persists"
    ],
    technicalDetails: formatTechnicalDetails(error)
  };
}

export function formatTechnicalDetails(error: unknown): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();
  
  lines.push(`Timestamp: ${timestamp}`);
  lines.push(`User Agent: ${navigator.userAgent}`);
  lines.push(`URL: ${window.location.href}`);
  lines.push("");

  if (error instanceof Error) {
    lines.push(`Error Type: ${error.constructor.name}`);
    lines.push(`Message: ${error.message}`);
    
    if (error.stack) {
      lines.push("");
      lines.push("Stack Trace:");
      lines.push(error.stack);
    }
  } else if (typeof error === "object" && error !== null) {
    lines.push("Error Details:");
    try {
      lines.push(JSON.stringify(error, null, 2));
    } catch {
      lines.push(String(error));
    }
  } else {
    lines.push(`Error: ${String(error)}`);
  }

  return lines.join("\n");
}

export function getSuggestedNextSteps(errorType: string): string[] {
  // Check if it's an HTTP status code pattern
  const httpMatch = errorType.match(/^HTTP_(\d{3})$/);
  if (httpMatch) {
    const statusCode = parseInt(httpMatch[1], 10);
    const statusInfo = HTTP_STATUS_MAPPING[statusCode];
    if (statusInfo) {
      return statusInfo.nextSteps;
    }
  }

  // Check if it's a known error type
  const typeInfo = ERROR_TYPE_MAPPING[errorType];
  if (typeInfo) {
    return typeInfo.nextSteps;
  }

  // Default suggestions
  return [
    "Try again",
    "Refresh the page",
    "Contact support if the problem persists"
  ];
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("Network request failed")
    );
  }
  return false;
}

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof Error) {
    const statusMatch = error.message.match(/^(\d{3}):/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1], 10);
      return statusCode === 401;
    }
  }
  return false;
}

export function isAuthorizationError(error: unknown): boolean {
  if (error instanceof Error) {
    const statusMatch = error.message.match(/^(\d{3}):/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1], 10);
      return statusCode === 403;
    }
  }
  return false;
}
