'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { FlaskConical, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function Navigation() {
  const pathname = usePathname();
  const { isSignedIn, user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!isSignedIn || !user) {
        setIsAdmin(false);
        return;
      }

      try {
        // Try to fetch admin users endpoint - if successful, user is admin
        const response = await fetch('/api/admin/users');
        setIsAdmin(response.ok);
      } catch {
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, [isSignedIn, user]);

  interface NavItem {
    href: string;
    label: string;
    adminOnly?: boolean;
  }

  const navItems: NavItem[] = isSignedIn
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/analyze', label: 'Analyze' },
        { href: '/history', label: 'History' },
        { href: '/reports', label: 'Reports' },
        { href: '/team', label: 'Team' },
        { href: '/admin', label: 'Admin', adminOnly: true },
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
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
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
            {/* Desktop auth buttons */}
            <div className="hidden md:flex items-center gap-4">
              {isSignedIn ? (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings">Settings</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/billing">Billing</Link>
                  </Button>
                  <div className="flex items-center h-8 w-8">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/sign-up">Get Started</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4">
            <div className="flex flex-col gap-2">
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}

              {/* Mobile auth buttons */}
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t">
                {isSignedIn ? (
                  <>
                    <Button variant="ghost" size="sm" asChild className="justify-start">
                      <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
                        Settings
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="justify-start">
                      <Link href="/billing" onClick={() => setMobileMenuOpen(false)}>
                        Billing
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" asChild className="justify-start">
                      <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                        Sign In
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                        Get Started
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
