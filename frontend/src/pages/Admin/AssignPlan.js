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
    setSubmitting(true);
    try {
      await membershipsAPI.create({
        user_id: userId,
        plan_id: selectedPlan.id,
        discount_amount: discountAmount,
        initial_payment: initialPaymentAmount,
        payment_method: paymentMethod
      });
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
          <div className="h-8 w-48 bg-zinc-800 rounded mb-6" />
          <div className="h-64 bg-zinc-800 rounded-xl" />
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
          <p className="text-zinc-500">Assign a membership plan to {user?.name}</p>
        </div>

        {/* Member Info */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-cyan-400">{user?.name?.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{user?.name}</h3>
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
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                  data-testid={`plan-option-${plan.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-white">{plan.name}</h4>
                      <p className="text-sm text-zinc-500">{plan.duration_days} days</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Discount Amount (₹)</Label>
                    <Input
                      data-testid="discount-input"
                      type="number"
                      className="input-dark mt-2"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={selectedPlan.price}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Initial Payment (₹)</Label>
                    <Input
                      data-testid="initial-payment-input"
                      type="number"
                      className="input-dark mt-2"
                      value={initialPayment}
                      onChange={(e) => setInitialPayment(parseFloat(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Payment Method</Label>
                    <select
                      data-testid="payment-method-select"
                      className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-zinc-900/50 border border-zinc-800"
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
                <div className="p-4 bg-zinc-900/50 rounded-lg mt-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-500">Plan Price</span>
                    <span className="text-white">{formatCurrency(selectedPlan.price)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-500">Discount</span>
                    <span className="text-red-400">- {formatCurrency(discount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-zinc-800">
                    <span className="font-semibold text-white">Final Price</span>
                    <span className="text-xl font-bold text-cyan-400">{formatCurrency(finalPrice)}</span>
                  </div>
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
