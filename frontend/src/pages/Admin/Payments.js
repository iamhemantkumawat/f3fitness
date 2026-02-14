import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { paymentsAPI, usersAPI, paymentRequestsAPI } from '../../lib/api';
import { formatCurrency, formatDateTime, formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Search, Plus, CreditCard, Calendar, TrendingUp, 
  DollarSign, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';

export const PaymentsList = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchPayments();
  }, [dateFilter]);

  const fetchPayments = async () => {
    try {
      const params = {};
      if (dateFilter) {
        params.date_from = dateFilter;
        params.date_to = dateFilter + 'T23:59:59';
      }
      const response = await paymentsAPI.getAll(params);
      setPayments(response.data);
    } catch (error) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="payments-list">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              All Payments
            </h1>
            <p className="text-muted-foreground">View payment history</p>
          </div>
          <div className="flex gap-3">
            <Input
              type="date"
              className="input-dark w-40"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              data-testid="date-filter"
            />
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Date</th>
                  <th>Member</th>
                  <th>Member ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th className="pr-6">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="pl-6">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-8 pl-6">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} data-testid={`payment-row-${payment.id}`}>
                      <td className="pl-6 text-muted-foreground">{formatDateTime(payment.payment_date)}</td>
                      <td className="font-medium text-foreground">{payment.user_name}</td>
                      <td className="font-mono text-cyan-400">{payment.member_id}</td>
                      <td className="font-semibold text-emerald-400">{formatCurrency(payment.amount_paid)}</td>
                      <td className="text-muted-foreground capitalize">{payment.payment_method}</td>
                      <td className="pr-6 text-muted-foreground truncate max-w-xs">{payment.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export const AddPayment = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    amount_paid: '',
    payment_method: 'cash',
    notes: ''
  });

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await usersAPI.getAll({ search: query });
      setSearchResults(response.data.slice(0, 5));
    } catch (error) {
      console.error('Search failed', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      toast.error('Please select a member');
      return;
    }
    setLoading(true);
    try {
      await paymentsAPI.create({
        user_id: selectedUser.id,
        amount_paid: parseFloat(formData.amount_paid),
        payment_method: formData.payment_method,
        notes: formData.notes
      });
      toast.success('Payment recorded successfully');
      navigate('/dashboard/admin/payments');
    } catch (error) {
      toast.error('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in" data-testid="add-payment-form">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Add Payment
          </h1>
          <p className="text-muted-foreground">Record a new payment</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Member Search */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Search Member *</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    data-testid="member-search"
                    className="input-dark pl-10"
                    placeholder="Search by name, phone or member ID"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
                
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-zinc-900 border border-border rounded-lg overflow-hidden">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-muted flex items-center justify-between"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchQuery(user.name);
                          setSearchResults([]);
                        }}
                        data-testid={`search-result-${user.member_id}`}
                      >
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                        </div>
                        <span className="font-mono text-cyan-400">{user.member_id}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedUser && (
                  <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{selectedUser.name}</p>
                      <p className="text-sm text-cyan-400 font-mono">{selectedUser.member_id}</p>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchQuery('');
                      }}
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (₹) *</Label>
                <Input
                  data-testid="amount-input"
                  type="number"
                  className="input-dark mt-2"
                  placeholder="Enter amount"
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment Method</Label>
                <select
                  data-testid="method-select"
                  className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                <Input
                  data-testid="notes-input"
                  className="input-dark mt-2"
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={loading} data-testid="submit-btn">
                  {loading ? 'Recording...' : 'Record Payment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export const PaymentReports = () => {
  const [period, setPeriod] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [period, date]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await paymentsAPI.getSummary(period, date);
      setSummary(response.data);
    } catch (error) {
      toast.error('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="payment-reports">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Payment Reports
          </h1>
          <p className="text-muted-foreground">View payment summaries</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <select
            className="input-dark h-10 px-3 rounded-md bg-muted/50 border border-border"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            data-testid="period-select"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <Input
            type="date"
            className="input-dark w-40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="date-input"
          />
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="glass-card animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="highlight-card">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Total Collection</p>
                  <p className="text-4xl font-bold text-foreground" style={{ fontFamily: 'Manrope' }}>
                    {formatCurrency(summary.total)}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Total Transactions</p>
                  <p className="text-4xl font-bold text-cyan-400" style={{ fontFamily: 'Manrope' }}>
                    {summary.count}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Period</p>
                  <p className="text-2xl font-bold text-foreground capitalize" style={{ fontFamily: 'Manrope' }}>
                    {period}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* By Method */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                  By Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(summary.by_method || {}).map(([method, amount]) => (
                    <div key={method} className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs uppercase text-muted-foreground mb-1">{method}</p>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export const PendingPayments = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount_paid: '',
    payment_method: 'cash',
    discount: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await paymentRequestsAPI.getAll('pending');
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const openApproveDialog = (request) => {
    setSelectedRequest(request);
    setPaymentData({
      amount_paid: request.plan_price?.toString() || '',
      payment_method: 'cash',
      discount: '0'
    });
  };

  const handleApprove = async () => {
    if (!paymentData.amount_paid) {
      toast.error('Please enter amount paid');
      return;
    }
    setSubmitting(true);
    try {
      await paymentRequestsAPI.approve(
        selectedRequest.id, 
        parseFloat(paymentData.discount) || 0, 
        paymentData.payment_method,
        parseFloat(paymentData.amount_paid) || 0
      );
      toast.success('Payment approved & plan assigned');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      await paymentRequestsAPI.reject(id);
      toast.success('Request rejected');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const finalAmount = selectedRequest 
    ? (selectedRequest.plan_price || 0) - (parseFloat(paymentData.discount) || 0) 
    : 0;
  const remainingDue = finalAmount - (parseFloat(paymentData.amount_paid) || 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="pending-payments">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Pending Requests
          </h1>
          <p className="text-muted-foreground">Members who requested to pay at counter</p>
        </div>

        <Card className="glass-card">
          {loading ? (
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          ) : requests.length === 0 ? (
            <CardContent className="p-8 text-center text-muted-foreground">
              No pending payment requests
            </CardContent>
          ) : (
            <div className="divide-y divide-zinc-800">
              {requests.map((request) => (
                <div key={request.id} className="p-4 flex items-center justify-between" data-testid={`request-${request.id}`}>
                  <div>
                    <p className="font-medium text-foreground">{request.user_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.plan_name} - {formatCurrency(request.plan_price)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(request.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(request.id)}
                    >
                      <XCircle size={16} />
                    </Button>
                    <Button
                      className="btn-primary text-sm"
                      onClick={() => openApproveDialog(request)}
                      data-testid={`approve-btn-${request.id}`}
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Approve Payment Dialog */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <Card className="bg-zinc-900 border-border w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-xl">Approve Payment</CardTitle>
              <p className="text-muted-foreground text-sm">
                {selectedRequest.user_name} - {selectedRequest.plan_name}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan Price</span>
                  <span className="text-foreground">{formatCurrency(selectedRequest.plan_price)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Discount (₹)</Label>
                  <Input
                    className="input-dark mt-1"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={paymentData.discount}
                    onChange={(e) => setPaymentData({
                      ...paymentData, 
                      discount: e.target.value.replace(/[^0-9]/g, '')
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Amount Received (₹)</Label>
                  <Input
                    className="input-dark mt-1"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={paymentData.amount_paid}
                    onChange={(e) => setPaymentData({
                      ...paymentData, 
                      amount_paid: e.target.value.replace(/[^0-9]/g, '')
                    })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Payment Method</Label>
                <select
                  className="input-dark mt-1 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Final Amount</span>
                  <span className="text-cyan-400 font-bold">{formatCurrency(finalAmount)}</span>
                </div>
                {remainingDue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining Due</span>
                    <span className="text-orange-400 font-bold">{formatCurrency(remainingDue)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Cancel
                </Button>
                <Button className="btn-primary" onClick={handleApprove} disabled={submitting}>
                  {submitting ? 'Processing...' : 'Confirm & Assign Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default PaymentsList;
