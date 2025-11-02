'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Bell, Download, Palette, Clock } from 'lucide-react';

interface UserSettings {
  notification_email_enabled: boolean;
  notification_analysis_complete: boolean;
  notification_team_activity: boolean;
  notification_weekly_summary: boolean;
  default_export_format: 'pdf' | 'csv' | 'json';
  theme_preference: 'light' | 'dark' | 'system';
  timezone: string;
}

export default function SettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    notification_email_enabled: true,
    notification_analysis_complete: true,
    notification_team_activity: true,
    notification_weekly_summary: false,
    default_export_format: 'pdf',
    theme_preference: 'system',
    timezone: 'America/New_York',
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  async function loadSettings() {
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userData.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        await supabase.from('user_settings').insert({
          user_id: userData.id,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!user) return;

    setSaving(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) throw new Error('User not found');

      const { error } = await supabase
        .from('user_settings')
        .update(settings)
        .eq('user_id', userData.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">Loading settings...</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Manage your email notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-enabled">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications from the platform
                  </p>
                </div>
                <Switch
                  id="email-enabled"
                  checked={settings.notification_email_enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notification_email_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="analysis-complete">Analysis Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when your label analysis is complete
                  </p>
                </div>
                <Switch
                  id="analysis-complete"
                  checked={settings.notification_analysis_complete}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notification_analysis_complete: checked })
                  }
                  disabled={!settings.notification_email_enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="team-activity">Team Activity</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about team member activity and shared analyses
                  </p>
                </div>
                <Switch
                  id="team-activity"
                  checked={settings.notification_team_activity}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notification_team_activity: checked })
                  }
                  disabled={!settings.notification_email_enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekly-summary">Weekly Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of your usage and analyses
                  </p>
                </div>
                <Switch
                  id="weekly-summary"
                  checked={settings.notification_weekly_summary}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notification_weekly_summary: checked })
                  }
                  disabled={!settings.notification_email_enabled}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <CardTitle>Export Preferences</CardTitle>
              </div>
              <CardDescription>
                Choose your default export format for analysis reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="export-format">Default Export Format</Label>
                <Select
                  value={settings.default_export_format}
                  onValueChange={(value: 'pdf' | 'csv' | 'json') =>
                    setSettings({ ...settings, default_export_format: value })
                  }
                >
                  <SelectTrigger id="export-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Report</SelectItem>
                    <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This format will be pre-selected when exporting analyses
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <CardTitle>Appearance</CardTitle>
              </div>
              <CardDescription>Customize how the application looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.theme_preference}
                  onValueChange={(value: 'light' | 'dark' | 'system') =>
                    setSettings({ ...settings, theme_preference: value })
                  }
                >
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <CardTitle>Regional Settings</CardTitle>
              </div>
              <CardDescription>
                Set your timezone for accurate date and time display
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} size="lg">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
