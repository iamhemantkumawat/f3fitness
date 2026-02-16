import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { usersAPI, membershipsAPI, uploadAPI } from '../../lib/api';
import { formatDate, getStatusBadge } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { 
  Search, Plus, User, Phone, Mail, Calendar, MapPin, 
  CreditCard, Edit, Trash2, Eye, ChevronRight, EyeOff,
  ArrowUpDown, ArrowUp, ArrowDown, UserX, UserCheck,
  Ban, RotateCcw, Key, MoreHorizontal, CheckSquare, Square, Camera, History
} from 'lucide-react';
import { toast } from 'sonner';

// Default avatar images
const MALE_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=male&backgroundColor=06b6d4";
const FEMALE_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=female&backgroundColor=f97316";
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=default&backgroundColor=71717a";

export const MembersList = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [membershipData, setMembershipData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'member_id', direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive, disabled
  
  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchMembers();
  }, [statusFilter]);

  const fetchMembers = async (searchQuery = '') => {
    try {
      setLoading(true);
      const params = { role: 'member', search: searchQuery };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await usersAPI.getAllWithMembership(params);
      setMembers(response.data);
    } catch (error) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    fetchMembers(e.target.value);
  };

  // Sorting logic
  const sortedMembers = useMemo(() => {
    const sorted = [...members];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case 'member_id':
          aVal = a.member_id || '';
          bVal = b.member_id || '';
          break;
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'phone_number':
          aVal = a.phone_number || '';
          bVal = b.phone_number || '';
          break;
        case 'plan':
          aVal = a.active_membership?.plan_name || '';
          bVal = b.active_membership?.plan_name || '';
          break;
        case 'expiry':
          aVal = a.active_membership?.end_date || '9999-99-99';
          bVal = b.active_membership?.end_date || '9999-99-99';
          break;
        default:
          aVal = a[sortConfig.key] || '';
          bVal = b[sortConfig.key] || '';
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [members, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-muted-foreground" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-cyan-400" /> 
      : <ArrowDown size={14} className="text-cyan-400" />;
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === members.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(members.map(m => m.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const openMemberDetail = async (member) => {
    setSelectedMember(member);
    setMembershipData(member.active_membership);
  };

  // Action handlers
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('No members selected');
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
    setActionLoading(true);
    try {
      await usersAPI.bulkDelete(selectedIds);
      toast.success(`${selectedIds.length} member(s) deleted`);
      setSelectedIds([]);
      fetchMembers(search);
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error('Failed to delete members');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      await usersAPI.delete(id);
      toast.success('Member deleted');
      fetchMembers(search);
      setSelectedMember(null);
    } catch (error) {
      toast.error('Failed to delete member');
    }
  };

  const handleToggleStatus = async (id, action) => {
    try {
      await usersAPI.toggleStatus(id, action);
      toast.success(`Member ${action === 'disable' ? 'disabled' : 'enabled'} and notified`);
      fetchMembers(search);
      setSelectedMember(null);
    } catch (error) {
      toast.error(`Failed to ${action} member`);
    }
  };

  const handleRevokeMembership = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this membership?')) return;
    try {
      await usersAPI.revokeMembership(id);
      toast.success('Membership revoked and member notified');
      fetchMembers(search);
      setSelectedMember(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revoke membership');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setActionLoading(true);
    try {
      await usersAPI.resetPassword(selectedMember.id, newPassword);
      toast.success('Password reset and sent to member via Email & WhatsApp');
      setShowPasswordDialog(false);
      setNewPassword('');
    } catch (error) {
      toast.error('Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const getAvatarUrl = (member) => {
    if (member.profile_photo_url) return member.profile_photo_url;
    if (member.gender === 'male') return MALE_AVATAR;
    if (member.gender === 'female') return FEMALE_AVATAR;
    return DEFAULT_AVATAR;
  };

  const getMemberStatus = (member) => {
    if (member.is_disabled) return { label: 'Disabled', class: 'bg-red-500/20 text-red-400' };
    if (member.active_membership) {
      const endDate = new Date(member.active_membership.end_date);
      const today = new Date();
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 0) return { label: 'Expired', class: 'bg-red-500/20 text-red-400' };
      if (daysLeft <= 7) return { label: `${daysLeft}d left`, class: 'bg-orange-500/20 text-orange-400' };
      return { label: 'Active', class: 'bg-emerald-500/20 text-emerald-400' };
    }
    return { label: 'No Plan', class: 'bg-zinc-500/20 text-muted-foreground' };
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="members-list">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Members
            </h1>
            <p className="text-muted-foreground">Manage gym members ({members.length} total)</p>
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete}
                data-testid="bulk-delete-btn"
              >
                <Trash2 size={16} className="mr-2" />
                Delete ({selectedIds.length})
              </Button>
            )}
            <Button 
              className="btn-primary" 
              onClick={() => navigate('/dashboard/admin/members/new')}
              data-testid="add-member-btn"
            >
              <Plus size={18} className="mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              data-testid="member-search"
              className="input-dark pl-10"
              placeholder="Search by name, email, phone or member ID..."
              value={search}
              onChange={handleSearch}
            />
          </div>
          <select
            className="input-dark h-10 px-3 rounded-md bg-muted/50 border border-border text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="status-filter"
          >
            <option value="all">All Members</option>
            <option value="active">Active (With Plan)</option>
            <option value="inactive">Inactive (No Plan)</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {/* Members Table */}
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-4 w-10">
                    <button onClick={toggleSelectAll} className="p-1 hover:bg-accent rounded">
                      {selectedIds.length === members.length && members.length > 0 
                        ? <CheckSquare size={18} className="text-cyan-400" />
                        : <Square size={18} className="text-muted-foreground" />
                      }
                    </button>
                  </th>
                  <th className="w-12"></th>
                  <th className="cursor-pointer" onClick={() => handleSort('member_id')}>
                    <div className="flex items-center gap-2">Member ID {getSortIcon('member_id')}</div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-2">Name {getSortIcon('name')}</div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('phone_number')}>
                    <div className="flex items-center gap-2">Phone {getSortIcon('phone_number')}</div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('plan')}>
                    <div className="flex items-center gap-2">Plan {getSortIcon('plan')}</div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('expiry')}>
                    <div className="flex items-center gap-2">Expiry {getSortIcon('expiry')}</div>
                  </th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10} className="pl-4">
                        <div className="h-12 bg-muted/50 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : sortedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted-foreground py-8 pl-4">
                      No members found
                    </td>
                  </tr>
                ) : (
                  sortedMembers.map((member) => {
                    const status = getMemberStatus(member);
                    return (
                      <tr 
                        key={member.id} 
                        className={`hover:bg-accent ${member.is_disabled ? 'opacity-60' : ''}`}
                        data-testid={`member-row-${member.member_id}`}
                      >
                        <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => toggleSelect(member.id)} 
                            className="p-1 hover:bg-accent rounded"
                          >
                            {selectedIds.includes(member.id) 
                              ? <CheckSquare size={18} className="text-cyan-400" />
                              : <Square size={18} className="text-muted-foreground" />
                            }
                          </button>
                        </td>
                        <td className="cursor-pointer" onClick={() => openMemberDetail(member)}>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={getAvatarUrl(member)} />
                            <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xs">
                              {member.name?.charAt(0)?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </td>
                        <td className="font-mono text-cyan-400 cursor-pointer" onClick={() => openMemberDetail(member)}>
                          {member.member_id}
                        </td>
                        <td className="font-medium text-foreground cursor-pointer" onClick={() => openMemberDetail(member)}>
                          {member.name}
                        </td>
                        <td className="text-muted-foreground cursor-pointer" onClick={() => openMemberDetail(member)}>
                          {member.phone_number}
                        </td>
                        <td className="cursor-pointer" onClick={() => openMemberDetail(member)}>
                          <span className={member.active_membership ? 'text-foreground' : 'text-muted-foreground'}>
                            {member.active_membership?.plan_name || '-'}
                          </span>
                        </td>
                        <td className="cursor-pointer" onClick={() => openMemberDetail(member)}>
                          <span className={member.active_membership ? 'text-foreground' : 'text-muted-foreground'}>
                            {member.active_membership?.end_date 
                              ? formatDate(member.active_membership.end_date)
                              : '-'}
                          </span>
                        </td>
                        <td className="cursor-pointer" onClick={() => openMemberDetail(member)}>
                          {member.active_membership?.amount_due > 0 ? (
                            <span className="text-orange-400 font-medium">
                              ₹{member.active_membership.amount_due}
                            </span>
                          ) : member.active_membership ? (
                            <span className="text-emerald-400">Paid</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.class}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="pr-6">
                          <button 
                            className="text-muted-foreground hover:text-foreground p-1 hover:bg-accent rounded"
                            onClick={() => openMemberDetail(member)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Member Detail Sheet */}
        <Sheet open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
            {selectedMember && (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="text-2xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                    Member Details
                  </SheetTitle>
                </SheetHeader>

                {/* Profile Section */}
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={getAvatarUrl(selectedMember)} />
                    <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-2xl">
                      {selectedMember.name?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selectedMember.name}</h3>
                    <p className="text-cyan-400 font-mono">{selectedMember.member_id}</p>
                    {selectedMember.is_disabled && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                        DISABLED
                      </span>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Contact Info</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Mail size={16} />
                      <span>{selectedMember.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Phone size={16} />
                      <span>{selectedMember.phone_number}</span>
                    </div>
                    {selectedMember.address && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <MapPin size={16} />
                        <span>{selectedMember.address}, {selectedMember.city}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Personal Info */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Personal Info</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Gender</p>
                      <p className="text-foreground capitalize">{selectedMember.gender || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date of Birth</p>
                      <p className="text-foreground">{formatDate(selectedMember.date_of_birth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Joining Date</p>
                      <p className="text-foreground">{formatDate(selectedMember.joining_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Emergency Contact</p>
                      <p className="text-foreground">{selectedMember.emergency_phone || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Membership Info */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Membership</h4>
                  {selectedMember.active_membership ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground">{selectedMember.active_membership.plan_name}</span>
                        <span className="badge-active">{selectedMember.active_membership.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedMember.active_membership.start_date)} - {formatDate(selectedMember.active_membership.end_date)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                        onClick={() => handleRevokeMembership(selectedMember.id)}
                        data-testid="revoke-membership-btn"
                      >
                        <Ban size={14} className="mr-2" />
                        Revoke Membership
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-muted-foreground mb-3">No active membership</p>
                      <Button
                        className="btn-primary text-sm"
                        onClick={() => navigate(`/dashboard/admin/members/${selectedMember.id}/assign-plan`)}
                        data-testid="assign-plan-btn"
                      >
                        <CreditCard size={16} className="mr-2" />
                        Assign Plan
                      </Button>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={() => navigate(`/dashboard/admin/members/${selectedMember.id}/history`)}
                      data-testid="view-history-btn"
                    >
                      <History size={14} className="mr-2" />
                      View History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={() => setShowPasswordDialog(true)}
                      data-testid="reset-password-btn"
                    >
                      <Key size={14} className="mr-2" />
                      Reset Password
                    </Button>
                    {selectedMember.is_disabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10"
                        onClick={() => handleToggleStatus(selectedMember.id, 'enable')}
                        data-testid="enable-user-btn"
                      >
                        <UserCheck size={14} className="mr-2" />
                        Enable User
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                        onClick={() => handleToggleStatus(selectedMember.id, 'disable')}
                        data-testid="disable-user-btn"
                      >
                        <UserX size={14} className="mr-2" />
                        Disable User
                      </Button>
                    )}
                  </div>
                </div>

                {/* Main Actions */}
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button
                    className="btn-secondary flex-1"
                    onClick={() => navigate(`/dashboard/admin/members/${selectedMember.id}/edit`)}
                    data-testid="edit-member-btn"
                  >
                    <Edit size={16} className="mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleSingleDelete(selectedMember.id)}
                    data-testid="delete-member-btn"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Bulk Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Bulk Delete</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete {selectedIds.length} member(s)? 
              This action cannot be undone. All related data (memberships, attendance, health logs) will also be deleted.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmBulkDelete}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : `Delete ${selectedIds.length} Member(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl">Reset Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Set a new password for <strong className="text-foreground">{selectedMember?.name}</strong>. 
                The new password will be sent to the member via Email and WhatsApp.
              </p>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    className="input-dark pr-10"
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="new-password-input"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => {setShowPasswordDialog(false); setNewPassword('');}}>
                Cancel
              </Button>
              <Button 
                className="btn-primary"
                onClick={handleResetPassword}
                disabled={actionLoading || newPassword.length < 6}
              >
                {actionLoading ? 'Resetting...' : 'Reset & Send'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export const TrainersList = () => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const navigate = useNavigate();

  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone_number: '',
    speciality: '',
    bio: '',
    instagram_url: '',
    profile_photo_url: '',
    is_visible_on_website: true
  });

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      const response = await usersAPI.getAll({ role: 'trainer' });
      setTrainers(response.data);
    } catch (error) {
      toast.error('Failed to load trainers');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = (trainer) => {
    if (trainer.profile_photo_url) return trainer.profile_photo_url;
    if (trainer.gender === 'male') return MALE_AVATAR;
    if (trainer.gender === 'female') return FEMALE_AVATAR;
    return DEFAULT_AVATAR;
  };

  const openEditDialog = (trainer) => {
    setSelectedTrainer(trainer);
    setEditData({
      name: trainer.name || '',
      email: trainer.email || '',
      phone_number: trainer.phone_number || '',
      speciality: trainer.speciality || '',
      bio: trainer.bio || '',
      instagram_url: trainer.instagram_url || '',
      profile_photo_url: trainer.profile_photo_url || '',
      is_visible_on_website: trainer.is_visible_on_website !== false
    });
    setEditMode(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }
    
    setUploading(true);
    try {
      const photoFormData = new FormData();
      photoFormData.append('file', file);
      
      const response = await uploadAPI.profilePhoto(photoFormData, selectedTrainer.id);
      setEditData({ ...editData, profile_photo_url: response.data.profile_photo_url || response.data.url });
      toast.success('Photo uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await uploadAPI.deletePhoto(selectedTrainer.id);
      setEditData({ ...editData, profile_photo_url: '' });
      toast.success('Photo removed');
    } catch (error) {
      toast.error('Failed to remove photo');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await usersAPI.update(selectedTrainer.id, editData);
      toast.success('Trainer updated successfully');
      setEditMode(false);
      fetchTrainers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update trainer');
    } finally {
      setSaving(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await usersAPI.resetPassword(selectedTrainer.id, newPassword);
      toast.success('Password updated and sent to trainer via Email & WhatsApp');
      setNewPassword('');
    } catch (error) {
      toast.error('Failed to update password');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="trainers-list">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Trainers
            </h1>
            <p className="text-muted-foreground">Manage gym trainers - shown on landing page</p>
          </div>
          <Button 
            className="btn-primary" 
            onClick={() => navigate('/dashboard/admin/members/new?role=trainer')}
            data-testid="add-trainer-btn"
          >
            <Plus size={18} className="mr-2" />
            Add Trainer
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="glass-card animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : trainers.length === 0 ? (
            <Card className="glass-card col-span-full">
              <CardContent className="p-8 text-center text-muted-foreground">
                No trainers found. Add your first trainer!
              </CardContent>
            </Card>
          ) : (
            trainers.map((trainer) => (
              <Card 
                key={trainer.id} 
                className="glass-card hover:border-cyan-500/50 transition-all cursor-pointer"
                onClick={() => openEditDialog(trainer)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={getAvatarUrl(trainer)} />
                      <AvatarFallback className="bg-orange-500/20 text-orange-400 text-xl">
                        {trainer.name?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{trainer.name}</h3>
                      <p className="text-sm text-cyan-400">{trainer.speciality || 'Fitness Coach'}</p>
                      <p className="text-sm text-muted-foreground">{trainer.phone_number}</p>
                      {trainer.is_visible_on_website !== false && (
                        <span className="inline-block mt-1 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                          Visible on Website
                        </span>
                      )}
                    </div>
                    <Edit size={18} className="text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Edit Trainer Dialog */}
      <Dialog open={editMode} onOpenChange={setEditMode}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Trainer</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Photo Section */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-24 h-24">
                <AvatarImage src={editData.profile_photo_url || MALE_AVATAR} />
                <AvatarFallback className="bg-orange-500/20 text-orange-400 text-3xl">
                  {editData.name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera size={14} className="mr-1" />
                  {uploading ? 'Uploading...' : 'Change Photo'}
                </Button>
                {editData.profile_photo_url && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="sm"
                    onClick={handleDeletePhoto}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Max 2MB • JPG, PNG, WebP</p>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <Input
                  className="input-dark mt-1"
                  value={editData.name}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  className="input-dark mt-1"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({...editData, email: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  className="input-dark mt-1"
                  value={editData.phone_number}
                  onChange={(e) => setEditData({...editData, phone_number: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Role/Title (shown on website)</Label>
                <Input
                  className="input-dark mt-1"
                  placeholder="e.g. Head Trainer"
                  value={editData.speciality}
                  onChange={(e) => setEditData({...editData, speciality: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Speciality (shown on website)</Label>
                <Input
                  className="input-dark mt-1"
                  placeholder="e.g. Strength & Conditioning"
                  value={editData.bio}
                  onChange={(e) => setEditData({...editData, bio: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Instagram URL</Label>
                <Input
                  className="input-dark mt-1"
                  placeholder="https://instagram.com/username"
                  value={editData.instagram_url}
                  onChange={(e) => setEditData({...editData, instagram_url: e.target.value})}
                />
              </div>
              <div className="col-span-2 flex items-center gap-3 pt-2">
                <Checkbox
                  checked={editData.is_visible_on_website}
                  onCheckedChange={(checked) => setEditData({...editData, is_visible_on_website: checked})}
                />
                <Label className="text-sm text-zinc-300">Show on landing page</Label>
              </div>
            </div>

            {/* Password Change Section */}
            <div className="pt-4 border-t border-border">
              <Label className="text-xs text-muted-foreground mb-2 block">Change Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    className="input-dark pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleResetPassword}
                  disabled={newPassword.length < 6}
                >
                  Update
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export const CreateMember = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role') || 'member';
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    password: '',
    gender: '',
    date_of_birth: '',
    joining_date: today, // Default to today
    address: '',
    city: '',
    zip_code: '',
    emergency_phone: '',
    role: 'member'  // Default role
  });

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersAPI.create(formData, role);
      toast.success(`${role === 'trainer' ? 'Trainer' : 'Member'} created! Welcome message sent via Email & WhatsApp.`);
      navigate('/dashboard/admin/members');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in" data-testid="create-member-form">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Add New {role === 'trainer' ? 'Trainer' : 'Member'}
          </h1>
          <p className="text-muted-foreground">Fill in the details below. Welcome message with credentials will be sent automatically.</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                  <Input
                    data-testid="input-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email *</Label>
                  <Input
                    data-testid="input-email"
                    type="email"
                    className="input-dark mt-2"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone Number *</Label>
                  <div className="flex gap-2 mt-2">
                    <span className="flex items-center px-3 bg-muted rounded-l-md border border-r-0 border-border text-muted-foreground">
                      +91
                    </span>
                    <Input
                      data-testid="input-phone"
                      className="input-dark rounded-l-none flex-1"
                      placeholder="9876543210"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                      required
                      maxLength={10}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password *</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      data-testid="input-password"
                      type="text"
                      className="input-dark flex-1"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      placeholder="Enter or generate"
                    />
                    <Button type="button" variant="outline" onClick={generatePassword} className="shrink-0">
                      <RotateCcw size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This will be sent to the member</p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
                  <select
                    data-testid="input-gender"
                    className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Account Role</Label>
                  <select
                    data-testid="input-role"
                    className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="member">Member</option>
                    <option value="trainer">Trainer</option>
                    <option value="receptionist">Receptionist (Attendance Only)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.role === 'receptionist' ? 'Can only mark attendance - for reception desk' : 
                     formData.role === 'admin' ? 'Full admin access to all features' :
                     formData.role === 'trainer' ? 'Access to trainer dashboard and clients' : 'Regular gym member'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date of Birth</Label>
                  <Input
                    data-testid="input-dob"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Joining Date *</Label>
                  <Input
                    data-testid="input-joining-date"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Address</Label>
                  <Input
                    data-testid="input-address"
                    className="input-dark mt-2"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">City</Label>
                  <Input
                    data-testid="input-city"
                    className="input-dark mt-2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">ZIP Code</Label>
                  <Input
                    data-testid="input-zip"
                    className="input-dark mt-2"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emergency Phone</Label>
                  <Input
                    data-testid="input-emergency"
                    className="input-dark mt-2"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-400">
                  <strong>Note:</strong> After creation, the member will receive a welcome message with their login credentials via Email and WhatsApp.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={loading} data-testid="submit-btn">
                  {loading ? 'Creating...' : 'Create & Send Credentials'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

// Edit Member Component
export const EditMember = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    gender: '',
    date_of_birth: '',
    joining_date: '',
    address: '',
    city: '',
    zip_code: '',
    emergency_phone: '',
    profile_photo_url: ''
  });

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await usersAPI.getById(userId);
      const user = response.data;
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        gender: user.gender || '',
        date_of_birth: user.date_of_birth ? user.date_of_birth.split('T')[0] : '',
        joining_date: user.joining_date ? user.joining_date.split('T')[0] : '',
        address: user.address || '',
        city: user.city || '',
        zip_code: user.zip_code || '',
        emergency_phone: user.emergency_phone || '',
        profile_photo_url: user.profile_photo_url || ''
      });
    } catch (error) {
      toast.error('Failed to load user');
      navigate('/dashboard/admin/members');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }
    
    setUploading(true);
    try {
      const photoFormData = new FormData();
      photoFormData.append('file', file);
      
      const response = await uploadAPI.profilePhoto(photoFormData, userId);
      setFormData({ ...formData, profile_photo_url: response.data.profile_photo_url || response.data.url });
      toast.success('Photo uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await uploadAPI.deletePhoto(userId);
      setFormData({ ...formData, profile_photo_url: '' });
      toast.success('Photo removed');
    } catch (error) {
      toast.error('Failed to remove photo');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersAPI.update(userId, formData);
      toast.success('Member updated successfully');
      navigate('/dashboard/admin/members');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const getAvatarUrl = () => {
    if (formData.profile_photo_url) return formData.profile_photo_url;
    if (formData.gender === 'male') return MALE_AVATAR;
    if (formData.gender === 'female') return FEMALE_AVATAR;
    return DEFAULT_AVATAR;
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in" data-testid="edit-member-form">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Edit Member
          </h1>
          <p className="text-muted-foreground">Update member details and profile photo</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-4 pb-6 border-b border-border">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={getAvatarUrl()} />
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-3xl">
                    {formData.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    data-testid="upload-photo-btn"
                  >
                    <Camera size={16} className="mr-2" />
                    {uploading ? 'Uploading...' : 'Change Photo'}
                  </Button>
                  {formData.profile_photo_url && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleDeletePhoto}
                      data-testid="delete-photo-btn"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Max size: 2MB • Formats: JPG, PNG, WebP • Recommended: 300x300px
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                  <Input
                    data-testid="edit-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email *</Label>
                  <Input
                    data-testid="edit-email"
                    type="email"
                    className="input-dark mt-2"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone Number *</Label>
                  <div className="flex gap-0 mt-2">
                    <span className="flex items-center px-3 bg-muted rounded-l-md border border-r-0 border-border text-muted-foreground">
                      +91
                    </span>
                    <Input
                      data-testid="edit-phone"
                      className="input-dark rounded-l-none flex-1"
                      placeholder="9876543210"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                      required
                      maxLength={10}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
                  <select
                    data-testid="edit-gender"
                    className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date of Birth</Label>
                  <Input
                    data-testid="edit-dob"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Joining Date *</Label>
                  <Input
                    data-testid="edit-joining-date"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Address</Label>
                  <Input
                    data-testid="edit-address"
                    className="input-dark mt-2"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">City</Label>
                  <Input
                    data-testid="edit-city"
                    className="input-dark mt-2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">ZIP Code</Label>
                  <Input
                    data-testid="edit-zip"
                    className="input-dark mt-2"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emergency Phone</Label>
                  <Input
                    data-testid="edit-emergency"
                    className="input-dark mt-2"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-btn">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MembersList;
