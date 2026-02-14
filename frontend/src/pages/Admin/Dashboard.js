import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { dashboardAPI, announcementsAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, CreditCard, UserCheck, UserX, Bell, Dumbbell, Cake, CalendarClock, AlertTriangle, Phone } from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="glass-card stat-card hover:border-border transition-all duration-300">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Manrope' }}>{value}</p>
          {subtext && <p className="text-sm text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, announcementsRes] = await Promise.all([
        dashboardAPI.getStats(),
        announcementsAPI.getAll()
      ]);
      setStats(statsRes.data);
      setAnnouncements(announcementsRes.data.slice(0, 5));
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="admin-dashboard">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground" style={{ fontFamily: 'Barlow Condensed' }}>
            Dashboard
          </h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Members"
            value={stats?.total_members || 0}
            icon={Users}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <StatCard
            title="Active Memberships"
            value={stats?.active_memberships || 0}
            icon={Dumbbell}
            color="bg-emerald-500/20 text-emerald-400"
          />
          <StatCard
            title="Today's Collection"
            value={formatCurrency(stats?.today_collection || 0)}
            icon={CreditCard}
            color="bg-orange-500/20 text-orange-400"
          />
          <StatCard
            title="Present Today"
            value={stats?.present_today || 0}
            icon={UserCheck}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatCard
            title="Absent Today"
            value={stats?.absent_today || 0}
            icon={UserX}
            color="bg-red-500/20 text-red-400"
          />
        </div>

        {/* Announcements */}
        <Card className="glass-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              <Bell size={20} className="text-primary" />
              Recent Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {announcements.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No announcements yet</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="font-semibold text-foreground mb-1">{announcement.title}</h3>
                    <p className="text-muted-foreground text-sm">{announcement.content}</p>
                    <p className="text-muted-foreground/60 text-xs mt-2">
                      {new Date(announcement.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Birthday and Renewal Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Birthdays */}
          <Card className="glass-card">
            <CardHeader className="border-b border-zinc-800 py-4">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <Cake size={20} className="text-pink-400" />
                Today's Birthdays
                {stats?.today_birthdays?.length > 0 && (
                  <span className="ml-auto bg-pink-500/20 text-pink-400 text-xs px-2 py-1 rounded-full">
                    {stats.today_birthdays.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!stats?.today_birthdays?.length ? (
                <p className="text-zinc-500 text-center py-6 text-sm">No birthdays today</p>
              ) : (
                <div className="space-y-2">
                  {stats.today_birthdays.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-pink-500/5 rounded-lg border border-pink-500/10">
                      <div>
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.member_id}</p>
                      </div>
                      {member.phone_number && (
                        <a href={`tel:${member.phone_number}`} className="text-pink-400 hover:text-pink-300">
                          <Phone size={16} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Birthdays */}
          <Card className="glass-card">
            <CardHeader className="border-b border-zinc-800 py-4">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <Cake size={20} className="text-purple-400" />
                Upcoming Birthdays (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!stats?.upcoming_birthdays?.length ? (
                <p className="text-zinc-500 text-center py-6 text-sm">No upcoming birthdays</p>
              ) : (
                <div className="space-y-2">
                  {stats.upcoming_birthdays.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
                      <div>
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.member_id}</p>
                      </div>
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                        {member.days_until === 1 ? 'Tomorrow' : `In ${member.days_until} days`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Renewals and Absentees Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming Renewals */}
          <Card className="glass-card">
            <CardHeader className="border-b border-zinc-800 py-4">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <CalendarClock size={20} className="text-amber-400" />
                Upcoming Renewals
                {stats?.upcoming_renewals?.length > 0 && (
                  <span className="ml-auto bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-full">
                    {stats.upcoming_renewals.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!stats?.upcoming_renewals?.length ? (
                <p className="text-zinc-500 text-center py-6 text-sm">No renewals due soon</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.upcoming_renewals.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                      <div>
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.member_id} • {member.plan_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        member.days_left <= 3 
                          ? 'bg-red-500/20 text-red-400' 
                          : member.days_left <= 7 
                            ? 'bg-amber-500/20 text-amber-400' 
                            : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {member.days_left <= 0 ? 'Expired' : member.days_left === 1 ? '1 day left' : `${member.days_left} days left`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regular Absentees */}
          <Card className="glass-card">
            <CardHeader className="border-b border-zinc-800 py-4">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <AlertTriangle size={20} className="text-red-400" />
                Regular Absentees (7+ days)
                {stats?.regular_absentees?.length > 0 && (
                  <span className="ml-auto bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">
                    {stats.regular_absentees.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!stats?.regular_absentees?.length ? (
                <p className="text-zinc-500 text-center py-6 text-sm">No regular absentees</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.regular_absentees.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                      <div>
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.member_id}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded block">
                          {member.days_absent === 'Never attended' ? 'Never' : `${member.days_absent} days`}
                        </span>
                        {member.phone_number && (
                          <a href={`tel:${member.phone_number}`} className="text-red-400 hover:text-red-300 text-xs mt-1 inline-block">
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
