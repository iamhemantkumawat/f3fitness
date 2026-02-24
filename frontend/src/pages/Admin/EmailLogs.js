import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { emailLogsAPI } from '../../lib/api';
import { toast } from 'sonner';
import { 
  Mail, CheckCircle, XCircle, Clock, RefreshCw,
  Trash2, ChevronLeft, ChevronRight, AlertTriangle,
  TrendingUp, Calendar
} from 'lucide-react';

export const EmailLogsSettings = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const limit = 20;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [filter, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = { limit, skip: page * limit };
      if (filter !== 'all') params.status = filter;
      const res = await emailLogsAPI.getAll(params);
      setLogs(res.data.logs);
      setTotal(res.data.pagination.total);
    } catch (error) {
      toast.error('Failed to load Email logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await emailLogsAPI.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all Email logs? This action cannot be undone.')) return;
    try {
      await emailLogsAPI.clear();
      toast.success('Logs cleared successfully');
      fetchLogs();
      fetchStats();
    } catch (error) {
      toast.error('Failed to clear logs');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    if (typeof dateStr === 'string') {
      const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (m) {
        const [, y, mo, d, hh, mm, ss = '00'] = m;
        const literalLocal = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
        if (!Number.isNaN(literalLocal.getTime())) {
          return literalLocal.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        }
      }
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      sent: { variant: 'default', className: 'bg-green-500', icon: CheckCircle },
      failed: { variant: 'destructive', className: '', icon: XCircle },
      pending: { variant: 'secondary', className: 'bg-yellow-500', icon: Clock }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    return (
      <Badge variant={style.variant} className={`${style.className} flex items-center gap-1`}>
        <Icon size={12} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const openLogPreview = (log) => {
    setSelectedLog(log);
  };

  const handleCopyOTP = async (otp) => {
    try {
      await navigator.clipboard.writeText(String(otp));
      toast.success('OTP copied');
    } catch (e) {
      toast.error('Failed to copy OTP');
    }
  };

  return (
    <DashboardLayout role="admin">
    <div className="space-y-6" data-testid="email-logs-page">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Mail className="text-primary" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-3xl font-bold text-green-500">{stats.sent}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="text-green-500" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold text-red-500">{stats.failed}</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-full">
                <XCircle className="text-red-500" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold text-primary">{stats.success_rate || 0}%</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <TrendingUp className="text-primary" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Stats */}
      {stats.today && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-muted-foreground" />
                <span className="text-sm font-medium">Today:</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm">
                  <span className="text-green-500 font-medium">{stats.today.sent}</span> sent
                </span>
                <span className="text-sm">
                  <span className="text-red-500 font-medium">{stats.today.failed}</span> failed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail size={20} />
                Email Delivery Logs
              </CardTitle>
              <CardDescription>View delivery status and errors for all emails</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(value) => { setFilter(value); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Emails</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => { fetchLogs(); fetchStats(); }}>
                <RefreshCw size={16} />
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClearLogs} disabled={logs.length === 0}>
                <Trash2 size={16} className="mr-2" />
                Clear Logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail size={48} className="mx-auto mb-4 opacity-50" />
              <p>No email logs yet</p>
              <p className="text-sm mt-1">Emails will appear here once sent</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">To Email</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Subject</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Preview</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => openLogPreview(log)}
                        title="Click to preview email"
                      >
                        <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-medium">{log.to_email}</span>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-foreground truncate max-w-[220px]" title={log.subject}>
                            {log.subject || 'No subject'}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-muted-foreground truncate max-w-[260px]" title={log.body_preview}>
                            {log.body_preview || '-'}
                          </p>
                        </td>
                        <td className="p-3">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="p-3">
                          {log.status === 'sent' && (
                            <span className="text-xs text-emerald-500">
                              Delivered to SMTP server
                            </span>
                          )}
                          {log.status === 'failed' && log.error && (
                            <div className="flex items-center gap-1 text-red-500">
                              <AlertTriangle size={14} />
                              <span className="text-xs truncate max-w-[200px]" title={log.error}>
                                {log.error}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} emails
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * limit >= total}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Failures */}
      {stats.recent_failures && stats.recent_failures.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle size={20} />
              Recent Failures
            </CardTitle>
            <CardDescription>Last 10 failed messages for debugging</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_failures.map((failure, idx) => (
                <div key={idx} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{failure.to_email}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(failure.timestamp)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-red-500 mt-2">{failure.error}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={18} />
              Email Preview
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">To</p>
                  <p className="font-medium break-all">{selectedLog.to_email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Time</p>
                  <p>{formatDate(selectedLog.timestamp)}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="font-medium">{selectedLog.subject || 'No subject'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                {selectedLog.error && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Error</p>
                    <p className="text-red-500 text-sm break-words">{selectedLog.error}</p>
                  </div>
                )}
                {selectedLog.otp_detected && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Detected OTP</p>
                    <div className="mt-1 flex items-center gap-3">
                      <code className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-500 font-semibold text-base">
                        {selectedLog.otp_detected}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => handleCopyOTP(selectedLog.otp_detected)}>
                        Copy OTP
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
                  {selectedLog.body_html ? 'Rendered Email HTML' : 'Preview Text (older log)'}
                </div>
                {selectedLog.body_html ? (
                  <div className="max-h-[420px] overflow-auto bg-white text-black">
                    <div
                      className="p-4"
                      dangerouslySetInnerHTML={{ __html: selectedLog.body_html }}
                    />
                  </div>
                ) : (
                  <pre className="p-4 text-sm whitespace-pre-wrap break-words max-h-[420px] overflow-auto">
                    {selectedLog.body_preview || 'No preview available for this log entry'}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
};

export default EmailLogsSettings;
