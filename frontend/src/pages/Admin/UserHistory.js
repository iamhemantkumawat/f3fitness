import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { usersAPI, invoiceAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  ArrowLeft, User, Calendar, CreditCard, ClipboardList, 
  FileText, Download, Printer, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';

// Invoice Modal Component
const InvoiceModal = ({ isOpen, onClose, paymentId }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchInvoice();
    }
  }, [isOpen, paymentId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await invoiceAPI.get(paymentId);
      setInvoice(res.data);
    } catch (error) {
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create printable version and trigger download
    const printContent = document.getElementById('invoice-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoice?.invoice?.receipt_no}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0ea5b7; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #0ea5b7; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f4f6f8; padding: 15px; border-radius: 8px; }
          .info-box h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
          .info-box p { margin: 5px 0; font-size: 13px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #0ea5b7; color: white; }
          .total-row { font-weight: bold; background: #f0f9ff; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-foreground">Invoice</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="print-invoice-btn">
              <Printer size={16} className="mr-2" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} data-testid="download-invoice-btn">
              <Download size={16} className="mr-2" /> Download
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Invoice Content */}
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading invoice...</div>
        ) : invoice ? (
          <div id="invoice-content" className="p-6">
            {/* Gym Header */}
            <div className="text-center border-b border-border pb-4 mb-6">
              <h1 className="text-2xl font-bold text-primary">F3 FITNESS HEALTH CLUB</h1>
              <p className="text-sm text-muted-foreground mt-1">{invoice.gym?.address || 'Jaipur, Rajasthan'}</p>
              <p className="text-sm text-muted-foreground">{invoice.gym?.phone} | {invoice.gym?.email}</p>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Bill To</h3>
                <p className="font-semibold text-foreground">{invoice.customer?.name}</p>
                <p className="text-sm text-muted-foreground">ID: {invoice.customer?.member_id}</p>
                <p className="text-sm text-muted-foreground">{invoice.customer?.phone}</p>
                <p className="text-sm text-muted-foreground">{invoice.customer?.email}</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg text-right">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Invoice Details</h3>
                <p className="font-semibold text-primary">{invoice.invoice?.receipt_no}</p>
                <p className="text-sm text-muted-foreground">
                  Date: {new Date(invoice.invoice?.payment_date).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })}
                </p>
                <p className="text-sm text-muted-foreground capitalize">Via: {invoice.invoice?.payment_method}</p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6">
              <thead>
                <tr className="bg-primary/10">
                  <th className="text-left p-3 text-sm font-semibold text-foreground">Description</th>
                  <th className="text-right p-3 text-sm font-semibold text-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.membership ? (
                  <>
                    <tr className="border-b border-border">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{invoice.membership.plan_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.membership.start_date?.split('T')[0]} to {invoice.membership.end_date?.split('T')[0]}
                        </p>
                      </td>
                      <td className="p-3 text-right text-foreground">{formatCurrency(invoice.membership.original_price)}</td>
                    </tr>
                    {invoice.membership.discount > 0 && (
                      <tr className="border-b border-border">
                        <td className="p-3 text-muted-foreground">Discount</td>
                        <td className="p-3 text-right text-green-500">-{formatCurrency(invoice.membership.discount)}</td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr className="border-b border-border">
                    <td className="p-3 text-foreground">{invoice.invoice?.notes || 'Gym Payment'}</td>
                    <td className="p-3 text-right text-foreground">{formatCurrency(invoice.invoice?.amount_paid)}</td>
                  </tr>
                )}
                <tr className="bg-primary/5 font-bold">
                  <td className="p-3 text-foreground">Amount Paid</td>
                  <td className="p-3 text-right text-primary text-lg">{formatCurrency(invoice.invoice?.amount_paid)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground border-t border-border pt-4">
              <p>Thank you for being a member of F3 Fitness Health Club!</p>
              <p className="mt-1">Transform Your Body, Transform Your Life! 💪</p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Invoice not found</div>
        )}
      </div>
    </div>
  );
};

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
                        <p className="font-semibold text-foreground">{formatCurrency(m.final_price)}</p>
                        <p className="text-xs text-muted-foreground">
                          Paid: {formatCurrency(m.amount_paid)} | Due: {formatCurrency(m.amount_due)}
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
