import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { attendanceAPI, usersAPI } from '../../lib/api';
import { formatDateTime, formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Search, UserCheck, UserX, CheckCircle, Calendar, Clock
} from 'lucide-react';
import { toast } from 'sonner';

export const MarkAttendance = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchRecentAttendance();
  }, []);

  const fetchRecentAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await attendanceAPI.getAll({ date: today });
      setRecentAttendance(response.data.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch attendance');
    }
  };

  // Search users as admin types
  const handleSearchChange = async (value) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      try {
        const response = await usersAPI.getAll({ search: value });
        setSearchResults(response.data.filter(u => u.role === 'member').slice(0, 5));
        setShowDropdown(true);
      } catch (error) {
        console.error('Search failed');
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  // Select user from dropdown
  const selectUser = (user) => {
    setSearchQuery(user.member_id || user.name);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter member name, phone, email or ID');
      return;
    }
    setLoading(true);
    setShowDropdown(false);
    try {
      const response = await attendanceAPI.mark(searchQuery.trim());
      toast.success(`Attendance marked for ${response.data.user_name}`);
      setSearchQuery('');
      setSearchResults([]);
      fetchRecentAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="mark-attendance">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Mark Attendance
          </h1>
          <p className="text-zinc-500">Search by Name, Phone, Email or Member ID</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mark Attendance Form */}
          <Card className="highlight-card">
            <CardContent className="p-8">
              <form onSubmit={handleMarkAttendance} className="space-y-6">
                <div className="relative">
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Search Member</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <Input
                      data-testid="member-id-input"
                      className="input-dark pl-12 text-xl h-16"
                      placeholder="Name, Phone, Email or F3-0001"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  
                  {/* Search Dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden shadow-xl">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full p-4 text-left hover:bg-zinc-800 flex items-center justify-between border-b border-zinc-800 last:border-0"
                          onClick={() => selectUser(user)}
                        >
                          <div>
                            <p className="font-medium text-white">{user.name}</p>
                            <p className="text-sm text-zinc-400">{user.phone} • {user.email}</p>
                          </div>
                          <span className="font-mono text-cyan-400 text-sm">{user.member_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="btn-primary w-full h-14 text-lg" 
                  disabled={loading}
                  data-testid="mark-btn"
                >
                  {loading ? 'Marking...' : (
                    <>
                      <CheckCircle size={24} className="mr-2" />
                      Mark Present
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Check-ins */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'Barlow Condensed' }}>
                <Clock size={20} className="text-cyan-400" />
                Recent Check-ins (Today)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAttendance.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No check-ins today</p>
              ) : (
                <div className="space-y-3">
                  {recentAttendance.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{att.user_name}</p>
                        <p className="text-sm text-cyan-400 font-mono">{att.member_id}</p>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {new Date(att.check_in_time).toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata'
                        })}
                      </p>
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

export const TodayAttendance = () => {
  const [data, setData] = useState({ present: [], absent: [], present_count: 0, absent_count: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('present');

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      const response = await attendanceAPI.getToday();
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="today-attendance">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Today's Attendance
          </h1>
          <p className="text-zinc-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className={`glass-card cursor-pointer transition-all ${view === 'present' ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => setView('present')}
            data-testid="present-card"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <UserCheck size={24} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Present</p>
                  <p className="text-3xl font-bold text-emerald-400">{data.present_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`glass-card cursor-pointer transition-all ${view === 'absent' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setView('absent')}
            data-testid="absent-card"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <UserX size={24} className="text-red-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Absent</p>
                  <p className="text-3xl font-bold text-red-400">{data.absent_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              {view === 'present' ? 'Present Members' : 'Absent Members'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-zinc-800 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(view === 'present' ? data.present : data.absent).map((item) => (
                  <div key={item.id || item.user_id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{item.user_name || item.name}</p>
                      <p className="text-sm text-cyan-400 font-mono">{item.member_id}</p>
                    </div>
                    {view === 'present' && (
                      <p className="text-sm text-zinc-500">
                        {new Date(item.check_in_time).toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    )}
                  </div>
                ))}
                {(view === 'present' ? data.present : data.absent).length === 0 && (
                  <p className="text-zinc-500 text-center py-4">
                    No {view === 'present' ? 'present' : 'absent'} members
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export const AttendanceHistory = () => {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query) => {
    setSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await usersAPI.getAll({ search: query });
      setSearchResults(response.data.slice(0, 5));
    } catch (error) {
      console.error('Search failed');
    }
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    setSearch(user.name);
    setSearchResults([]);
    setLoading(true);
    try {
      const response = await attendanceAPI.getUserHistory(user.id);
      setHistory(response.data);
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="attendance-history">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Attendance History
          </h1>
          <p className="text-zinc-500">View member's attendance history</p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input
            data-testid="member-search"
            className="input-dark pl-10"
            placeholder="Search member..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="w-full p-3 text-left hover:bg-zinc-800 flex items-center justify-between"
                  onClick={() => selectUser(user)}
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
        </div>

        {/* History */}
        {selectedUser && (
          <Card className="glass-card">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-400">{selectedUser.name.charAt(0)}</span>
                </div>
                <div>
                  <CardTitle className="text-xl">{selectedUser.name}</CardTitle>
                  <p className="text-cyan-400 font-mono text-sm">{selectedUser.member_id}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-zinc-800 rounded" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No attendance records found</p>
              ) : (
                <div className="space-y-2">
                  {history.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar size={16} className="text-cyan-400" />
                        <span className="text-white">
                          {new Date(record.check_in_time).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <span className="text-zinc-500">
                        {new Date(record.check_in_time).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MarkAttendance;
