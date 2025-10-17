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
                <Link href="/settings">
                  <Button variant="ghost" size="sm">
                    Settings
                  </Button>
                </Link>
                <Link href="/billing">
                  <Button variant="ghost" size="sm">
                    Billing
                  </Button>
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
