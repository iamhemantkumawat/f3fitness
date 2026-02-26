import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { plansAPI, announcementsAPI, holidaysAPI, settingsAPI } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { 
  Plus, Edit, Trash2, CreditCard, Bell, Calendar, Mail, MessageSquare, Send
} from 'lucide-react';
import { toast } from 'sonner';

export const PlansSettings = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    duration_days: '',
    price: '',
    is_active: true
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await plansAPI.getAll();
      setPlans(response.data);
    } catch (error) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        duration_days: parseInt(formData.duration_days),
        price: parseFloat(formData.price)
      };
      if (editingPlan) {
        await plansAPI.update(editingPlan.id, data);
        toast.success('Plan updated');
      } else {
        await plansAPI.create(data);
        toast.success('Plan created');
      }
      setIsDialogOpen(false);
      setEditingPlan(null);
      setFormData({ name: '', duration_days: '', price: '', is_active: true });
      fetchPlans();
    } catch (error) {
      toast.error('Failed to save plan');
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      duration_days: plan.duration_days.toString(),
      price: plan.price.toString(),
      is_active: plan.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await plansAPI.delete(id);
      toast.success('Plan deleted');
      fetchPlans();
    } catch (error) {
      toast.error('Failed to delete plan');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="plans-settings">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Plans
            </h1>
            <p className="text-muted-foreground">Manage membership plans</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="btn-primary"
                onClick={() => {
                  setEditingPlan(null);
                  setFormData({ name: '', duration_days: '', price: '', is_active: true });
                }}
                data-testid="add-plan-btn"
              >
                <Plus size={18} className="mr-2" />
                Add Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                  {editingPlan ? 'Edit Plan' : 'Add Plan'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Plan Name</Label>
                  <Input
                    data-testid="plan-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration (Days)</Label>
                  <Input
                    data-testid="plan-duration"
                    type="number"
                    className="input-dark mt-2"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Price (₹)</Label>
                  <Input
                    data-testid="plan-price"
                    type="number"
                    className="input-dark mt-2"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    data-testid="plan-active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label className="text-muted-foreground">Active</Label>
                </div>
                <DialogFooter>
                  <Button type="submit" className="btn-primary" data-testid="save-plan-btn">
                    {editingPlan ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="glass-card animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : (
            plans.map((plan) => (
              <Card key={plan.id} className={`glass-card ${!plan.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                      <p className="text-muted-foreground">{plan.duration_days} days</p>
                    </div>
                    <span className={plan.is_active ? 'badge-active' : 'badge-expired'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-cyan-400 mb-4">{formatCurrency(plan.price)}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-zinc-700 hover:bg-muted"
                      onClick={() => handleEdit(plan)}
                      data-testid={`edit-plan-${plan.id}`}
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleDelete(plan.id)}
                      data-testid={`delete-plan-${plan.id}`}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const AnnouncementsSettings = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '' });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await announcementsAPI.getAll();
      setAnnouncements(response.data);
    } catch (error) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await announcementsAPI.create(formData);
      toast.success('Announcement created');
      setIsDialogOpen(false);
      setFormData({ title: '', content: '' });
      fetchAnnouncements();
    } catch (error) {
      toast.error('Failed to create announcement');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await announcementsAPI.delete(id);
      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="announcements-settings">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Announcements
            </h1>
            <p className="text-muted-foreground">Manage gym announcements</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="add-announcement-btn">
                <Plus size={18} className="mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                  New Announcement
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
                  <Input
                    data-testid="announcement-title"
                    className="input-dark mt-2"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Content</Label>
                  <textarea
                    data-testid="announcement-content"
                    className="input-dark mt-2 w-full min-h-[100px] p-3 rounded-md bg-muted/50 border border-border"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="btn-primary" data-testid="save-announcement-btn">
                    Publish
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="glass-card animate-pulse">
                <CardContent className="p-6">
                  <div className="h-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : announcements.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                No announcements yet
              </CardContent>
            </Card>
          ) : (
            announcements.map((ann) => (
              <Card key={ann.id} className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-lg">{ann.title}</h3>
                      <p className="text-muted-foreground mt-1">{ann.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDate(ann.created_at)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(ann.id)}
                      data-testid={`delete-announcement-${ann.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const HolidaysSettings = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ holiday_date: '', name: '' });

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const response = await holidaysAPI.getAll();
      setHolidays(response.data);
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await holidaysAPI.create(formData);
      toast.success('Holiday added');
      setIsDialogOpen(false);
      setFormData({ holiday_date: '', name: '' });
      fetchHolidays();
    } catch (error) {
      toast.error('Failed to add holiday');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await holidaysAPI.delete(id);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="holidays-settings">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Holidays
            </h1>
            <p className="text-muted-foreground">Manage gym holidays</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="add-holiday-btn">
                <Plus size={18} className="mr-2" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                  Add Holiday
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input
                    data-testid="holiday-date"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.holiday_date}
                    onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Holiday Name</Label>
                  <Input
                    data-testid="holiday-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="btn-primary" data-testid="save-holiday-btn">
                    Add
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glass-card">
          {loading ? (
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          ) : holidays.length === 0 ? (
            <CardContent className="p-8 text-center text-muted-foreground">
              No holidays added
            </CardContent>
          ) : (
            <div className="divide-y divide-zinc-800">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Calendar size={20} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(holiday.holiday_date)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(holiday.id)}
                    data-testid={`delete-holiday-${holiday.id}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export const SMTPSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: true,
    sender_email: '',
    admin_test_email: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.get();
      if (response.data) {
        setFormData({
          smtp_host: response.data.smtp_host || '',
          smtp_port: response.data.smtp_port || 587,
          smtp_user: response.data.smtp_user || '',
          smtp_pass: '',
          smtp_secure: response.data.smtp_secure ?? true,
          sender_email: response.data.sender_email || '',
          admin_test_email: response.data.admin_test_email || ''
        });
        setTestEmail(response.data.admin_test_email || '');
      }
    } catch (error) {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.updateSMTP(formData);
      toast.success('SMTP settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Enter test email address');
      return;
    }
    setTesting(true);
    try {
      await settingsAPI.testSMTP(testEmail);
      toast.success('Test email sent successfully');
    } catch (error) {
      toast.error('Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-6" />
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-2xl space-y-6 animate-fade-in" data-testid="smtp-settings">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            SMTP Settings
          </h1>
          <p className="text-muted-foreground">Configure email notifications</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">SMTP Host</Label>
                  <Input
                    data-testid="smtp-host"
                    className="input-dark mt-2"
                    placeholder="smtp.gmail.com"
                    value={formData.smtp_host}
                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">SMTP Port</Label>
                  <Input
                    data-testid="smtp-port"
                    type="number"
                    className="input-dark mt-2"
                    placeholder="587"
                    value={formData.smtp_port}
                    onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Username</Label>
                  <Input
                    data-testid="smtp-user"
                    className="input-dark mt-2"
                    placeholder="your@email.com"
                    value={formData.smtp_user}
                    onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                  <Input
                    data-testid="smtp-pass"
                    type="password"
                    className="input-dark mt-2"
                    placeholder="••••••••"
                    value={formData.smtp_pass}
                    onChange={(e) => setFormData({ ...formData, smtp_pass: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sender Email</Label>
                  <Input
                    data-testid="smtp-sender"
                    type="email"
                    className="input-dark mt-2"
                    placeholder="noreply@gym.com"
                    value={formData.sender_email}
                    onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Admin Test Email</Label>
                  <Input
                    type="email"
                    className="input-dark mt-2"
                    placeholder="admin@example.com"
                    value={formData.admin_test_email}
                    onChange={(e) => {
                      setFormData({ ...formData, admin_test_email: e.target.value });
                      setTestEmail(e.target.value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used as default in SMTP and Email Template test send.</p>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    data-testid="smtp-secure"
                    checked={formData.smtp_secure}
                    onCheckedChange={(checked) => setFormData({ ...formData, smtp_secure: checked })}
                  />
                  <Label className="text-muted-foreground">Use TLS/SSL</Label>
                </div>
              </div>

              <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-smtp-btn">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>

            {/* Test Email */}
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Test Email</h3>
              <div className="flex gap-3">
                <Input
                  data-testid="test-email"
                  type="email"
                  className="input-dark"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button className="btn-secondary" onClick={handleTestEmail} disabled={testing} data-testid="send-test-btn">
                  <Send size={16} className="mr-2" />
                  {testing ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export const WhatsAppSettings = () => {
  const FAST2SMS_TEMPLATE_DEFAULTS = {
    otp: '13503',
    password_reset: '13754',
    welcome: '13750',
    membership_activated: '13752',
    payment_received: '13753',
    invoice_sent: '13755'
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [testNumber, setTestNumber] = useState('+91');
  const [fast2smsTemplates, setFast2smsTemplates] = useState(null);
  const [formData, setFormData] = useState({
    whatsapp_provider: 'twilio',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_whatsapp_number: '',
    use_sandbox: true,
    sandbox_url: '',
    fast2sms_api_key: '',
    fast2sms_base_url: 'https://www.fast2sms.com',
    fast2sms_waba_number: '',
    fast2sms_phone_number_id: '',
    fast2sms_use_template_api: false,
    fast2sms_template_otp_message_id: '13503',
    fast2sms_template_password_reset_message_id: '13754',
    fast2sms_template_welcome_message_id: '13750',
    fast2sms_template_membership_activated_message_id: '13752',
    fast2sms_template_payment_received_message_id: '13753',
    fast2sms_template_invoice_sent_message_id: '13755',
    admin_whatsapp_test_numbers: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.get();
      if (response.data) {
        setFormData({
          whatsapp_provider: response.data.whatsapp_provider || 'twilio',
          twilio_account_sid: response.data.twilio_account_sid || '',
          twilio_auth_token: '',
          twilio_whatsapp_number: response.data.twilio_whatsapp_number || '',
          use_sandbox: response.data.use_sandbox ?? true,
          sandbox_url: response.data.sandbox_url || '',
          fast2sms_api_key: '',
          fast2sms_base_url: response.data.fast2sms_base_url || 'https://www.fast2sms.com',
          fast2sms_waba_number: response.data.fast2sms_waba_number || '',
          fast2sms_phone_number_id: response.data.fast2sms_phone_number_id || '',
          fast2sms_use_template_api: response.data.fast2sms_use_template_api ?? false,
          fast2sms_template_otp_message_id: response.data.fast2sms_template_otp_message_id || FAST2SMS_TEMPLATE_DEFAULTS.otp,
          fast2sms_template_password_reset_message_id: response.data.fast2sms_template_password_reset_message_id || FAST2SMS_TEMPLATE_DEFAULTS.password_reset,
          fast2sms_template_welcome_message_id: response.data.fast2sms_template_welcome_message_id || FAST2SMS_TEMPLATE_DEFAULTS.welcome,
          fast2sms_template_membership_activated_message_id: response.data.fast2sms_template_membership_activated_message_id || FAST2SMS_TEMPLATE_DEFAULTS.membership_activated,
          fast2sms_template_payment_received_message_id: response.data.fast2sms_template_payment_received_message_id || FAST2SMS_TEMPLATE_DEFAULTS.payment_received,
          fast2sms_template_invoice_sent_message_id: response.data.fast2sms_template_invoice_sent_message_id || FAST2SMS_TEMPLATE_DEFAULTS.invoice_sent,
          admin_whatsapp_test_numbers: response.data.admin_whatsapp_test_numbers || ''
        });
        setTestNumber((response.data.admin_whatsapp_test_numbers || '').split(',').map(s => s.trim()).find(Boolean) || '+91');
      }
    } catch (error) {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.updateWhatsApp(formData);
      toast.success('WhatsApp settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testNumber) {
      toast.error('Enter test phone number');
      return;
    }
    setTesting(true);
    try {
      await settingsAPI.testWhatsApp(testNumber);
      toast.success('Test message sent successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  const handleFetchFast2SMSTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await settingsAPI.getFast2SMSWabaTemplates();
      setFast2smsTemplates(res.data?.data ?? res.data);
      toast.success('Fetched Fast2SMS WABA templates');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch Fast2SMS templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-6" />
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-2xl space-y-6 animate-fade-in" data-testid="whatsapp-settings">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            WhatsApp Settings
          </h1>
          <p className="text-muted-foreground">Configure WhatsApp notifications (Twilio or Fast2SMS)</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Default WhatsApp Provider</Label>
                <select
                  className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.whatsapp_provider}
                  onChange={(e) => setFormData({ ...formData, whatsapp_provider: e.target.value })}
                >
                  <option value="twilio">Twilio</option>
                  <option value="fast2sms">Fast2SMS</option>
                </select>
              </div>

              {formData.whatsapp_provider === 'twilio' && (
                <>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Twilio Account SID</Label>
                <Input
                  data-testid="twilio-sid"
                  className="input-dark mt-2"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={formData.twilio_account_sid}
                  onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Twilio Auth Token</Label>
                <Input
                  data-testid="twilio-token"
                  type="password"
                  className="input-dark mt-2"
                  placeholder="••••••••"
                  value={formData.twilio_auth_token}
                  onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">WhatsApp Number (with country code)</Label>
                <Input
                  data-testid="twilio-number"
                  className="input-dark mt-2"
                  placeholder="+14155238886"
                  value={formData.twilio_whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, twilio_whatsapp_number: e.target.value })}
                />
              </div>
                </>
              )}

              {formData.whatsapp_provider === 'fast2sms' && (
                <>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fast2SMS API Key</Label>
                    <Input
                      type="password"
                      className="input-dark mt-2"
                      placeholder="Enter Fast2SMS API key"
                      value={formData.fast2sms_api_key}
                      onChange={(e) => setFormData({ ...formData, fast2sms_api_key: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank to keep existing saved API key.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fast2SMS Base URL</Label>
                    <Input
                      className="input-dark mt-2"
                      placeholder="https://www.fast2sms.com"
                      value={formData.fast2sms_base_url}
                      onChange={(e) => setFormData({ ...formData, fast2sms_base_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fast2SMS WABA Number (Optional)</Label>
                    <Input
                      className="input-dark mt-2"
                      placeholder="Business WhatsApp / sender number (if required)"
                      value={formData.fast2sms_waba_number}
                      onChange={(e) => setFormData({ ...formData, fast2sms_waba_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fast2SMS Phone Number ID (Recommended)</Label>
                    <Input
                      className="input-dark mt-2"
                      placeholder="e.g. 1018230858036408"
                      value={formData.fast2sms_phone_number_id}
                      onChange={(e) => setFormData({ ...formData, fast2sms_phone_number_id: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Copy this from the fetched Fast2SMS WABA template details (`phone_number_id`).
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="font-medium text-foreground">Use Template API (OTP / Password Reset / Welcome)</p>
                      <p className="text-xs text-muted-foreground">Required for sending WhatsApp outside the 24h customer reply window on Fast2SMS.</p>
                    </div>
                    <Switch
                      checked={formData.fast2sms_use_template_api}
                      onCheckedChange={(checked) => setFormData({ ...formData, fast2sms_use_template_api: checked })}
                    />
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold text-foreground">Fast2SMS Template Message IDs (Critical Flows)</h4>
                      <p className="text-xs text-muted-foreground">
                        Default IDs are prefilled. You can change them any time from here. Pending templates will start working after Fast2SMS marks them approved.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">OTP Template Message ID</Label>
                        <Input
                          className="input-dark mt-2"
                          placeholder="e.g. 13503"
                          value={formData.fast2sms_template_otp_message_id}
                          onChange={(e) => setFormData({ ...formData, fast2sms_template_otp_message_id: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">From your Fast2SMS Templates API export (`otp`).</p>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password Reset Template Message ID</Label>
                        <Input
                          className="input-dark mt-2"
                          placeholder="e.g. 13754 (password_forgot)"
                          value={formData.fast2sms_template_password_reset_message_id}
                          onChange={(e) => setFormData({ ...formData, fast2sms_template_password_reset_message_id: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Recommended variable count: 1 (reset code / temporary password).</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Welcome Template Message ID</Label>
                        <Input
                          className="input-dark mt-2"
                          placeholder="e.g. 13750 (welcome_massage1)"
                          value={formData.fast2sms_template_welcome_message_id}
                          onChange={(e) => setFormData({ ...formData, fast2sms_template_welcome_message_id: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Uses variables: `name | member_id` (your utility welcome template).</p>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Membership Activated Template Message ID</Label>
                        <Input
                          className="input-dark mt-2"
                          placeholder="e.g. 13752 (membership)"
                          value={formData.fast2sms_template_membership_activated_message_id}
                          onChange={(e) => setFormData({ ...formData, fast2sms_template_membership_activated_message_id: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Variables: `name | plan_name | start_date | end_date`.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment Receipt Template Message ID</Label>
                        <Input
                          className="input-dark mt-2"
                          placeholder="e.g. 13753 (payment_receipt)"
                          value={formData.fast2sms_template_payment_received_message_id}
                          onChange={(e) => setFormData({ ...formData, fast2sms_template_payment_received_message_id: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Variables: `name | receipt_no | amount | payment_mode`.</p>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice Sent Template Message ID</Label>
                        <Input
                          className="input-dark mt-2"
                          placeholder="e.g. 13755 (invoice_sent)"
                          value={formData.fast2sms_template_invoice_sent_message_id}
                          onChange={(e) => setFormData({ ...formData, fast2sms_template_invoice_sent_message_id: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Variables: `receipt_no | amount | payment_date | invoice_pdf_url`.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">Fast2SMS WABA Templates</h4>
                        <p className="text-xs text-muted-foreground">Fetch WABA & template details from Fast2SMS</p>
                      </div>
                      <Button type="button" className="btn-secondary" onClick={handleFetchFast2SMSTemplates} disabled={loadingTemplates}>
                        {loadingTemplates ? 'Fetching...' : 'Fetch Templates'}
                      </Button>
                    </div>
                    {fast2smsTemplates && (
                      <pre className="text-xs bg-muted/40 border border-border rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                        {JSON.stringify(fast2smsTemplates, null, 2)}
                      </pre>
                    )}
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Admin Test WhatsApp Numbers</Label>
                <Input
                  className="input-dark mt-2"
                  placeholder="+919999999999, +918888888888"
                  value={formData.admin_whatsapp_test_numbers}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, admin_whatsapp_test_numbers: value });
                    const first = value.split(',').map(s => s.trim()).find(Boolean);
                    if (first) setTestNumber(first);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated numbers. Used as default in WhatsApp tests and WhatsApp Template test send.</p>
              </div>

              <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-whatsapp-btn">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>

            {/* Test Message */}
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Test WhatsApp</h3>
              <div className="flex gap-3">
                <Input
                  data-testid="test-number"
                  className="input-dark"
                  placeholder="+919999999999"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                />
                <Button className="btn-secondary" onClick={handleTestMessage} disabled={testing} data-testid="send-test-whatsapp-btn">
                  <MessageSquare size={16} className="mr-2" />
                  {testing ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Test message uses the currently selected default provider: <strong>{formData.whatsapp_provider === 'fast2sms' ? 'Fast2SMS' : 'Twilio'}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PlansSettings;

// Activity Logs Settings Component
export const ActivityLogsSettings = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '' });

  const formatISTDateTime = (value) => {
    if (!value) return 'N/A';
    // Legacy activity logs were stored with IST clock but UTC offset (+00:00).
    // For those rows, render the timestamp "as written" to avoid +5:30 double shift.
    if (typeof value === 'string') {
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (m) {
        const [, y, mo, d, hh, mm, ss = '00'] = m;
        const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
        if (!Number.isNaN(dt.getTime())) {
          return dt.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
        }
      }
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      params.append('limit', '100');
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/activity-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6" data-testid="activity-logs-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Activity Logs
            </h1>
            <p className="text-muted-foreground">Monitor user activities</p>
          </div>
          <select
            className="input-dark w-48 h-10 px-3 rounded-md bg-muted/50 border border-border"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">All Actions</option>
            <option value="login">Logins</option>
            <option value="signup">Signups</option>
            <option value="payment">Payments</option>
          </select>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No activity logs found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Timestamp</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Action</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Description</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatISTDateTime(log.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm text-foreground">{log.user_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{log.user_email || log.user_id}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded capitalize ${
                            log.action === 'login' ? 'bg-green-500/20 text-green-400' :
                            log.action === 'signup' ? 'bg-cyan-500/20 text-cyan-400' :
                            log.action === 'payment' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{log.description}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground font-mono">{log.ip_address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

// Payment Gateway Settings Component
export const PaymentGatewaySettings = () => {
  const [settings, setSettings] = useState({ razorpay_key_id: '', razorpay_key_secret: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/payment-gateway`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSettings({
        razorpay_key_id: data.razorpay_key_id || '',
        razorpay_key_secret: ''
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!settings.razorpay_key_id) {
      toast.error('Please enter Razorpay Key ID');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/payment-gateway`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          razorpay_key_id: settings.razorpay_key_id,
          razorpay_key_secret: settings.razorpay_key_secret
        })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      toast.success('Payment gateway settings saved');
      setSettings({ ...settings, razorpay_key_secret: '' });
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6" data-testid="payment-gateway-page">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Payment Gateway Settings
          </h1>
          <p className="text-muted-foreground">Configure Razorpay integration</p>
        </div>

        <Card className="glass-card max-w-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard size={20} className="text-cyan-400" />
              Razorpay Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Razorpay Key ID</Label>
                  <Input
                    data-testid="razorpay-key-id"
                    type="text"
                    className="input-dark mt-2"
                    placeholder="rzp_live_xxxxxxxxxxxxx"
                    value={settings.razorpay_key_id}
                    onChange={(e) => setSettings({ ...settings, razorpay_key_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Razorpay Key Secret</Label>
                  <Input
                    data-testid="razorpay-key-secret"
                    type="password"
                    className="input-dark mt-2"
                    placeholder="Enter new secret to update"
                    value={settings.razorpay_key_secret}
                    onChange={(e) => setSettings({ ...settings, razorpay_key_secret: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to keep existing secret</p>
                </div>
                <Button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card max-w-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Getting Razorpay Credentials</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground text-sm">
              <li>Login to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Razorpay Dashboard</a></li>
              <li>Go to Settings &gt; API Keys</li>
              <li>Generate a new key pair (or use existing)</li>
              <li>Copy the Key ID and Key Secret</li>
              <li>For live mode, ensure your account is activated</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};
