import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { membershipsAPI, paymentsAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { InvoiceModal } from '../../components/InvoiceModal';
import { 
  ArrowLeft, Calendar, CreditCard, ClipboardList, 
  FileText, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';

export const MemberHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const [membershipRes, paymentsRes] = await Promise.all([
        membershipsAPI.getAll(user.id),
        paymentsAPI.getAll({ user_id: user.id })
      ]);
      setMemberships(membershipRes.data);
      setPayments(paymentsRes.data);
    } catch (error) {
      console.error('History error:', error);
      toast.error('Failed to load history');
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

  // Calculate stats
  const totalMemberships = memberships.length;
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const activeMembership = memberships.find(m => m.status === 'active');

  if (loading) {
    return (
      <DashboardLayout role="member">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="member">
      <div className="space-y-6" data-testid="member-history-page">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My History</h1>
            <p className="text-muted-foreground">View your membership and payment history</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <ClipboardList size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalMemberships}</p>
                  <p className="text-xs text-muted-foreground">Total Memberships</p>
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
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeMembership ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {activeMembership ? (
                    <CheckCircle size={20} className="text-green-500" />
                  ) : (
                    <XCircle size={20} className="text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {activeMembership ? activeMembership.plan_name : 'No Active Plan'}
                  </p>
                  <p className="text-xs text-muted-foreground">Current Plan</p>
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
              Membership History ({memberships.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {memberships.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No membership history</div>
            ) : (
              <div className="divide-y divide-border">
                {memberships.map((m, idx) => (
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
              Payment History ({payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No payment history</div>
            ) : (
              <div className="divide-y divide-border">
                {payments.map((p, idx) => (
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

export default MemberHistory;
