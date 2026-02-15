import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { usersAPI, plansAPI, membershipsAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { CreditCard, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const AssignPlan = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [discount, setDiscount] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Custom dates for importing existing members
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [userRes, plansRes] = await Promise.all([
        usersAPI.getById(userId),
        plansAPI.getAll(true)
      ]);
      setUser(userRes.data);
      setPlans(plansRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const discountAmount = parseFloat(discount) || 0;
  const initialPaymentAmount = parseFloat(initialPayment) || 0;
  const finalPrice = selectedPlan ? selectedPlan.price - discountAmount : 0;
  const remainingAmount = finalPrice - initialPaymentAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }
    if (initialPaymentAmount > finalPrice) {
      toast.error('Initial payment cannot exceed final price');
      return;
    }
    if (useCustomDates && (!customStartDate || !customEndDate)) {
      toast.error('Please provide both custom start and end dates');
      return;
    }
    if (useCustomDates && new Date(customStartDate) > new Date(customEndDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        user_id: userId,
        plan_id: selectedPlan.id,
        discount_amount: discountAmount,
        initial_payment: initialPaymentAmount,
        payment_method: paymentMethod
      };
      // Add custom dates if enabled
      if (useCustomDates && customStartDate && customEndDate) {
        payload.custom_start_date = customStartDate;
        payload.custom_end_date = customEndDate;
      }
      await membershipsAPI.create(payload);
      toast.success('Plan assigned successfully');
      navigate('/dashboard/admin/members');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign plan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-6" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="assign-plan-page">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Assign Plan
          </h1>
          <p className="text-muted-foreground">Assign a membership plan to {user?.name}</p>
        </div>

        {/* Member Info */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-cyan-400">{user?.name?.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{user?.name}</h3>
                <p className="text-cyan-400 font-mono">{user?.member_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Selection */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              Select Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedPlan?.id === plan.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-border hover:border-zinc-700'
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                  data-testid={`plan-option-${plan.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{plan.name}</h4>
                      <p className="text-sm text-muted-foreground">{plan.duration_days} days</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-cyan-400">{formatCurrency(plan.price)}</p>
                      {selectedPlan?.id === plan.id && (
                        <CheckCircle size={20} className="text-cyan-400 ml-auto mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        {selectedPlan && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Custom Dates Toggle for Importing Existing Members */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomDates}
                      onChange={(e) => setUseCustomDates(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                      data-testid="custom-dates-toggle"
                    />
                    <div>
                      <span className="text-foreground font-medium">Import Existing Membership</span>
                      <p className="text-xs text-muted-foreground">Set custom start/end dates for members with active memberships from before</p>
                    </div>
                  </label>
                  
                  {useCustomDates && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Custom Start Date</Label>
                        <Input
                          data-testid="custom-start-date"
                          type="date"
                          className="input-dark mt-2"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Custom End Date</Label>
                        <Input
                          data-testid="custom-end-date"
                          type="date"
                          className="input-dark mt-2"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Discount Amount (₹)</Label>
                    <Input
                      data-testid="discount-input"
                      type="text"
                      inputMode="numeric"
                      className="input-dark mt-2"
                      placeholder="0"
                      value={discount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setDiscount(val);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Initial Payment (₹)</Label>
                    <Input
                      data-testid="initial-payment-input"
                      type="text"
                      inputMode="numeric"
                      className="input-dark mt-2"
                      placeholder="0"
                      value={initialPayment}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setInitialPayment(val);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment Method</Label>
                    <select
                      data-testid="payment-method-select"
                      className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 bg-muted/50 rounded-lg mt-6 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan Price</span>
                    <span className="text-foreground">{formatCurrency(selectedPlan.price)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-400">- {formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-semibold text-foreground">Final Price</span>
                    <span className="text-xl font-bold text-cyan-400">{formatCurrency(finalPrice)}</span>
                  </div>
                  {initialPaymentAmount > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Initial Payment</span>
                        <span className="text-emerald-400">- {formatCurrency(initialPaymentAmount)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="font-semibold text-foreground">Remaining Due</span>
                        <span className={`text-xl font-bold ${remainingAmount > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                          {formatCurrency(remainingAmount > 0 ? remainingAmount : 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="btn-primary" disabled={submitting} data-testid="assign-btn">
                    {submitting ? 'Assigning...' : 'Assign Plan'}
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssignPlan;
