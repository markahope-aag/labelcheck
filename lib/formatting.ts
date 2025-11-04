/**
 * Formatting Utilities
 *
 * Shared formatting functions for consistent display across the application.
 */

/**
 * Format compliance status for display
 * Converts snake_case API values to properly capitalized display text
 */
export function formatComplianceStatus(status: string): string {
  if (!status) return '';

  // Handle specific cases with predefined mappings
  const statusMap: Record<string, string> = {
    compliant: 'Compliant',
    likely_compliant: 'Likely Compliant',
    non_compliant: 'Non-Compliant',
    potentially_non_compliant: 'Potentially-Non-Compliant',
    not_applicable: 'Not Applicable',
    warning: 'Warning',
  };

  // Return mapped value if exists, otherwise convert snake_case to Title-Case
  return (
    statusMap[status] ||
    status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-')
  );
}
