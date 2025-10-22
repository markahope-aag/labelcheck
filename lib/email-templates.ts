interface AnalysisEmailData {
  productName: string;
  summary: string;
  healthScore: number;
  complianceStatus: string;
  recommendations: string[];
  analyzedAt: string;
}

interface InvitationEmailData {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  invitationUrl: string;
}

export function generateAnalysisResultEmail(data: AnalysisEmailData): string {
  const statusColor =
    data.complianceStatus === 'compliant' ? '#10b981' :
    data.complianceStatus === 'minor_issues' ? '#f59e0b' :
    '#ef4444';

  const statusText =
    data.complianceStatus === 'compliant' ? 'Compliant' :
    data.complianceStatus === 'minor_issues' ? 'Minor Issues Found' :
    'Major Violations Detected';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Food Label Analysis Results</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
                Food Label Analysis Complete
              </h1>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111827;">
                  ${data.productName}
                </h2>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                  ${data.summary}
                </p>
              </div>

              <div style="display: flex; gap: 16px; margin-bottom: 32px;">
                <div style="flex: 1; background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Health Score</div>
                  <div style="font-size: 32px; font-weight: 700; color: #111827;">${data.healthScore}/100</div>
                </div>
                <div style="flex: 1; background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Compliance Status</div>
                  <div style="display: inline-block; background-color: ${statusColor}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 6px 16px; border-radius: 16px; margin-top: 8px;">
                    ${statusText}
                  </div>
                </div>
              </div>

              ${data.recommendations.length > 0 ? `
              <div style="margin-bottom: 32px;">
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
                  Recommendations
                </h3>
                <ul style="margin: 0; padding-left: 24px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  ${data.recommendations.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
                  Analysis completed on ${new Date(data.analyzedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/history" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600; margin-bottom: 16px;">
                  View Full History
                </a>
                <p style="margin: 16px 0 0 0; font-size: 13px; color: #9ca3af;">
                  You can view all your analyses and detailed reports in your dashboard.
                </p>
              </div>
            </td>
          </tr>
        </table>

        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                LabelCheck
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Ensuring food safety and regulatory compliance through AI-powered analysis
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateInvitationEmail(data: InvitationEmailData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
                You've Been Invited!
              </h1>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #111827;">
                  <strong>${data.inviterName}</strong> (${data.inviterEmail}) has invited you to join <strong>${data.organizationName}</strong> on LabelCheck.
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                  You'll be joining as a <strong>${data.role}</strong>.
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${data.invitationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                  Accept Invitation
                </a>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Note:</strong> This invitation will expire in 7 days.
                </p>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                By joining this organization, you'll be able to:
              </p>
              <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 14px; line-height: 1.8; color: #6b7280;">
                <li>Collaborate on food label analyses</li>
                <li>Share compliance reports with your team</li>
                <li>Access organization-wide analysis history</li>
              </ul>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #9ca3af;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>

        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                LabelCheck
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Ensuring food safety and regulatory compliance through AI-powered analysis
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
