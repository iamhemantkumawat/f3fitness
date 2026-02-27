import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { templatesAPI, settingsAPI } from '../../lib/api';
import { Mail, Save, RotateCcw, Info, Eye, EyeOff, Send } from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_TEMPLATE_TYPES = [
  { type: 'welcome', label: 'Welcome Email', description: 'Sent when a new member joins' },
  { type: 'new_user_credentials', label: 'New User Credentials', description: 'Sent when account is created (admin or self signup)' },
  { type: 'otp', label: 'OTP Verification', description: 'Sent for email/phone verification' },
  { type: 'password_reset', label: 'Password Reset', description: 'Sent when user requests password reset' },
  { type: 'attendance', label: 'Attendance Confirmation', description: 'Sent when attendance is marked' },
  { type: 'membership_activated', label: 'Membership Activated', description: 'Sent when membership is activated' },
  { type: 'invoice_sent', label: 'Invoice Sent', description: 'Sent with invoice PDF attachment after payment' },
  { type: 'freeze_started', label: 'Freeze Started', description: 'Sent when a membership freeze is started' },
  { type: 'freeze_ended', label: 'Freeze Ended', description: 'Sent when a freeze is ended manually/early' },
  { type: 'freeze_ending_tomorrow', label: 'Freeze Ending Tomorrow', description: 'Sent one day before a freeze ends' },
  { type: 'payment_received', label: 'Payment Receipt', description: 'Sent after payment is received' },
  { type: 'renewal_reminder', label: 'Renewal Reminder', description: 'Sent before membership expires' },
  { type: 'birthday', label: 'Birthday Wishes', description: 'Sent on member\'s birthday' },
  { type: 'absent_warning', label: 'Absence Warning', description: 'Sent when member is absent for days' },
  { type: 'holiday', label: 'Holiday Notice', description: 'Sent to announce gym holidays' },
  { type: 'announcement', label: 'Announcement', description: 'Sent for general announcements' },
  { type: 'plan_shared', label: 'Plan Shared', description: 'Sent when trainer shares a plan' }
];

const AVAILABLE_VARIABLES = [
  '{{name}}', '{{member_id}}', '{{email}}', '{{password}}', '{{otp}}', '{{reset_link}}', '{{plan_name}}', '{{start_date}}', '{{end_date}}',
  '{{expiry_date}}', '{{days_left}}', '{{days}}', '{{amount}}', '{{payment_mode}}',
  '{{receipt_no}}', '{{holiday_date}}', '{{holiday_reason}}', '{{announcement_title}}',
  '{{announcement_content}}', '{{plan_type}}', '{{plan_title}}', '{{invoice_pdf_url}}',
  '{{freeze_start_date}}', '{{freeze_end_date}}', '{{freeze_days}}', '{{freeze_fee}}', '{{new_expiry_date}}', '{{end_mode}}'
];

