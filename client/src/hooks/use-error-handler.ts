import { useState, useCallback } from "react";
import {
  getUserFriendlyMessage,
  parseApiError,
  formatTechnicalDetails,
  type ParsedError,
} from "@/lib/error-utils";

export interface ErrorOptions {
  title: string;
  message: string;
  nextSteps?: string[];
  technicalDetails?: string;
  errorCode?: string;
}

export interface ErrorState {
  isOpen: boolean;
  error: ParsedError | null;
}

export interface UseErrorHandlerReturn {
  error: ParsedError | null;
  isOpen: boolean;
  handleError: (error: Error | unknown, context?: string) => void;
  handleApiError: (response: Response, context?: string) => Promise<void>;
  showError: (options: ErrorOptions) => void;
  clearError: () => void;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [state, setState] = useState<ErrorState>({
    isOpen: false,
    error: null,
  });

  const handleError = useCallback((error: Error | unknown, context?: string) => {
    console.error("Error caught by error handler:", error);

    const parsedError = getUserFriendlyMessage(error);

    if (context) {
      parsedError.technicalDetails = `Context: ${context}\n\n${parsedError.technicalDetails}`;
    }

    setState({
      isOpen: true,
      error: parsedError,
    });
  }, []);

  const handleApiError = useCallback(async (response: Response, context?: string) => {
    console.error("API error caught by error handler:", response.status, response.statusText);

    const parsedError = await parseApiError(response);

    if (context) {
      parsedError.technicalDetails = `Context: ${context}\n\n${parsedError.technicalDetails}`;
    }

    setState({
      isOpen: true,
      error: parsedError,
    });
  }, []);

  const showError = useCallback((options: ErrorOptions) => {
    const error: ParsedError = {
      title: options.title,
      message: options.message,
      nextSteps: options.nextSteps || [
        "Try again",
        "Refresh the page",
        "Contact support if the problem persists",
      ],
      technicalDetails: options.technicalDetails || formatTechnicalDetails({
        customError: true,
        title: options.title,
        message: options.message,
      }),
      errorCode: options.errorCode,
    };

    setState({
      isOpen: true,
      error,
    });
  }, []);

  const clearError = useCallback(() => {
    setState({
      isOpen: false,
      error: null,
    });
  }, []);

  return {
    error: state.error,
    isOpen: state.isOpen,
    handleError,
    handleApiError,
    showError,
    clearError,
  };
}

// Singleton error handler for global use
let globalErrorHandler: UseErrorHandlerReturn | null = null;

export function setGlobalErrorHandler(handler: UseErrorHandlerReturn) {
  globalErrorHandler = handler;
}

export function getGlobalErrorHandler(): UseErrorHandlerReturn | null {
  return globalErrorHandler;
}

// Helper function to show errors globally
export function showGlobalError(options: ErrorOptions): void {
  if (globalErrorHandler) {
    globalErrorHandler.showError(options);
  } else {
    console.error("Global error handler not initialized:", options);
  }
}

// Helper function to handle errors globally
export function handleGlobalError(error: Error | unknown, context?: string): void {
  if (globalErrorHandler) {
    globalErrorHandler.handleError(error, context);
  } else {
    console.error("Global error handler not initialized:", error);
  }
}
