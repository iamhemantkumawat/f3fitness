import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { tasksAPI } from '../../lib/api';
import { Phone, PhoneCall, RefreshCw, CheckCircle2, Clock3, CalendarDays, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

const TASK_CONFIG = {
  renewals: {
    title: 'Renewal Leads',
    subtitle: 'Members who need renewal follow-up calls',
    empty: 'No renewal leads right now',
    showRenewalFields: true
  },
  absent: {
    title: 'Absent Leads',
    subtitle: 'Members absent from gym who need a follow-up call',
    empty: 'No absent leads right now'
  },
  inactive: {
    title: 'Inactive Users',
    subtitle: 'Members without active plans for recall and reactivation',
    empty: 'No inactive users pending follow-up'
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(value).slice(0, 10);
  }
};

const getPhone = (item) => {
  if (!item?.phone_number) return '-';
  return `${item.country_code || '+91'}${item.phone_number}`;
};

const LeadTaskPage = ({ leadType }) => {
  const config = TASK_CONFIG[leadType];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ items: [], instruction: '' });
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    called_status: 'answered',
    remarks: '',
    recall_date: '',
    renewal_when: '',
    gym_visit_when: ''
  });

  const fetchLeads = async (silent = false) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      const res = await tasksAPI.getLeads(leadType);
      setData(res.data || { items: [], instruction: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [leadType]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data.items || []).filter((item) => {
      if (!term) return true;
      return [item.name, item.member_id, item.phone_number, item.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [data.items, search]);

  const openTaskDialog = (item) => {
    setSelectedItem(item);
    setForm({
      called_status: item?.task?.called_status || 'answered',
      remarks: item?.task?.remarks || '',
      recall_date: item?.task?.recall_date || '',
      renewal_when: item?.task?.renewal_when || '',
      gym_visit_when: item?.task?.gym_visit_when || ''
    });
  };

  const handleSaveTask = async () => {
    if (!selectedItem) return;
    try {
      setSaving(true);
      const payload = {
        ...form,
        mark_done: true,
        recall_date: form.recall_date || null
      };
      const res = await tasksAPI.updateLeadTask(leadType, selectedItem.user_id, payload);
      toast.success(res.data?.message || 'Task updated');
      setSelectedItem(null);
      await fetchLeads(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            {config.title}
          </h1>
          <p className="text-muted-foreground">{config.subtitle}</p>
        </div>

        <Card className="glass-card">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-primary" />
                  Call Tasks
                </CardTitle>
                <CardDescription className="mt-1">
                  {data.instruction || 'Call members, add remarks, and track follow-up status.'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search member / phone / ID"
                  className="w-64 bg-muted/40"
                />
                <Button type="button" variant="outline" onClick={() => fetchLeads(true)} disabled={refreshing}>
                  <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold mt-1">{data.items?.length || 0}</p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Task Done</p>
                <p className="text-2xl font-bold mt-1 text-green-500">{(data.items || []).filter(i => i.task?.is_done).length}</p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Calls</p>
                <p className="text-2xl font-bold mt-1 text-amber-500">{(data.items || []).filter(i => !i.task?.is_done).length}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="hidden md:grid grid-cols-[1.25fr_1fr_1fr_1.2fr_1fr] gap-3 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                <div>Member</div>
                <div>Contact</div>
                <div>Lead Info</div>
                <div>Task Status</div>
                <div className="text-right">Action</div>
              </div>

              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading task leads...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">{config.empty}</div>
              ) : (
                filteredItems.map((item) => {
                  const isDone = !!item.task?.is_done;
                  return (
                    <div
                      key={`${leadType}-${item.user_id}`}
                      className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr_1fr_1.2fr_1fr] gap-3 px-4 py-4 border-t border-border first:border-t-0 hover:bg-muted/10"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.name || 'Member'}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.member_id || '-'}</p>
                        {item.plan_name ? <p className="text-xs text-muted-foreground truncate">{item.plan_name}</p> : null}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm flex items-center gap-1">
                          <Phone size={14} className="text-muted-foreground" />
                          <span className="truncate">{getPhone(item)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">{item.email || '-'}</p>
                      </div>

                      <div className="text-sm">
                        {leadType === 'renewals' && (
                          <>
                            <p className="font-medium">{item.days_left < 0 ? `Expired ${Math.abs(item.days_left)}d ago` : item.days_left === 0 ? 'Expires Today' : `${item.days_left}d left`}</p>
                            <p className="text-xs text-muted-foreground mt-1">Expiry: {formatDate(item.membership_end_date)}</p>
                          </>
                        )}
                        {leadType === 'absent' && (
                          <>
                            <p className="font-medium">{item.days_absent === 'Never attended' ? 'Never attended' : `${item.days_absent} days absent`}</p>
                            <p className="text-xs text-muted-foreground mt-1">Last: {item.last_attendance ? formatDate(item.last_attendance) : '-'}</p>
                          </>
                        )}
                        {leadType === 'inactive' && (
                          <>
                            <p className="font-medium">No active plan</p>
                            <p className="text-xs text-muted-foreground mt-1">Reactivation follow-up</p>
                          </>
                        )}
                      </div>

                      <div className="text-sm">
                        <div className="flex flex-wrap gap-2 items-center">
                          <Badge variant={isDone ? 'default' : 'secondary'} className={isDone ? 'bg-green-600 hover:bg-green-600' : ''}>
                            {isDone ? 'Task Done' : 'Pending'}
                          </Badge>
                          {item.task?.called_status ? (
                            <Badge variant="outline">{item.task.called_status === 'answered' ? 'Answered' : 'Not Answered'}</Badge>
                          ) : null}
                        </div>
                        {item.task?.recall_date ? (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <CalendarDays size={12} />
                            Recall: {formatDate(item.task.recall_date)}
                          </p>
                        ) : null}
                        {item.task?.remarks ? (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.task.remarks}</p>
                        ) : null}
                      </div>

                      <div className="flex md:justify-end">
                        <Button type="button" onClick={() => openTaskDialog(item)} className="btn-primary">
                          <PhoneCall size={16} className="mr-2" />
                          Task Done
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-primary" />
                Mark Call Task Done
              </DialogTitle>
              <DialogDescription>
                {selectedItem ? `${selectedItem.name} (${selectedItem.member_id || '-'})` : ''}
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-3 bg-muted/20 text-sm">
                  <p><span className="text-muted-foreground">Phone:</span> {getPhone(selectedItem)}</p>
                  {leadType === 'renewals' ? (
                    <p className="mt-1"><span className="text-muted-foreground">Expiry:</span> {formatDate(selectedItem.membership_end_date)} ({selectedItem.days_left < 0 ? `Expired ${Math.abs(selectedItem.days_left)}d ago` : `${selectedItem.days_left}d left`})</p>
                  ) : null}
                  {leadType === 'absent' ? (
                    <p className="mt-1"><span className="text-muted-foreground">Absent:</span> {selectedItem.days_absent === 'Never attended' ? 'Never attended' : `${selectedItem.days_absent} days`}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Call Status</Label>
                    <select
                      className="mt-2 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                      value={form.called_status}
                      onChange={(e) => setForm((prev) => ({ ...prev, called_status: e.target.value }))}
                    >
                      <option value="answered">Answered</option>
                      <option value="not_answered">Not Answered</option>
                    </select>
                  </div>

                  <div>
                    <Label>Recall Date (optional)</Label>
                    <Input
                      type="date"
                      className="mt-2 bg-muted/30"
                      value={form.recall_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, recall_date: e.target.value }))}
                    />
                  </div>
                </div>

                {config.showRenewalFields && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>When Will They Renew? (optional)</Label>
                      <Input
                        className="mt-2 bg-muted/30"
                        placeholder="e.g. Friday evening / next salary date"
                        value={form.renewal_when}
                        onChange={(e) => setForm((prev) => ({ ...prev, renewal_when: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>When Will They Come To Gym? (optional)</Label>
                      <Input
                        className="mt-2 bg-muted/30"
                        placeholder="e.g. Tomorrow morning"
                        value={form.gym_visit_when}
                        onChange={(e) => setForm((prev) => ({ ...prev, gym_visit_when: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Remarks</Label>
                  <Textarea
                    className="mt-2 min-h-[100px] bg-muted/30"
                    placeholder="Call outcome, member response, follow-up notes..."
                    value={form.remarks}
                    onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  />
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock3 size={12} />
                  This will mark the task as done and save call details for this member.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedItem(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveTask} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Task'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export const RenewalLeadsPage = () => <LeadTaskPage leadType="renewals" />;
export const AbsentLeadsPage = () => <LeadTaskPage leadType="absent" />;
export const InactiveUsersTasksPage = () => <LeadTaskPage leadType="inactive" />;

