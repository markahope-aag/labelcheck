'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Mail, Shield, Trash2, Building2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Organization {
  id: string;
  name: string;
  slug: string;
  billing_email: string;
  plan_tier: string;
  max_members: number;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invited_at: string;
  joined_at: string | null;
  users: {
    email: string;
  };
}

export default function TeamPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');

  useEffect(() => {
    loadOrganization();
  }, [user]);

  async function loadOrganization() {
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) return;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userData.id)
        .maybeSingle();

      if (!membership) {
        setShowCreateOrg(true);
        setLoading(false);
        return;
      }

      setCurrentUserRole(membership.role);

      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', membership.organization_id)
        .single();

      if (orgData) {
        setOrganization(orgData);
        await loadMembers(orgData.id);
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(orgId: string) {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        role,
        invited_at,
        joined_at,
        users!inner (email)
      `)
      .eq('organization_id', orgId);

    if (error) {
      console.error('Error loading members:', error);
    } else {
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        users: Array.isArray(item.users) ? item.users[0] : item.users,
      }));
      setMembers(formattedData);
    }
  }

  async function createOrganization() {
    if (!user || !orgName || !orgSlug) return;

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('clerk_user_id', user.id)
        .single();

      if (userError || !userData) throw userError || new Error('User not found');

      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          billing_email: userData.email,
          created_by: userData.id,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: userData.id,
          role: 'owner',
          joined_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      toast({
        title: 'Success',
        description: 'Organization created successfully',
      });

      setShowCreateOrg(false);
      loadOrganization();
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create organization',
        variant: 'destructive',
      });
    }
  }

  async function inviteMember() {
    if (!organization || !inviteEmail) return;

    try {
      const { data: invitedUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteEmail)
        .maybeSingle();

      if (!invitedUser) {
        toast({
          title: 'Error',
          description: 'User not found. They must create an account first.',
          variant: 'destructive',
        });
        return;
      }

      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user!.id)
        .single();

      if (currentUserError || !currentUser) throw currentUserError || new Error('Current user not found');

      const { error } = await supabase.from('organization_members').insert({
        organization_id: organization.id,
        user_id: invitedUser.id,
        role: inviteRole,
        invited_by: currentUser.id,
        joined_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member invited successfully',
      });

      setInviteEmail('');
      loadMembers(organization.id);
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite member',
        variant: 'destructive',
      });
    }
  }

  async function removeMember(memberId: string) {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member removed successfully',
      });

      loadMembers(organization!.id);
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      });
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">Loading organization...</div>
        </div>
      </div>
    );
  }

  if (showCreateOrg) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                <CardTitle>Create Your Organization</CardTitle>
              </div>
              <CardDescription>
                Set up your team workspace to collaborate on food label analyses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Corporation"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">URL Slug</Label>
                <Input
                  id="org-slug"
                  placeholder="acme-corporation"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  This will be used in your organization URL
                </p>
              </div>

              <Button onClick={createOrganization} className="w-full">
                Create Organization
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Team Management</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>{organization?.name}</CardTitle>
              </div>
              <CardDescription>
                Manage your organization and team members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-semibold capitalize">{organization?.plan_tier}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Members</p>
                  <p className="font-semibold">{members.length} / {organization?.max_members}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {canManageMembers && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <CardTitle>Invite Team Member</CardTitle>
                </div>
                <CardDescription>
                  Add new members to your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Email address"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={inviteMember}>
                    <Plus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Team Members</CardTitle>
              </div>
              <CardDescription>
                {members.length} member{members.length !== 1 ? 's' : ''} in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {member.users.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.users.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Joined {new Date(member.joined_at || member.invited_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                        <Shield className="h-3 w-3 mr-1" />
                        {member.role}
                      </Badge>
                      {canManageMembers && member.role !== 'owner' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {member.users.email} from the organization?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMember(member.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