export const EmailTemplatesSettings = () => {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [testing, setTesting] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('welcome');
  const [previewMode, setPreviewMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [attendanceConfirmationEmailEnabled, setAttendanceConfirmationEmailEnabled] = useState(true);
  const [savingAttendanceEmailToggle, setSavingAttendanceEmailToggle] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchTestDefaults();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll();
      const emailTemplates = response.data.filter(t => t.channel === 'email');
      const templatesMap = {};
      emailTemplates.forEach(t => {
        templatesMap[t.template_type] = t;
      });
      setTemplates(templatesMap);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchTestDefaults = async () => {
    try {
      const response = await settingsAPI.get();
      if (response.data?.admin_test_email) {
        setTestEmail(response.data.admin_test_email);
      }
      setAttendanceConfirmationEmailEnabled(
        response.data?.attendance_confirmation_email_enabled !== false
      );
    } catch (error) {
      // non-blocking
    }
  };

  const handleAttendanceEmailToggleChange = async (checked) => {
    const prev = attendanceConfirmationEmailEnabled;
    setAttendanceConfirmationEmailEnabled(checked);
    setSavingAttendanceEmailToggle(true);
    try {
      await settingsAPI.updateAttendanceConfirmationEmailToggle(checked);
      toast.success(`Attendance confirmation email ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      setAttendanceConfirmationEmailEnabled(prev);
      toast.error(error.response?.data?.detail || 'Failed to update attendance confirmation email setting');
    } finally {
      setSavingAttendanceEmailToggle(false);
    }
  };

  const handleSave = async (templateType) => {
    const template = templates[templateType];
    if (!template) return;

    setSaving({ ...saving, [templateType]: true });
    try {
      await templatesAPI.update({
        template_type: templateType,
        channel: 'email',
        subject: template.subject || '',
        content: template.content || ''
      });
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSaving({ ...saving, [templateType]: false });
    }
  };

  const handleReset = async (templateType) => {
    if (!window.confirm('Reset this template to default? This cannot be undone.')) return;
    
    try {
      await templatesAPI.reset(templateType, 'email');
      toast.success('Template reset to default');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to reset template');
    }
  };

  const updateTemplate = (templateType, field, value) => {
    setTemplates({
      ...templates,
      [templateType]: {
        ...templates[templateType],
        [field]: value
      }
    });
  };

  const handleTestSend = async () => {
    if (!testEmail) {
      toast.error('Enter test email');
      return;
    }
    setTesting(true);
    try {
      await templatesAPI.testSend({
        template_type: activeTemplate,
        channel: 'email',
        recipient: testEmail,
        subject: activeTemplateData.subject || '',
        content: activeTemplateData.content || ''
      });
      toast.success('Test email sent');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const activeTemplateData = templates[activeTemplate] || { subject: '', content: '' };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="email-templates-settings">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Email Templates
          </h1>
          <p className="text-muted-foreground">Customize automated email notifications sent to members</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Template List */}
          <Card className="glass-card lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {EMAIL_TEMPLATE_TYPES.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => setActiveTemplate(item.type)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      activeTemplate === item.type 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Template Editor */}
          <Card className="glass-card lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="text-primary" size={20} />
                    {EMAIL_TEMPLATE_TYPES.find(t => t.type === activeTemplate)?.label}
                  </CardTitle>
                  <CardDescription>
                    {EMAIL_TEMPLATE_TYPES.find(t => t.type === activeTemplate)?.description}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />}
                  {previewMode ? 'Edit' : 'Preview'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeTemplate === 'attendance' && (
                <div className="rounded-lg border border-border p-4 bg-muted/20">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">Attendance Confirmation Email</p>
                      <p className="text-xs text-muted-foreground">
                        Turn off to stop attendance-marked emails. Template stays saved.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${attendanceConfirmationEmailEnabled ? 'text-green-500' : 'text-zinc-500'}`}>
                        {attendanceConfirmationEmailEnabled ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={attendanceConfirmationEmailEnabled}
                        onCheckedChange={handleAttendanceEmailToggleChange}
                        disabled={savingAttendanceEmailToggle}
                      />
                    </div>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-10 bg-muted rounded" />
                  <div className="h-40 bg-muted rounded" />
                </div>
              ) : previewMode ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted p-2 text-sm text-muted-foreground">
                    Subject: {activeTemplateData.subject || 'No subject'}
                  </div>
                  <div 
                    className="p-4 bg-white text-black min-h-[300px]"
                    dangerouslySetInnerHTML={{ __html: activeTemplateData.content || '<p>No content</p>' }}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject Line</Label>
                    <Input
                      className="mt-2 bg-muted/50 border-border"
                      placeholder="Enter email subject"
                      value={activeTemplateData.subject || ''}
                      onChange={(e) => updateTemplate(activeTemplate, 'subject', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email Body (HTML)</Label>
                    <Textarea
                      className="mt-2 min-h-[300px] font-mono text-sm bg-muted/50 border-border"
                      placeholder="Enter HTML content..."
                      value={activeTemplateData.content || ''}
                      onChange={(e) => updateTemplate(activeTemplate, 'content', e.target.value)}
                    />
                  </div>

                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <Info size={16} className="text-primary mt-0.5" />
                      <span className="text-sm font-medium text-primary">Available Variables</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_VARIABLES.map((v) => (
                        <code 
                          key={v} 
                          className="px-2 py-1 bg-background rounded text-xs cursor-pointer hover:bg-accent"
                          onClick={() => {
                            navigator.clipboard.writeText(v);
                            toast.success(`Copied ${v}`);
                          }}
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      className="btn-primary"
                      onClick={() => handleSave(activeTemplate)}
                      disabled={saving[activeTemplate]}
                    >
                      <Save size={16} className="mr-2" />
                      {saving[activeTemplate] ? 'Saving...' : 'Save Template'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReset(activeTemplate)}
                    >
                      <RotateCcw size={16} className="mr-2" />
                      Reset to Default
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Send Test Email For This Template</Label>
                    <div className="mt-2 flex gap-3">
                      <Input
                        className="bg-muted/50 border-border"
                        placeholder="test@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                      <Button variant="outline" onClick={handleTestSend} disabled={testing}>
                        <Send size={16} className="mr-2" />
                        {testing ? 'Sending...' : 'Send Test'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmailTemplatesSettings;
