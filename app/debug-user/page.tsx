'use client';

import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugUserPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8">Not signed in</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>User Debug Information</CardTitle>
          <CardDescription>Check your Clerk user metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">User ID</h3>
            <code className="block p-3 bg-gray-100 rounded">{user.id}</code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Email</h3>
            <code className="block p-3 bg-gray-100 rounded">
              {user.primaryEmailAddress?.emailAddress}
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Public Metadata (Raw)</h3>
            <pre className="p-3 bg-gray-100 rounded overflow-auto">
              {JSON.stringify(user.publicMetadata, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Role Check</h3>
            <code className="block p-3 bg-gray-100 rounded">
              user.publicMetadata?.role = {JSON.stringify(user.publicMetadata?.role)}
            </code>
            <code className="block p-3 bg-gray-100 rounded mt-2">
              Is Admin? {user.publicMetadata?.role === 'admin' ? '✅ YES' : '❌ NO'}
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Full User Object (All Fields)</h3>
            <pre className="p-3 bg-gray-100 rounded overflow-auto max-h-96">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
