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
            <p className="text-zinc-500">Manage membership plans</p>
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
            <DialogContent className="bg-card border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                  {editingPlan ? 'Edit Plan' : 'Add Plan'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Plan Name</Label>
                  <Input
                    data-testid="plan-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Duration (Days)</Label>
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
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Price (₹)</Label>
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
                  <Label className="text-zinc-400">Active</Label>
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
                  <div className="h-24 bg-zinc-800 rounded" />
                </CardContent>
              </Card>
            ))
          ) : (
            plans.map((plan) => (
              <Card key={plan.id} className={`glass-card ${!plan.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-zinc-500">{plan.duration_days} days</p>
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
                      className="flex-1 border-zinc-700 hover:bg-zinc-800"
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
            <p className="text-zinc-500">Manage gym announcements</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="add-announcement-btn">
                <Plus size={18} className="mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                  New Announcement
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Title</Label>
                  <Input
                    data-testid="announcement-title"
                    className="input-dark mt-2"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Content</Label>
                  <textarea
                    data-testid="announcement-content"
                    className="input-dark mt-2 w-full min-h-[100px] p-3 rounded-md bg-zinc-900/50 border border-zinc-800"
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
                  <div className="h-16 bg-zinc-800 rounded" />
                </CardContent>
              </Card>
            ))
          ) : announcements.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-zinc-500">
                No announcements yet
              </CardContent>
            </Card>
          ) : (
            announcements.map((ann) => (
              <Card key={ann.id} className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-lg">{ann.title}</h3>
                      <p className="text-zinc-400 mt-1">{ann.content}</p>
                      <p className="text-xs text-zinc-600 mt-2">{formatDate(ann.created_at)}</p>
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
            <p className="text-zinc-500">Manage gym holidays</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="add-holiday-btn">
                <Plus size={18} className="mr-2" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                  Add Holiday
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Date</Label>
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
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Holiday Name</Label>
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
                  <div key={i} className="h-12 bg-zinc-800 rounded" />
                ))}
              </div>
            </CardContent>
          ) : holidays.length === 0 ? (
            <CardContent className="p-8 text-center text-zinc-500">
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
                      <p className="font-medium text-white">{holiday.name}</p>
                      <p className="text-sm text-zinc-500">{formatDate(holiday.holiday_date)}</p>
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
    sender_email: ''
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
          sender_email: response.data.sender_email || ''
        });
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
          <div className="h-8 w-48 bg-zinc-800 rounded mb-6" />
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-zinc-800 rounded" />
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
          <p className="text-zinc-500">Configure email notifications</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">SMTP Host</Label>
                  <Input
                    data-testid="smtp-host"
                    className="input-dark mt-2"
                    placeholder="smtp.gmail.com"
                    value={formData.smtp_host}
                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">SMTP Port</Label>
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
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Username</Label>
                  <Input
                    data-testid="smtp-user"
                    className="input-dark mt-2"
                    placeholder="your@email.com"
                    value={formData.smtp_user}
                    onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Password</Label>
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
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Sender Email</Label>
                  <Input
                    data-testid="smtp-sender"
                    type="email"
                    className="input-dark mt-2"
                    placeholder="noreply@gym.com"
                    value={formData.sender_email}
                    onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    data-testid="smtp-secure"
                    checked={formData.smtp_secure}
                    onCheckedChange={(checked) => setFormData({ ...formData, smtp_secure: checked })}
                  />
                  <Label className="text-zinc-400">Use TLS/SSL</Label>
                </div>
              </div>

              <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-smtp-btn">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>

            {/* Test Email */}
            <div className="mt-8 pt-6 border-t border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Test Email</h3>
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [formData, setFormData] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_whatsapp_number: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.get();
      if (response.data) {
        setFormData({
          twilio_account_sid: response.data.twilio_account_sid || '',
          twilio_auth_token: '',
          twilio_whatsapp_number: response.data.twilio_whatsapp_number || ''
        });
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
      toast.error('Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800 rounded mb-6" />
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-zinc-800 rounded" />
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
          <p className="text-zinc-500">Configure Twilio WhatsApp notifications</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Twilio Account SID</Label>
                <Input
                  data-testid="twilio-sid"
                  className="input-dark mt-2"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={formData.twilio_account_sid}
                  onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Twilio Auth Token</Label>
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
                <Label className="text-xs uppercase tracking-wider text-zinc-500">WhatsApp Number (with country code)</Label>
                <Input
                  data-testid="twilio-number"
                  className="input-dark mt-2"
                  placeholder="+14155238886"
                  value={formData.twilio_whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, twilio_whatsapp_number: e.target.value })}
                />
              </div>

              <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-whatsapp-btn">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>

            {/* Test Message */}
            <div className="mt-8 pt-6 border-t border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Test WhatsApp</h3>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PlansSettings;
