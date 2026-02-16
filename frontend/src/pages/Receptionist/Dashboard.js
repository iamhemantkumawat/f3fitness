import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { attendanceAPI, usersAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { 
  Search, CheckCircle, UserCheck, Clock, ChevronLeft, ChevronRight, User, Dumbbell, Shield, X
} from 'lucide-react';
import { toast } from 'sonner';

const MALE_AVATAR = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/1hk0yqgx_male%20avatar%20f3.png";
const FEMALE_AVATAR = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/bkh6gxr0_female%20avatar%20f3.png";

// Helper to format time in 12-hour AM/PM format
const formatTime = (isoString) => {
  if (!isoString) return '--:--';
  const parts = isoString.match(/T(\d{2}):(\d{2})/);
  if (parts) {
    const hour = parseInt(parts[1]);
    const minute = parts[2];
    const hour12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${hour12}:${minute} ${ampm}`;
  }
  return '--:--';
};

export const ReceptionistDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Verification state
  const [selectedUser, setSelectedUser] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);

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
        // Filter to only show members
        const members = response.data.filter(u => u.role === 'member');
        setSearchResults(members.slice(0, 8));
        setShowDropdown(members.length > 0);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
        setShowDropdown(false);
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  // Select user from dropdown - show verification
  const selectUser = (user) => {
    setSelectedUser(user);
    setShowVerification(true);
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    setVerificationCode('');
  };

  // Cancel verification
  const cancelVerification = () => {
    setSelectedUser(null);
    setShowVerification(false);
    setVerificationCode('');
  };

  // Verify and mark attendance
  const handleVerifyAndMark = async () => {
    if (!selectedUser) return;
    
    // Check last 4 digits
    const last4 = selectedUser.phone_number?.slice(-4);
    if (verificationCode !== last4) {
      toast.error('Invalid verification code. Please enter the last 4 digits of your phone number.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await attendanceAPI.mark(selectedUser.member_id);
      toast.success(`Attendance marked for ${response.data.user_name}`);
      cancelVerification();
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
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search and Verification Card */}
          <Card className="highlight-card">
            <CardContent className="p-8">
              {!showVerification ? (
                /* Search Form */
                <div className="space-y-6">
                  <div className="relative">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Search Member</Label>
                    <div className="relative mt-2">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={24} />
                      <Input
                        data-testid="member-search-input"
                        className="input-dark pl-14 text-xl h-16"
                        placeholder="Name, Email, or F3-0001"
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
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <span className="font-mono text-primary text-lg">{user.member_id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-center text-sm text-muted-foreground">
                    Search by Name, Email, or Member ID (F3-XXXX)
                  </p>
                </div>
              ) : (
                /* Verification Form */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Verify Identity</h3>
                    <Button variant="ghost" size="icon" onClick={cancelVerification}>
                      <X size={20} />
                    </Button>
                  </div>
                  
                  {/* Selected User Info */}
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={getAvatarUrl(selectedUser)} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xl">
                        {selectedUser?.name?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-xl text-foreground">{selectedUser?.name}</p>
                      <p className="text-primary font-mono">{selectedUser?.member_id}</p>
                    </div>
                  </div>
                  
                  {/* Verification Code Input */}
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Shield size={14} />
                      Security Code (Last 4 digits of phone)
                    </Label>
                    <Input
                      data-testid="verification-code-input"
                      type="password"
                      className="input-dark mt-2 text-center text-3xl h-20 tracking-[1rem] font-mono"
                      placeholder="****"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Enter the last 4 digits of your registered phone number
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleVerifyAndMark}
                    className="btn-primary w-full h-16 text-xl" 
                    disabled={loading || verificationCode.length !== 4}
                    data-testid="verify-mark-btn"
                  >
                    {loading ? 'Marking...' : (
                      <>
                        <CheckCircle size={28} className="mr-3" />
                        Verify & Mark Attendance
                      </>
                    )}
                  </Button>
                </div>
              )}
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
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{record.member_id}</p>
                          {record.marked_by === 'self' ? (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                              Self Check-in
                            </Badge>
                          ) : record.marked_by === 'admin' ? (
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                              By Admin
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-primary">
                          {formatTime(record.check_in_time)}
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
