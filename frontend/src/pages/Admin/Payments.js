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
            <p className="text-zinc-500">View payment history</p>
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
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-zinc-500 py-8 pl-6">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} data-testid={`payment-row-${payment.id}`}>
                      <td className="pl-6 text-zinc-400">{formatDateTime(payment.payment_date)}</td>
                      <td className="font-medium text-white">{payment.user_name}</td>
                      <td className="font-mono text-cyan-400">{payment.member_id}</td>
                      <td className="font-semibold text-emerald-400">{formatCurrency(payment.amount_paid)}</td>
                      <td className="text-zinc-400 capitalize">{payment.payment_method}</td>
                      <td className="pr-6 text-zinc-500 truncate max-w-xs">{payment.notes || '-'}</td>
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
          <p className="text-zinc-500">Record a new payment</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Member Search */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Search Member *</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <Input
                    data-testid="member-search"
                    className="input-dark pl-10"
                    placeholder="Search by name, phone or member ID"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
                
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-zinc-800 flex items-center justify-between"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchQuery(user.name);
                          setSearchResults([]);
                        }}
                        data-testid={`search-result-${user.member_id}`}
                      >
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-sm text-zinc-500">{user.phone_number}</p>
                        </div>
                        <span className="font-mono text-cyan-400">{user.member_id}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedUser && (
                  <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{selectedUser.name}</p>
                      <p className="text-sm text-cyan-400 font-mono">{selectedUser.member_id}</p>
                    </div>
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-white"
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
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Amount (₹) *</Label>
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
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Payment Method</Label>
                <select
                  data-testid="method-select"
                  className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-zinc-900/50 border border-zinc-800"
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
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Notes</Label>
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
          <p className="text-zinc-500">View payment summaries</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <select
            className="input-dark h-10 px-3 rounded-md bg-zinc-900/50 border border-zinc-800"
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
                  <div className="h-20 bg-zinc-800 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="highlight-card">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Total Collection</p>
                  <p className="text-4xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>
                    {formatCurrency(summary.total)}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Total Transactions</p>
                  <p className="text-4xl font-bold text-cyan-400" style={{ fontFamily: 'Manrope' }}>
                    {summary.count}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Period</p>
                  <p className="text-2xl font-bold text-white capitalize" style={{ fontFamily: 'Manrope' }}>
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
                    <div key={method} className="p-4 bg-zinc-900/50 rounded-lg">
                      <p className="text-xs uppercase text-zinc-500 mb-1">{method}</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(amount)}</p>
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

  const handleApprove = async (id) => {
    try {
      await paymentRequestsAPI.approve(id, 0, 'cash');
      toast.success('Payment request approved');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="pending-payments">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Pending Requests
          </h1>
          <p className="text-zinc-500">Members who requested to pay at counter</p>
        </div>

        <Card className="glass-card">
          {loading ? (
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-800 rounded" />
                ))}
              </div>
            </CardContent>
          ) : requests.length === 0 ? (
            <CardContent className="p-8 text-center text-zinc-500">
              No pending payment requests
            </CardContent>
          ) : (
            <div className="divide-y divide-zinc-800">
              {requests.map((request) => (
                <div key={request.id} className="p-4 flex items-center justify-between" data-testid={`request-${request.id}`}>
                  <div>
                    <p className="font-medium text-white">{request.user_name}</p>
                    <p className="text-sm text-zinc-500">
                      {request.plan_name} - {formatCurrency(request.plan_price)}
                    </p>
                    <p className="text-xs text-zinc-600">{formatDate(request.created_at)}</p>
                  </div>
                  <Button
                    className="btn-primary text-sm"
                    onClick={() => handleApprove(request.id)}
                    data-testid={`approve-btn-${request.id}`}
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Approve
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

export default PaymentsList;
