import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { templatesAPI } from '../../lib/api';
import { MessageSquare, Save, RotateCcw, Info, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const WHATSAPP_TEMPLATE_TYPES = [
  { type: 'welcome', label: 'Welcome Message', description: 'Sent when a new member joins' },
  { type: 'attendance', label: 'Attendance Confirmation', description: 'Sent when attendance is marked' },
  { type: 'membership_activated', label: 'Membership Activated', description: 'Sent when membership is activated' },
  { type: 'payment_received', label: 'Payment Receipt', description: 'Sent after payment is received' },
  { type: 'renewal_reminder', label: 'Renewal Reminder', description: 'Sent before membership expires' },
  { type: 'birthday', label: 'Birthday Wishes', description: 'Sent on member\'s birthday' },
  { type: 'absent_warning', label: 'Absence Warning', description: 'Sent when member is absent for days' },
  { type: 'holiday', label: 'Holiday Notice', description: 'Sent to announce gym holidays' },
  { type: 'announcement', label: 'Announcement', description: 'Sent for general announcements' },
  { type: 'plan_shared', label: 'Plan Shared', description: 'Sent when trainer shares a plan' }
];

const AVAILABLE_VARIABLES = [
  '{{name}}', '{{member_id}}', '{{plan_name}}', '{{start_date}}', '{{end_date}}',
  '{{expiry_date}}', '{{days_left}}', '{{days}}', '{{amount}}', '{{payment_mode}}',
  '{{receipt_no}}', '{{holiday_date}}', '{{holiday_reason}}', '{{announcement_title}}',
  '{{announcement_content}}', '{{plan_type}}', '{{plan_title}}'
];

export const WhatsAppTemplatesSettings = () => {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [activeTemplate, setActiveTemplate] = useState('welcome');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll();
      const whatsappTemplates = response.data.filter(t => t.channel === 'whatsapp');
      const templatesMap = {};
      whatsappTemplates.forEach(t => {
        templatesMap[t.template_type] = t;
      });
      setTemplates(templatesMap);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (templateType) => {
    const template = templates[templateType];
    if (!template) return;

    setSaving({ ...saving, [templateType]: true });
    try {
      await templatesAPI.update({
        template_type: templateType,
        channel: 'whatsapp',
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
      await templatesAPI.reset(templateType, 'whatsapp');
      toast.success('Template reset to default');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to reset template');
    }
  };

  const updateTemplate = (templateType, value) => {
    setTemplates({
      ...templates,
      [templateType]: {
        ...templates[templateType],
        content: value
      }
    });
  };

  const activeTemplateData = templates[activeTemplate] || { content: '' };
  
  // Preview with sample data
  const getPreviewContent = (content) => {
    return (content || '')
      .replace(/\{\{name\}\}/g, 'Rahul Sharma')
      .replace(/\{\{member_id\}\}/g, 'F3-0042')
      .replace(/\{\{plan_name\}\}/g, 'Quarterly')
      .replace(/\{\{start_date\}\}/g, '01 Jan 2025')
      .replace(/\{\{end_date\}\}/g, '31 Mar 2025')
      .replace(/\{\{expiry_date\}\}/g, '31 Mar 2025')
      .replace(/\{\{days_left\}\}/g, '45')
      .replace(/\{\{days\}\}/g, '7')
      .replace(/\{\{amount\}\}/g, '2,500')
      .replace(/\{\{payment_mode\}\}/g, 'UPI')
      .replace(/\{\{receipt_no\}\}/g, 'RCP-2025-001')
      .replace(/\{\{holiday_date\}\}/g, '26 Jan 2025')
      .replace(/\{\{holiday_reason\}\}/g, 'Republic Day')
      .replace(/\{\{announcement_title\}\}/g, 'New Equipment Arrived!')
      .replace(/\{\{announcement_content\}\}/g, 'Check out our new treadmills and weight machines.')
      .replace(/\{\{plan_type\}\}/g, 'Diet')
      .replace(/\{\{plan_title\}\}/g, 'Weight Loss Plan');
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="whatsapp-templates-settings">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            WhatsApp Templates
          </h1>
          <p className="text-muted-foreground">Customize automated WhatsApp messages sent to members</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Template List */}
          <Card className="glass-card lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {WHATSAPP_TEMPLATE_TYPES.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => setActiveTemplate(item.type)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      activeTemplate === item.type 
                        ? 'bg-green-500/10 text-green-500 border-l-2 border-green-500' 
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
                    <MessageSquare className="text-green-500" size={20} />
                    {WHATSAPP_TEMPLATE_TYPES.find(t => t.type === activeTemplate)?.label}
                  </CardTitle>
                  <CardDescription>
                    {WHATSAPP_TEMPLATE_TYPES.find(t => t.type === activeTemplate)?.description}
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
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-40 bg-muted rounded" />
                </div>
              ) : previewMode ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-green-500/10 p-2 text-sm text-green-500 flex items-center gap-2">
                    <MessageSquare size={16} />
                    WhatsApp Message Preview
                  </div>
                  <div className="p-4 bg-card min-h-[200px]">
                    <div className="max-w-[300px] bg-green-500/10 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {getPreviewContent(activeTemplateData.content) || 'No content'}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message Content</Label>
                    <Textarea
                      className="mt-2 min-h-[200px] bg-muted/50 border-border"
                      placeholder={`Hi {{name}}!\n\nYour message content here...\n\n- F3 Fitness Gym`}
                      value={activeTemplateData.content || ''}
                      onChange={(e) => updateTemplate(activeTemplate, e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Characters: {(activeTemplateData.content || '').length} | Recommended: Keep under 1000 characters
                    </p>
                  </div>

                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <Info size={16} className="text-green-500 mt-0.5" />
                      <span className="text-sm font-medium text-green-500">Available Variables (Click to copy)</span>
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
                    <p className="text-xs text-green-400 mt-3">
                      These variables will be automatically replaced with member data when the message is sent.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      className="bg-green-600 hover:bg-green-500 text-white"
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppTemplatesSettings;
