import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { membershipsAPI, plansAPI, attendanceAPI, announcementsAPI, holidaysAPI, paymentRequestsAPI, paymentsAPI } from '../../lib/api';
import { formatCurrency, formatDate, getDaysRemaining } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar } from '../../components/ui/calendar';
import { InvoiceModal } from '../../components/InvoiceModal';
import { 
  CreditCard, Calendar as CalendarIcon, Bell, Clock, CheckCircle, 
  TrendingUp, Dumbbell, ArrowRight, FileText, History
} from 'lucide-react';
import { toast } from 'sonner';

export const MemberDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [lastPayment, setLastPayment] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [membershipRes, attendanceRes, announcementsRes, holidaysRes, paymentsRes] = await Promise.all([
        membershipsAPI.getActive(user.id),
        attendanceAPI.getUserHistory(user.id),
        announcementsAPI.getAll(),
        holidaysAPI.getAll(),
        paymentsAPI.getAll({ user_id: user.id })
      ]);
      setMembership(membershipRes.data);
      setAttendance(attendanceRes.data);
      setAnnouncements(announcementsRes.data.slice(0, 5));
      setHolidays(holidaysRes.data);
      // Get last payment for invoice
      if (paymentsRes.data && paymentsRes.data.length > 0) {
        setLastPayment(paymentsRes.data[0]);
      }
    } catch (error) {
      console.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Get attendance dates for calendar
  const attendanceDates = attendance.map(a => new Date(a.check_in_time).toDateString());
  const holidayDates = holidays.map(h => new Date(h.holiday_date).toDateString());

  const modifiers = {
    present: (date) => attendanceDates.includes(date.toDateString()),
    holiday: (date) => holidayDates.includes(date.toDateString())
  };

  const modifiersStyles = {
    present: { backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
    holiday: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }
  };

  if (loading) {
    return (
      <DashboardLayout role="member">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="member">
      <div className="space-y-6 animate-fade-in" data-testid="member-dashboard">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Welcome, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">Here's your fitness journey overview</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Membership Card */}
          <Card className={membership ? 'highlight-card' : 'glass-card'}>
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <CreditCard size={20} className="text-cyan-400" />
                Membership Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {membership ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{membership.plan_name}</p>
                      <span className="badge-active">{membership.status}</span>
                    </div>
                    <Dumbbell size={48} className="text-cyan-400/30" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Start Date</p>
                      <p className="text-foreground font-medium">{formatDate(membership.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Expiry Date</p>
                      <p className="text-foreground font-medium">{formatDate(membership.end_date)}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Days Remaining</p>
                      <p className="text-2xl font-bold text-cyan-400">{getDaysRemaining(membership.end_date)}</p>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{ 
                          width: `${Math.min(100, (getDaysRemaining(membership.end_date) / 30) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {lastPayment && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowInvoice(true)}
                        data-testid="view-invoice-btn"
                      >
                        <FileText size={14} className="mr-1" /> View Invoice
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/dashboard/member/history')}
                      data-testid="view-history-btn"
                    >
                      <History size={14} className="mr-1" /> My History
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Dumbbell size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-muted-foreground mb-4">No active membership</p>
                  <Button 
                    className="btn-primary"
                    onClick={() => navigate('/dashboard/member/plans')}
                    data-testid="view-plans-btn"
                  >
                    View Plans
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Calendar */}
          <Card className="glass-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <CalendarIcon size={20} className="text-cyan-400" />
                Attendance Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  className="rounded-md"
                />
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                  <span className="text-muted-foreground">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                  <span className="text-muted-foreground">Holiday</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Announcements */}
        <Card className="glass-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              <Bell size={20} className="text-cyan-400" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {announcements.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No announcements</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="font-semibold text-foreground">{ann.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{ann.content}</p>
                    <p className="text-muted-foreground text-xs mt-2">{formatDate(ann.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Modal */}
      {lastPayment && (
        <InvoiceModal 
          isOpen={showInvoice} 
          onClose={() => setShowInvoice(false)} 
          paymentId={lastPayment.id} 
        />
      )}
    </DashboardLayout>
  );
};

export const MemberPlans = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await plansAPI.getAll(true);
      setPlans(response.data);
    } catch (error) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePayAtCounter = async (planId) => {
    setProcessing(planId);
    try {
      await paymentRequestsAPI.create({ plan_id: planId });
      toast.success('Request submitted! Please pay at the counter.');
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setProcessing(null);
    }
  };

  // Razorpay integration placeholder
  const handlePayOnline = async (plan) => {
    toast.info('Online payment integration coming soon!');
  };

  return (
    <DashboardLayout role="member">
      <div className="space-y-6 animate-fade-in" data-testid="member-plans">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Membership Plans
          </h1>
          <p className="text-muted-foreground">Choose a plan that fits your fitness goals</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="glass-card animate-pulse">
                <CardContent className="p-6">
                  <div className="h-48 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : (
            plans.map((plan, index) => (
              <Card 
                key={plan.id} 
                className={`glass-card hover:border-cyan-500/30 transition-all ${
                  index === 1 ? 'ring-2 ring-cyan-500/50' : ''
                }`}
              >
                <CardContent className="p-6">
                  {index === 1 && (
                    <span className="inline-block bg-cyan-500 text-black text-xs font-bold uppercase px-2 py-1 rounded mb-4">
                      Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground mb-4">{plan.duration_days} days</p>
                  <p className="text-4xl font-bold text-cyan-400 mb-6">{formatCurrency(plan.price)}</p>
                  
                  <div className="space-y-3">
                    <Button
                      className="btn-primary w-full"
                      onClick={() => handlePayOnline(plan)}
                      data-testid={`pay-online-${plan.id}`}
                    >
                      Pay Online
                    </Button>
                    <Button
                      className="btn-secondary w-full"
                      onClick={() => handlePayAtCounter(plan.id)}
                      disabled={processing === plan.id}
                      data-testid={`pay-counter-${plan.id}`}
                    >
                      {processing === plan.id ? 'Submitting...' : 'Pay at Counter'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-2">How it works</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle size={16} className="text-cyan-400" />
                Choose a plan that suits your needs
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={16} className="text-cyan-400" />
                Pay online or request to pay at counter
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={16} className="text-cyan-400" />
                Your membership activates immediately after payment
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MemberDashboard;
