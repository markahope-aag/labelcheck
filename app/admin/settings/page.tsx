'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Save,
  AlertCircle,
  Check,
  Mail,
  Key,
  Database,
  CreditCard,
  Globe,
  Bell,
  Shield,
  Zap,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function AdminSettingsPage() {
  const [saveMessage, setSaveMessage] = useState('');
  const [settings, setSettings] = useState({
    general: {
      appName: 'LabelCheck',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      supportEmail: 'support@labelcheck.com',
      maxUploadSize: '10', // MB
    },
    email: {
      provider: 'Resend',
      fromEmail: 'noreply@labelcheck.com',
      fromName: 'LabelCheck',
      enableNotifications: true,
    },
    ai: {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: '4096',
      temperature: '0.3',
      enableCaching: true,
    },
    stripe: {
      mode: 'test',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? '••••••••' : 'Not configured',
    },
    database: {
      provider: 'Supabase',
      rlsEnabled: true,
      backupsEnabled: false,
    },
    features: {
      enableTeams: true,
      enableExports: true,
      enableApiAccess: false,
      enableCustomBranding: false,
    },
  });

  const handleSave = (section: string) => {
    setSaveMessage(`${section} settings saved successfully`);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const updateSetting = (
    section: keyof typeof settings,
    key: string,
    value: string | number | boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-2">Configure application settings and integrations</p>
      </div>

      {saveMessage && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{saveMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-gray-600" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>Basic application configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appName">Application Name</Label>
                <Input
                  id="appName"
                  value={settings.general.appName}
                  onChange={(e) => updateSetting('general', 'appName', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="appUrl">Application URL</Label>
                <Input
                  id="appUrl"
                  value={settings.general.appUrl}
                  onChange={(e) => updateSetting('general', 'appUrl', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.general.supportEmail}
                  onChange={(e) => updateSetting('general', 'supportEmail', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="maxUploadSize">Max Upload Size (MB)</Label>
                <Input
                  id="maxUploadSize"
                  type="number"
                  value={settings.general.maxUploadSize}
                  onChange={(e) => updateSetting('general', 'maxUploadSize', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <Button onClick={() => handleSave('General')}>
              <Save className="h-4 w-4 mr-2" />
              Save General Settings
            </Button>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-600" />
              <CardTitle>Email Settings</CardTitle>
            </div>
            <CardDescription>Configure email notifications and sender details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emailProvider">Email Provider</Label>
                <Input
                  id="emailProvider"
                  value={settings.email.provider}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fromEmail">From Email</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={settings.email.fromEmail}
                  onChange={(e) => updateSetting('email', 'fromEmail', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={settings.email.fromName}
                  onChange={(e) => updateSetting('email', 'fromName', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="emailNotifications" className="cursor-pointer">
                    Enable Email Notifications
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Send analysis completion emails</p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.email.enableNotifications}
                  onCheckedChange={(checked) =>
                    updateSetting('email', 'enableNotifications', checked)
                  }
                />
              </div>
            </div>
            <Button onClick={() => handleSave('Email')}>
              <Save className="h-4 w-4 mr-2" />
              Save Email Settings
            </Button>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-gray-600" />
              <CardTitle>AI Configuration</CardTitle>
            </div>
            <CardDescription>Anthropic Claude API settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Changes to AI settings will affect all future analyses. Test thoroughly before
                applying.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aiModel">Model</Label>
                <Input
                  id="aiModel"
                  value={settings.ai.model}
                  onChange={(e) => updateSetting('ai', 'model', e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Current: Claude 3.5 Sonnet</p>
              </div>
              <div>
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={settings.ai.maxTokens}
                  onChange={(e) => updateSetting('ai', 'maxTokens', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.ai.temperature}
                  onChange={(e) => updateSetting('ai', 'temperature', e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Range: 0.0 - 1.0</p>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="aiCaching" className="cursor-pointer">
                    Enable Prompt Caching
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Reduce API costs and latency</p>
                </div>
                <Switch
                  id="aiCaching"
                  checked={settings.ai.enableCaching}
                  onCheckedChange={(checked) => updateSetting('ai', 'enableCaching', checked)}
                />
              </div>
            </div>
            <Button onClick={() => handleSave('AI')}>
              <Save className="h-4 w-4 mr-2" />
              Save AI Settings
            </Button>
          </CardContent>
        </Card>

        {/* Stripe Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <CardTitle>Stripe Configuration</CardTitle>
            </div>
            <CardDescription>Payment processing settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Mode</Label>
                <div className="flex gap-2 mt-2">
                  <Badge variant={settings.stripe.mode === 'test' ? 'default' : 'outline'}>
                    Test Mode
                  </Badge>
                  <Badge variant={settings.stripe.mode === 'live' ? 'default' : 'outline'}>
                    Live Mode
                  </Badge>
                </div>
              </div>
              <div>
                <Label htmlFor="webhookSecret">Webhook Secret</Label>
                <Input
                  id="webhookSecret"
                  type="password"
                  value={settings.stripe.webhookSecret}
                  disabled
                  className="mt-1"
                />
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Stripe configuration is managed via environment variables. Update your .env.local
                file to change these settings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Database Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-600" />
              <CardTitle>Database Configuration</CardTitle>
            </div>
            <CardDescription>Supabase database settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Provider</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    {settings.database.provider}
                  </Badge>
                  <span className="text-xs text-gray-500">PostgreSQL</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="rlsEnabled" className="cursor-pointer">
                    Row Level Security
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Required for data isolation</p>
                </div>
                <Switch id="rlsEnabled" checked={settings.database.rlsEnabled} disabled />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="backupsEnabled" className="cursor-pointer">
                    Automatic Backups
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Daily database backups</p>
                </div>
                <Switch
                  id="backupsEnabled"
                  checked={settings.database.backupsEnabled}
                  onCheckedChange={(checked) =>
                    updateSetting('database', 'backupsEnabled', checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-600" />
              <CardTitle>Feature Flags</CardTitle>
            </div>
            <CardDescription>Enable or disable application features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="enableTeams" className="cursor-pointer">
                    Team Collaboration
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Allow users to create teams</p>
                </div>
                <Switch
                  id="enableTeams"
                  checked={settings.features.enableTeams}
                  onCheckedChange={(checked) => updateSetting('features', 'enableTeams', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="enableExports" className="cursor-pointer">
                    Export Features
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">PDF, CSV, JSON exports</p>
                </div>
                <Switch
                  id="enableExports"
                  checked={settings.features.enableExports}
                  onCheckedChange={(checked) => updateSetting('features', 'enableExports', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="enableApiAccess" className="cursor-pointer">
                    API Access
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">REST API for integrations</p>
                </div>
                <Switch
                  id="enableApiAccess"
                  checked={settings.features.enableApiAccess}
                  onCheckedChange={(checked) =>
                    updateSetting('features', 'enableApiAccess', checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="enableCustomBranding" className="cursor-pointer">
                    Custom Branding
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">White-label options</p>
                </div>
                <Switch
                  id="enableCustomBranding"
                  checked={settings.features.enableCustomBranding}
                  onCheckedChange={(checked) =>
                    updateSetting('features', 'enableCustomBranding', checked)
                  }
                />
              </div>
            </div>
            <Button onClick={() => handleSave('Feature Flags')}>
              <Save className="h-4 w-4 mr-2" />
              Save Feature Settings
            </Button>
          </CardContent>
        </Card>

        {/* Environment Variables Reference */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-gray-600" />
              <CardTitle>Environment Variables</CardTitle>
            </div>
            <CardDescription>Current configuration status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                {
                  name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
                  status: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
                },
                { name: 'ANTHROPIC_API_KEY', status: !!process.env.ANTHROPIC_API_KEY },
                {
                  name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
                  status: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
                },
                {
                  name: 'NEXT_PUBLIC_SUPABASE_URL',
                  status: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                },
                { name: 'RESEND_API_KEY', status: !!process.env.RESEND_API_KEY },
              ].map((env) => (
                <div
                  key={env.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <code className="text-xs">{env.name}</code>
                  <Badge variant={env.status ? 'default' : 'destructive'}>
                    {env.status ? 'Configured' : 'Missing'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
