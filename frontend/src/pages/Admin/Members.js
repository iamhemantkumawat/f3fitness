import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { usersAPI, membershipsAPI, trainerAPI } from '../../lib/api';
import { formatDate, getStatusBadge } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { 
  Search, Plus, User, Phone, Mail, Calendar, MapPin, 
  CreditCard, UserPlus, Edit, Trash2, Eye, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export const MembersList = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [membershipData, setMembershipData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async (searchQuery = '') => {
    try {
      const response = await usersAPI.getAll({ role: 'member', search: searchQuery });
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

  const openMemberDetail = async (member) => {
    setSelectedMember(member);
    try {
      const response = await membershipsAPI.getActive(member.id);
      setMembershipData(response.data);
    } catch (error) {
      setMembershipData(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      await usersAPI.delete(id);
      toast.success('Member deleted');
      fetchMembers();
      setSelectedMember(null);
    } catch (error) {
      toast.error('Failed to delete member');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="members-list">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Members
            </h1>
            <p className="text-zinc-500">Manage gym members</p>
          </div>
          <Button 
            className="btn-primary" 
            onClick={() => navigate('/dashboard/admin/members/new')}
            data-testid="add-member-btn"
          >
            <Plus size={18} className="mr-2" />
            Add Member
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input
            data-testid="member-search"
            className="input-dark pl-10"
            placeholder="Search by name, email, phone or member ID..."
            value={search}
            onChange={handleSearch}
          />
        </div>

        {/* Members Table */}
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Member ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Plan</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th className="pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="pl-6">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-zinc-500 py-8 pl-6">
                      No members found
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr 
                      key={member.id} 
                      className="cursor-pointer hover:bg-white/5"
                      onClick={() => openMemberDetail(member)}
                      data-testid={`member-row-${member.member_id}`}
                    >
                      <td className="pl-6 font-mono text-cyan-400">{member.member_id}</td>
                      <td className="font-medium text-white">{member.name}</td>
                      <td className="text-zinc-400">{member.phone_number}</td>
                      <td className="text-zinc-400">-</td>
                      <td className="text-zinc-400">-</td>
                      <td><span className="badge-pending">New</span></td>
                      <td className="pr-6">
                        <button className="text-zinc-500 hover:text-white">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Member Detail Sheet */}
        <Sheet open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <SheetContent className="bg-card border-zinc-800 w-full sm:max-w-lg overflow-y-auto">
            {selectedMember && (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="text-2xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                    Member Details
                  </SheetTitle>
                </SheetHeader>

                {/* Profile Section */}
                <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-lg">
                  <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-cyan-400">
                      {selectedMember.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedMember.name}</h3>
                    <p className="text-cyan-400 font-mono">{selectedMember.member_id}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Contact Info</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Mail size={16} />
                      <span>{selectedMember.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Phone size={16} />
                      <span>{selectedMember.phone_number}</span>
                    </div>
                    {selectedMember.address && (
                      <div className="flex items-center gap-3 text-zinc-400">
                        <MapPin size={16} />
                        <span>{selectedMember.address}, {selectedMember.city}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Personal Info */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Personal Info</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Gender</p>
                      <p className="text-white capitalize">{selectedMember.gender || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Date of Birth</p>
                      <p className="text-white">{formatDate(selectedMember.date_of_birth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Joining Date</p>
                      <p className="text-white">{formatDate(selectedMember.joining_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Emergency Contact</p>
                      <p className="text-white">{selectedMember.emergency_phone || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Membership Info */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Membership</h4>
                  {membershipData ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{membershipData.plan_name}</span>
                        <span className="badge-active">{membershipData.status}</span>
                      </div>
                      <p className="text-sm text-zinc-400">
                        {formatDate(membershipData.start_date)} - {formatDate(membershipData.end_date)}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-zinc-900/50 rounded-lg text-center">
                      <p className="text-zinc-500 mb-3">No active membership</p>
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

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-zinc-800">
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
                    onClick={() => handleDelete(selectedMember.id)}
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
      </div>
    </DashboardLayout>
  );
};

export const TrainersList = () => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in" data-testid="trainers-list">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Trainers
            </h1>
            <p className="text-zinc-500">Manage gym trainers</p>
          </div>
          <Button 
            className="btn-primary" 
            onClick={() => navigate('/admin/members/new?role=trainer')}
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
                  <div className="h-20 bg-zinc-800 rounded" />
                </CardContent>
              </Card>
            ))
          ) : trainers.length === 0 ? (
            <Card className="glass-card col-span-full">
              <CardContent className="p-8 text-center text-zinc-500">
                No trainers found. Add your first trainer!
              </CardContent>
            </Card>
          ) : (
            trainers.map((trainer) => (
              <Card key={trainer.id} className="glass-card hover:border-white/10 transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-orange-400">
                        {trainer.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{trainer.name}</h3>
                      <p className="text-sm text-cyan-400 font-mono">{trainer.member_id}</p>
                      <p className="text-sm text-zinc-500">{trainer.phone_number}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const CreateMember = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role') || 'member';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    password: '',
    gender: '',
    date_of_birth: '',
    address: '',
    city: '',
    zip_code: '',
    emergency_phone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersAPI.create(formData, role);
      toast.success(`${role === 'trainer' ? 'Trainer' : 'Member'} created successfully`);
      navigate('/admin/members');
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
          <p className="text-zinc-500">Fill in the details below</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Full Name *</Label>
                  <Input
                    data-testid="input-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Email *</Label>
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
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Phone Number *</Label>
                  <Input
                    data-testid="input-phone"
                    className="input-dark mt-2"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Password *</Label>
                  <Input
                    data-testid="input-password"
                    type="password"
                    className="input-dark mt-2"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Gender</Label>
                  <select
                    data-testid="input-gender"
                    className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-zinc-900/50 border border-zinc-800"
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
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Date of Birth</Label>
                  <Input
                    data-testid="input-dob"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Address</Label>
                  <Input
                    data-testid="input-address"
                    className="input-dark mt-2"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">City</Label>
                  <Input
                    data-testid="input-city"
                    className="input-dark mt-2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">ZIP Code</Label>
                  <Input
                    data-testid="input-zip"
                    className="input-dark mt-2"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Emergency Phone</Label>
                  <Input
                    data-testid="input-emergency"
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
                <Button type="submit" className="btn-primary" disabled={loading} data-testid="submit-btn">
                  {loading ? 'Creating...' : 'Create'}
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
