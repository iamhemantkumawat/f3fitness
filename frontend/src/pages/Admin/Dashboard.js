import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { dashboardAPI, announcementsAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, CreditCard, UserCheck, UserX, TrendingUp, Bell, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="glass-card stat-card hover:border-white/10 transition-all duration-300">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">{title}</p>
          <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>{value}</p>
          {subtext && <p className="text-sm text-zinc-500 mt-1">{subtext}</p>}
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
          <div className="h-8 w-48 bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-800 rounded-xl" />
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
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Dashboard
          </h1>
          <p className="text-zinc-500">Welcome back! Here's what's happening today.</p>
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
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              <Bell size={20} className="text-cyan-400" />
              Recent Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {announcements.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">No announcements yet</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <h3 className="font-semibold text-white mb-1">{announcement.title}</h3>
                    <p className="text-zinc-400 text-sm">{announcement.content}</p>
                    <p className="text-zinc-600 text-xs mt-2">
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
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
