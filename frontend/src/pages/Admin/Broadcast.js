import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { broadcastAPI, usersAPI } from '../../lib/api';
import { MessageSquare, Send, Users, UserCheck, UserX, Info, Search, Ban, Clock, Snowflake, CalendarClock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export const WhatsAppBroadcast = () => {
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [previewSearch, setPreviewSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const res = await usersAPI.getAllWithMembership({ role: 'member' });
      setMembers(res.data || []);
    } catch (error) {
      toast.error('Failed to load members preview');
    } finally {
      setMembersLoading(false);
    }
  };

  const getTodayStart = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const parseDateOnly = (value) => {
    if (!value) return null;
    const raw = String(value).slice(0, 10);
    const [y, m, d] = raw.split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const getCurrentFreezeInfo = (membership) => {
    if (!membership) return null;
    const today = getTodayStart();
    const freezes = Array.isArray(membership.freeze_history) ? membership.freeze_history : [];
    for (const freeze of freezes) {
      const start = parseDateOnly(freeze?.freeze_start_date);
      const end = parseDateOnly(freeze?.freeze_end_date);
      if (start && end && today >= start && today <= end) {
        const remainingDays = Math.floor((end - today) / (1000 * 60 * 60 * 24)) + 1;
        return { ...freeze, remainingDays };
      }
    }
    return null;
  };

  const getMembershipDaysLeft = (membership) => {
    if (!membership?.end_date) return null;
    const today = getTodayStart();
    const endDate = parseDateOnly(membership.end_date);
    if (!endDate) return null;
    return Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  };

  const matchesAudience = (member) => {
    const membership = member.active_membership;
    const isFrozen = !!getCurrentFreezeInfo(membership);
    const daysLeft = getMembershipDaysLeft(membership);
    if (targetAudience === 'all') return true;
    if (targetAudience === 'disabled') return !!member.is_disabled;
    if (member.is_disabled) return false;
    switch (targetAudience) {
      case 'active':
        return !!membership && !isFrozen && typeof daysLeft === 'number' && daysLeft > 6;
      case 'inactive':
        return !membership;
      case 'expired':
        return !!membership && !isFrozen && typeof daysLeft === 'number' && daysLeft < 0;
      case 'expiring_soon':
        return !!membership && !isFrozen && typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 6;
      case 'frozen':
        return !!membership && isFrozen;
      default:
        return true;
    }
  };

  const audienceMembers = useMemo(() => {
    return members.filter(matchesAudience);
  }, [members, targetAudience]);

  const previewMembers = useMemo(() => {
    const term = previewSearch.trim().toLowerCase();
    return audienceMembers.filter((m) => {
      if (!term) return true;
      return [m.name, m.member_id, m.phone_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [audienceMembers, previewSearch]);

  useEffect(() => {
    setSelectedIds(audienceMembers.map((m) => m.id));
  }, [audienceMembers]);

  const selectedMembers = useMemo(() => {
    const idSet = new Set(selectedIds);
    return audienceMembers.filter((m) => idSet.has(m.id));
  }, [audienceMembers, selectedIds]);

  const toggleSelectMember = (userId) => {
    setSelectedIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const selectAllFiltered = () => setSelectedIds(audienceMembers.map((m) => m.id));
  const clearAllFiltered = () => setSelectedIds([]);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setLoading(true);
    try {
      const response = await broadcastAPI.sendWhatsApp({
        message,
        target_audience: targetAudience,
        selected_user_ids: selectedIds
      });
      toast.success(response.data.message);
      setMessage('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  const audienceOptions = [
    { key: 'all', label: 'All Members', icon: Users },
    { key: 'active', label: 'Active', icon: UserCheck },
    { key: 'inactive', label: 'No Plan', icon: UserX },
    { key: 'expiring_soon', label: 'About to Expire (6d)', icon: CalendarClock },
    { key: 'expired', label: 'Expired', icon: Clock },
    { key: 'frozen', label: 'Frozen', icon: Snowflake },
    { key: 'disabled', label: 'Disabled', icon: Ban }
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="whatsapp-broadcast">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            WhatsApp Broadcast
          </h1>
          <p className="text-muted-foreground">Send a message to members via WhatsApp with audience filters and live recipient preview</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,420px)] gap-6 items-start">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="text-green-500" size={20} />
                Compose Message
              </CardTitle>
              <CardDescription>
                Use {"{{name}}"}, {"{{member_id}}"}, {"{{email}}"}, {"{{plan_name}}"}, {"{{start_date}}"}, {"{{end_date}}"}, {"{{expiry_date}}"}, {"{{days_left}}"} and {"{{days}}"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target Audience</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {audienceOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = targetAudience === opt.key;
                    return (
                      <Button
                        key={opt.key}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setTargetAudience(opt.key)}
                        className={active ? 'bg-primary' : ''}
                      >
                        <Icon size={16} className="mr-2" />
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message</Label>
                <Textarea
                  className="mt-2 min-h-[220px] bg-muted/50 border-border"
                  placeholder={`Hi {{name}}!\n\nWe have exciting news to share with you...\n\nSee you at the gym!\n- F3 Fitness Team`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-testid="whatsapp-message-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Characters: {message.length} | Recommended: Keep under 1000 characters
                </p>
              </div>

              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                <Info size={18} className="text-green-500 mt-0.5" />
                <div className="text-sm text-green-400">
                  <strong>Note:</strong> Messages will be sent via your configured WhatsApp provider. If using Twilio sandbox, recipients must opt in first.
                </div>
              </div>

              <Button
                className="btn-primary w-full"
                onClick={handleSend}
                disabled={loading || !message.trim() || selectedIds.length === 0}
                data-testid="send-whatsapp-btn"
              >
                {loading ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    Send WhatsApp Broadcast ({selectedIds.length})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Users size={18} className="text-cyan-400" />
                  Live Preview
                </span>
                <span className="text-sm text-muted-foreground">{selectedIds.length}/{audienceMembers.length}</span>
              </CardTitle>
              <CardDescription>
                Review recipients and manually select/deselect before sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  className="pl-9 bg-muted/50 border-border"
                  placeholder="Search in preview..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered} disabled={membersLoading || audienceMembers.length === 0}>
                  Select All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAllFiltered} disabled={selectedIds.length === 0}>
                  Clear All
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={fetchMembers} disabled={membersLoading} className="ml-auto">
                  {membersLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Filtered Members</p>
                  <p className="text-xl font-bold text-foreground mt-1">{audienceMembers.length}</p>
                </div>
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Selected Numbers</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">{selectedMembers.filter(m => !!m.phone_number).length}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview showing {previewMembers.length} of {audienceMembers.length} recipients
              </p>

              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {membersLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading members...</div>
                ) : previewMembers.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <XCircle size={16} />
                    No members match this filter
                  </div>
                ) : (
                  previewMembers.map((member) => {
                    const checked = selectedIds.includes(member.id);
                    const phoneDisplay = [member.country_code || '+91', member.phone_number || ''].join(member.phone_number ? '' : '').trim();
                    return (
                      <label
                        key={member.id}
                        className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${checked ? 'bg-cyan-500/5' : 'hover:bg-muted/30'}`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleSelectMember(member.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm text-foreground truncate">{member.name || 'Member'}</p>
                            <span className="text-xs font-mono text-cyan-400 shrink-0">{member.member_id || '-'}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{phoneDisplay || 'No phone number'}</p>
                          {member.active_membership?.plan_name ? (
                            <p className="text-xs text-muted-foreground truncate">
                              {member.active_membership.plan_name} • Ends {String(member.active_membership.end_date || '').slice(0, 10)}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No active plan</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const EmailBroadcast = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const response = await broadcastAPI.sendEmail({
        message,
        target_audience: targetAudience,
        subject
      });
      toast.success(response.data.message);
      setSubject('');
      setMessage('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in max-w-3xl" data-testid="email-broadcast">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Email Broadcast
          </h1>
          <p className="text-muted-foreground">Send a professional email to all members</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="text-primary" size={20} />
              Compose Email
            </CardTitle>
            <CardDescription>
              Use {"{{name}}"} and {"{{member_id}}"} to personalize emails. Emails are sent with a professional light-themed template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target Audience</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={targetAudience === 'all' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('all')}
                  className={targetAudience === 'all' ? 'bg-primary' : ''}
                >
                  <Users size={16} className="mr-2" />
                  All Members
                </Button>
                <Button
                  type="button"
                  variant={targetAudience === 'active' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('active')}
                  className={targetAudience === 'active' ? 'bg-primary' : ''}
                >
                  <UserCheck size={16} className="mr-2" />
                  Active Only
                </Button>
                <Button
                  type="button"
                  variant={targetAudience === 'inactive' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('inactive')}
                  className={targetAudience === 'inactive' ? 'bg-primary' : ''}
                >
                  <UserX size={16} className="mr-2" />
                  Inactive Only
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email Subject</Label>
              <Input
                className="mt-2 bg-muted/50 border-border"
                placeholder="e.g., Special Offer for F3 Fitness Members!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="email-subject-input"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message Body</Label>
              <Textarea
                className="mt-2 min-h-[200px] bg-muted/50 border-border"
                placeholder={`We have some exciting news to share with you!\n\nAs a valued member, you get exclusive access to...\n\nDon't miss out on this limited-time offer!\n\nSee you at the gym!`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                data-testid="email-message-input"
              />
            </div>

            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex items-start gap-3">
              <Info size={18} className="text-primary mt-0.5" />
              <div className="text-sm text-primary">
                <strong>Note:</strong> Emails will be sent using your configured SMTP settings with a professional 
                white/light themed template. Make sure SMTP is configured in Settings.
              </div>
            </div>

            <Button 
              className="btn-primary w-full" 
              onClick={handleSend} 
              disabled={loading || !message.trim() || !subject.trim()}
              data-testid="send-email-btn"
            >
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Send size={18} className="mr-2" />
                  Send Email Broadcast
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppBroadcast;
