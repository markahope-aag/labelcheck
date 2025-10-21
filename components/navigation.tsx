'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navigation() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  const navItems = isSignedIn
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/analyze', label: 'Analyze' },
        { href: '/history', label: 'History' },
        { href: '/reports', label: 'Reports' },
        { href: '/team', label: 'Team' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/admin/documents', label: 'Admin', adminOnly: true },
      ]
    : [
        { href: '/', label: 'Home' },
        { href: '/pricing', label: 'Pricing' },
      ];

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-lg">LabelCheck</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings">
                    Settings
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/billing">
                    Billing
                  </Link>
                </Button>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sign-in">
                    Sign In
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/sign-up">
                    Get Started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
