import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { usersAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { InvoiceModal } from '../../components/InvoiceModal';
import { 
  ArrowLeft, User, Calendar, CreditCard, ClipboardList, 
  FileText, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';

export const UserHistory = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const fetchHistory = async () => {
    try {
      const res = await usersAPI.getHistory(userId);
      setHistory(res.data);
    } catch (error) {
      toast.error('Failed to load user history');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (paymentId) => {
    setSelectedPaymentId(paymentId);
    setShowInvoice(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!history) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">User not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="user-history-page">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center gap-4">
            {history.user.profile_photo_url ? (
              <img src={history.user.profile_photo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={28} className="text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{history.user.name}</h1>
              <p className="text-muted-foreground">
                {history.user.member_id} • Joined {formatDate(history.user.joining_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <ClipboardList size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{history.stats.total_memberships}</p>
                  <p className="text-xs text-muted-foreground">Memberships</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CreditCard size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(history.stats.total_amount_paid)}</p>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Calendar size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{history.stats.attendance_count}</p>
                  <p className="text-xs text-muted-foreground">Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Clock size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{formatDate(history.stats.last_attendance)}</p>
                  <p className="text-xs text-muted-foreground">Last Visit</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Membership History */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ClipboardList size={20} className="text-primary" />
              Membership History ({history.memberships.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {history.memberships.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No membership history</div>
            ) : (
              <div className="divide-y divide-border">
                {history.memberships.map((m, idx) => (
                  <div key={m.id || idx} className="p-4 hover:bg-muted/30 transition-colors" data-testid={`membership-${idx}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{m.plan_name || 'Unknown Plan'}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            m.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            m.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(m.start_date)} → {formatDate(m.end_date)}
                          {m.duration_days && <span className="ml-2">({m.duration_days} days)</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatCurrency(m.final_price || 0)}</p>
                        <p className="text-xs text-muted-foreground">
                          Paid: {formatCurrency(m.amount_paid || 0)} | Due: {formatCurrency(m.amount_due || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CreditCard size={20} className="text-green-500" />
              Payment History ({history.payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {history.payments.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No payment history</div>
            ) : (
              <div className="divide-y divide-border">
                {history.payments.map((p, idx) => (
                  <div key={p.id || idx} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center" data-testid={`payment-${idx}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-primary">{p.receipt_no}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize">
                          {p.payment_method}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(p.payment_date)} • {p.notes || 'Payment'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-green-500">{formatCurrency(p.amount_paid)}</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewInvoice(p.id)}
                        data-testid={`view-invoice-btn-${idx}`}
                      >
                        <FileText size={14} className="mr-1" /> Invoice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Modal */}
      <InvoiceModal 
        isOpen={showInvoice} 
        onClose={() => setShowInvoice(false)} 
        paymentId={selectedPaymentId} 
      />
    </DashboardLayout>
  );
};

export default UserHistory;
