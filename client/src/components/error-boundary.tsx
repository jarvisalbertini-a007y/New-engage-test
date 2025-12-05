import { Component, type ReactNode } from "react";
import { ErrorModal, type ErrorModalError } from "@/components/ui/error-modal";
import { formatTechnicalDetails, getSuggestedNextSteps } from "@/lib/error-utils";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  onReportBug?: (error: ErrorModalError) => void;
  showReportButton?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    console.error("Error Boundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);

    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleDismiss = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleTryAgain = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReportBug = (): void => {
    if (this.props.onReportBug && this.state.error) {
      const errorModalData: ErrorModalError = {
        title: "Application Error",
        message: this.state.error.message || "An unexpected error occurred.",
        nextSteps: getSuggestedNextSteps(this.state.error.constructor.name),
        technicalDetails: this.formatErrorDetails(),
        errorCode: `BOUNDARY_${this.state.error.constructor.name.toUpperCase()}`,
      };
      this.props.onReportBug(errorModalData);
    }
  };

  formatErrorDetails(): string {
    const { error, errorInfo } = this.state;
    let details = formatTechnicalDetails(error);

    if (errorInfo?.componentStack) {
      details += "\n\nComponent Stack:\n" + errorInfo.componentStack;
    }

    return details;
  }

  getErrorModalData(): ErrorModalError {
    const { error } = this.state;

    return {
      title: "Application Error",
      message:
        error?.message ||
        "Something went wrong while rendering this component. Please try refreshing the page.",
      nextSteps: [
        "Click 'Try Again' to reload the component",
        "Refresh the page if the problem persists",
        "Clear your browser cache and try again",
        "Contact support if you continue to experience issues",
      ],
      technicalDetails: this.formatErrorDetails(),
      errorCode: error ? `BOUNDARY_${error.constructor.name.toUpperCase()}` : "BOUNDARY_UNKNOWN",
    };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex min-h-[200px] items-center justify-center p-8"
          data-testid="error-boundary-container"
        >
          <ErrorModal
            open={true}
            onClose={this.handleTryAgain}
            error={this.getErrorModalData()}
            onReportBug={this.props.onReportBug ? this.handleReportBug : undefined}
            showReportButton={this.props.showReportButton}
          />
          <div
            className="text-center space-y-4"
            data-testid="error-boundary-fallback"
          >
            <p className="text-muted-foreground text-sm">
              Something went wrong. Close the dialog to try again.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WithErrorBoundaryOptions {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  onReportBug?: (error: ErrorModalError) => void;
  showReportButton?: boolean;
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
): React.ComponentType<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary
        fallback={options.fallback}
        onError={options.onError}
        onReportBug={options.onReportBug}
        showReportButton={options.showReportButton}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundaryWrapper.displayName = `WithErrorBoundary(${displayName})`;

  return WithErrorBoundaryWrapper;
}
