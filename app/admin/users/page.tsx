'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Mail, Calendar, CreditCard, FileText, Trash2, Edit, Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
  is_system_admin: boolean;
  subscription?: {
    plan_tier: string;
    status: string;
  };
  analyses_count?: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setDetailDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleToggleAdmin = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}/toggle-admin`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle admin status');
      }

      // Reload users to reflect the change
      await loadUsers();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      alert(error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      // Remove user from local state
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlanBadge = (planTier?: string) => {
    switch (planTier) {
      case 'pro':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Pro</Badge>;
      case 'enterprise':
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">Enterprise</Badge>
        );
      case 'basic':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Basic</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Past Due</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
        <p className="text-gray-600 mt-2">Manage user accounts and subscriptions</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by email or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          <CardDescription>View and manage user accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-600">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Analyses</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 h-10 w-10 rounded-full flex items-center justify-center">
                            <Mail className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.email}</p>
                            <p className="text-xs text-gray-500">ID: {user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(user.subscription?.plan_tier)}</TableCell>
                      <TableCell>{getStatusBadge(user.subscription?.status)}</TableCell>
                      <TableCell>
                        {user.is_system_admin && (
                          <Badge variant="destructive" className="bg-purple-600">
                            System Admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span>{user.analyses_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(user)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant={user.is_system_admin ? 'secondary' : 'default'}
                            size="sm"
                            onClick={() => handleToggleAdmin(user)}
                          >
                            {user.is_system_admin ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Detailed information about this user account</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email</Label>
                  <p className="mt-1 text-sm text-gray-900">{selectedUser.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">User ID</Label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{selectedUser.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Clerk User ID</Label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedUser.clerk_user_id}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Stripe Customer ID</Label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedUser.stripe_customer_id || 'None'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Account Created</Label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedUser.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Total Analyses</Label>
                  <p className="mt-1 text-sm text-gray-900">{selectedUser.analyses_count || 0}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-gray-700">Subscription</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div>
                    <span className="text-xs text-gray-500">Plan:</span>{' '}
                    {getPlanBadge(selectedUser.subscription?.plan_tier)}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Status:</span>{' '}
                    {getStatusBadge(selectedUser.subscription?.status)}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Actions</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedUser.id);
                    }}
                  >
                    Copy User ID
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedUser.clerk_user_id);
                    }}
                  >
                    Copy Clerk ID
                  </Button>
                  {selectedUser.stripe_customer_id && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(
                          `https://dashboard.stripe.com/customers/${selectedUser.stripe_customer_id}`,
                          '_blank'
                        );
                      }}
                    >
                      View in Stripe
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account for{' '}
              <strong>{userToDelete?.email}</strong> and all associated data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All analysis records</li>
                <li>Subscription information</li>
                <li>Usage tracking data</li>
                <li>User settings</li>
              </ul>
              <p className="mt-3 text-red-600 font-semibold">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
