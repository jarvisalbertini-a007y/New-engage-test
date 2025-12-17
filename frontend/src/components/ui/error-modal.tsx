import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bug, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

export interface ErrorModalError {
  title: string;
  message: string;
  nextSteps?: string[];
  technicalDetails?: string;
  errorCode?: string;
}

export interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  error: ErrorModalError;
  onReportBug?: () => void;
  showReportButton?: boolean;
}

export function ErrorModal({
  open,
  onClose,
  error,
  onReportBug,
  showReportButton = false,
}: ErrorModalProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyDetails = async () => {
    if (error.technicalDetails) {
      try {
        await navigator.clipboard.writeText(error.technicalDetails);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard access denied
      }
    }
  };

  const handleClose = () => {
    setIsDetailsOpen(false);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="error-modal"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" data-testid="error-modal-icon" />
            </div>
            <DialogTitle
              className="text-xl font-semibold text-destructive"
              data-testid="error-modal-title"
            >
              {error.title}
            </DialogTitle>
          </div>
          {error.errorCode && (
            <span
              className="ml-13 text-xs text-muted-foreground"
              data-testid="error-modal-code"
            >
              Error Code: {error.errorCode}
            </span>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <DialogDescription
            className="text-sm text-foreground/80"
            data-testid="error-modal-message"
          >
            {error.message}
          </DialogDescription>

          {error.nextSteps && error.nextSteps.length > 0 && (
            <div className="space-y-2" data-testid="error-modal-next-steps">
              <h4 className="text-sm font-medium text-foreground">Next Steps</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {error.nextSteps.map((step, index) => (
                  <li key={index} data-testid={`error-modal-step-${index}`}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error.technicalDetails && (
            <Collapsible
              open={isDetailsOpen}
              onOpenChange={setIsDetailsOpen}
              data-testid="error-modal-technical-collapsible"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex w-full items-center justify-between px-0 hover:bg-transparent"
                  data-testid="button-toggle-technical-details"
                >
                  <span className="text-sm font-medium">View Technical Details</span>
                  {isDetailsOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="relative rounded-lg bg-muted/50 p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 h-8 w-8 p-0"
                    onClick={handleCopyDetails}
                    data-testid="button-copy-technical-details"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="sr-only">Copy technical details</span>
                  </Button>
                  <pre
                    className="overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground font-mono max-h-48"
                    data-testid="error-modal-technical-details"
                  >
                    {error.technicalDetails}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {showReportButton && onReportBug && (
            <Button
              variant="outline"
              onClick={onReportBug}
              className="w-full sm:w-auto"
              data-testid="button-report-bug"
            >
              <Bug className="mr-2 h-4 w-4" />
              Report Bug
            </Button>
          )}
          <Button
            onClick={handleClose}
            className="w-full sm:w-auto"
            data-testid="button-dismiss-error"
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
