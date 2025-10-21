import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    return NextResponse.json({
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      publicMetadata: user.publicMetadata,
      role: user.publicMetadata?.role,
      isAdmin: user.publicMetadata?.role === 'admin',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
