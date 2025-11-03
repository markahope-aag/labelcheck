import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  code?: string;
  variant?: 'destructive' | 'warning' | 'info';
}

export function ErrorAlert({
  title = 'Error',
  message,
  code,
  variant = 'destructive',
}: ErrorAlertProps) {
  const Icon = variant === 'warning' ? AlertTriangle : variant === 'info' ? Info : AlertCircle;

  // Alert component only supports 'default' and 'destructive' variants
  // Use 'destructive' for error, 'default' for warning/info
  const alertVariant = variant === 'destructive' ? 'destructive' : 'default';

  return (
    <Alert variant={alertVariant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message}
        {code && (
          <span className="block text-xs text-muted-foreground mt-1">Error code: {code}</span>
        )}
      </AlertDescription>
    </Alert>
  );
}
