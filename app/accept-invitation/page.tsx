'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid' | 'expired'>(
    'loading'
  );
  const [message, setMessage] = useState('');
  const [invitationDetails, setInvitationDetails] = useState<{
    organizationName: string;
    role: string;
  } | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!isLoaded) return;

    if (!token) {
      setStatus('invalid');
      setMessage('No invitation token provided');
      return;
    }

    if (!isSignedIn) {
      // User needs to sign in/up first
      setStatus('loading');
      setMessage('Please sign in to accept this invitation');
      return;
    }

    // User is signed in, try to accept the invitation
    acceptInvitation();
  }, [token, isSignedIn, isLoaded, user]);

  async function acceptInvitation() {
    if (!token) return;

    try {
      const response = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'You have successfully joined the organization!');
        setInvitationDetails({
          organizationName: data.organizationName,
          role: data.role,
        });

        // Redirect to team page after 3 seconds
        setTimeout(() => {
          router.push('/team');
        }, 3000);
      } else if (response.status === 410) {
        setStatus('expired');
        setMessage(data.error || 'This invitation has expired');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setStatus('error');
      setMessage('An unexpected error occurred');
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn && token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Sign in to Accept Invitation</CardTitle>
            <CardDescription>
              You've been invited to join an organization on LabelCheck
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please sign in or create an account to accept this invitation
            </p>
            <div className="space-y-2">
              <Link
                href={`/sign-in?redirect_url=${encodeURIComponent('/accept-invitation?token=' + token)}`}
              >
                <Button className="w-full" size="lg">
                  Sign In
                </Button>
              </Link>
              <Link
                href={`/sign-up?redirect_url=${encodeURIComponent('/accept-invitation?token=' + token)}`}
              >
                <Button variant="outline" className="w-full" size="lg">
                  Create Account
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Processing Invitation</CardTitle>
              <CardDescription>Please wait while we add you to the organization</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Invitation Accepted!</CardTitle>
              <CardDescription>
                Welcome to {invitationDetails?.organizationName || 'the organization'}
              </CardDescription>
            </>
          )}

          {(status === 'error' || status === 'invalid' || status === 'expired') && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl">
                {status === 'expired' ? 'Invitation Expired' : 'Unable to Accept Invitation'}
              </CardTitle>
              <CardDescription>
                {status === 'expired'
                  ? 'This invitation has expired. Please contact the organization owner for a new invitation.'
                  : 'There was a problem accepting your invitation'}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'success' && invitationDetails && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  You've been added to <strong>{invitationDetails.organizationName}</strong> as a{' '}
                  <strong>{invitationDetails.role}</strong>.
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Redirecting you to your team page...
              </p>
            </>
          )}

          {status === 'loading' && (
            <p className="text-sm text-muted-foreground text-center">
              This will only take a moment
            </p>
          )}

          {(status === 'error' || status === 'invalid') && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{message}</p>
              </div>
              <Link href="/team">
                <Button variant="outline" className="w-full">
                  Go to Team Page
                </Button>
              </Link>
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">{message}</p>
              </div>
              <Link href="/team">
                <Button variant="outline" className="w-full">
                  Go to Team Page
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
