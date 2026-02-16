import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { attendanceAPI, usersAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { 
  Search, CheckCircle, UserCheck, Clock, ChevronLeft, ChevronRight, User, Dumbbell
} from 'lucide-react';
import { toast } from 'sonner';

const MALE_AVATAR = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/1hk0yqgx_male%20avatar%20f3.png";
const FEMALE_AVATAR = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/bkh6gxr0_female%20avatar%20f3.png";

export const ReceptionistDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchRecentAttendance();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [selectedDate]);

  const fetchRecentAttendance = async () => {
    try {
      const response = await attendanceAPI.getAll({ date: selectedDate });
      setRecentAttendance(response.data);
    } catch (error) {
      console.error('Failed to fetch attendance');
    }
  };

  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Search users as user types
  const handleSearchChange = async (value) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      try {
        const response = await usersAPI.getAll({ search: value });
        setSearchResults(response.data.filter(u => u.role === 'member').slice(0, 8));
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
      toast.error('Please enter member name, phone, or Member ID');
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

  const getAvatarUrl = (record) => {
    if (record.profile_photo_url) return record.profile_photo_url;
    if (record.gender === 'female') return FEMALE_AVATAR;
    return MALE_AVATAR;
  };

  return (
    <DashboardLayout role="receptionist">
      <div className="space-y-6 animate-fade-in" data-testid="receptionist-attendance">
        {/* Header with Live Clock */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Dumbbell className="text-primary" size={32} />
            <h1 className="text-4xl font-bold uppercase tracking-tight text-foreground" style={{ fontFamily: 'Barlow Condensed' }}>
              F3 FITNESS
            </h1>
          </div>
          <p className="text-muted-foreground">Mark Your Attendance</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-2xl font-mono text-primary">
            <Clock size={24} />
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mark Attendance Form - Large for iPad */}
          <Card className="highlight-card">
            <CardContent className="p-8">
              <form onSubmit={handleMarkAttendance} className="space-y-6">
                <div className="relative">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Search Member</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={24} />
                    <Input
                      data-testid="member-id-input"
                      className="input-dark pl-14 text-2xl h-20"
                      placeholder="Name, Phone, or F3-0001"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  
                  {/* Search Dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-card border border-border rounded-lg overflow-hidden shadow-xl max-h-80 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full p-4 text-left hover:bg-muted flex items-center gap-4 border-b border-border last:border-0"
                          onClick={() => selectUser(user)}
                        >
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={getAvatarUrl(user)} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {user.name?.charAt(0)?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-foreground text-lg">{user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {user.phone_number} • Last 4: {user.phone_number?.slice(-4)}
                            </p>
                          </div>
                          <span className="font-mono text-primary text-lg">{user.member_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="btn-primary w-full h-16 text-xl" 
                  disabled={loading}
                  data-testid="mark-btn"
                >
                  {loading ? 'Marking...' : (
                    <>
                      <CheckCircle size={28} className="mr-3" />
                      Mark Attendance
                    </>
                  )}
                </Button>
              </form>
              
              <p className="text-center text-sm text-muted-foreground mt-6">
                Enter your Name, Member ID (F3-XXXX), Phone Number, or last 4 digits of phone
              </p>
            </CardContent>
          </Card>

          {/* Today's Check-ins */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'Barlow Condensed' }}>
                  <UserCheck className="text-primary" size={20} />
                  {isToday ? "Today's" : selectedDate} Check-ins ({recentAttendance.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
                    <ChevronLeft size={18} />
                  </Button>
                  <span className="text-sm min-w-[100px] text-center text-foreground">
                    {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => changeDate(1)} disabled={isToday}>
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {recentAttendance.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCheck size={48} className="mx-auto mb-4 opacity-30" />
                  <p>No check-ins recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAttendance.map((record, index) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border"
                    >
                      <span className="text-muted-foreground font-mono text-sm w-8">#{index + 1}</span>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={getAvatarUrl(record)} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {record.user_name?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{record.user_name}</p>
                        <p className="text-xs text-muted-foreground">{record.member_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-primary">
                          {new Date(record.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <CheckCircle size={14} className="text-green-500 ml-auto" />
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

export default ReceptionistDashboard;
