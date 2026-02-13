import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { usersAPI, uploadAPI } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Camera, Save, User, Mail, Phone, MapPin, Calendar, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const AdminProfile = () => <ProfilePage role="admin" />;
export const MemberProfile = () => <ProfilePage role="member" />;
export const TrainerProfile = () => <ProfilePage role="trainer" />;

const ProfilePage = ({ role }) => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    gender: '',
    date_of_birth: '',
    address: '',
    city: '',
    zip_code: '',
    emergency_phone: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone_number: user.phone_number || '',
        gender: user.gender || '',
        date_of_birth: user.date_of_birth || '',
        address: user.address || '',
        city: user.city || '',
        zip_code: user.zip_code || '',
        emergency_phone: user.emergency_phone || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await usersAPI.update(user.id, formData);
      updateUser(response.data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
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

    setUploadingPhoto(true);
    try {
      const response = await uploadAPI.profilePhoto(file);
      const updatedUser = { ...user, profile_photo_url: response.data.profile_photo_url };
      updateUser(updatedUser);
      toast.success('Photo uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout role={role}>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="profile-page">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            My Profile
          </h1>
          <p className="text-zinc-500">Manage your personal information</p>
        </div>

        {/* Profile Header */}
        <Card className="highlight-card">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <Avatar className="w-32 h-32">
                  <AvatarImage src={user.profile_photo_url} />
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-4xl">
                    {user.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full cursor-pointer hover:bg-cyan-400 transition-colors">
                  <Camera size={20} className="text-black" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    data-testid="photo-upload"
                  />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                <p className="text-cyan-400 font-mono text-lg">{user.member_id}</p>
                <p className="text-zinc-500 capitalize">{user.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Full Name</Label>
                  <Input
                    data-testid="profile-name"
                    className="input-dark mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
                  <Input
                    className="input-dark mt-2 bg-zinc-900/30"
                    value={user.email}
                    disabled
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Phone Number</Label>
                  <Input
                    data-testid="profile-phone"
                    className="input-dark mt-2"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Gender</Label>
                  <select
                    data-testid="profile-gender"
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
                    data-testid="profile-dob"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Emergency Contact</Label>
                  <Input
                    data-testid="profile-emergency"
                    className="input-dark mt-2"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Address</Label>
                  <Input
                    data-testid="profile-address"
                    className="input-dark mt-2"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">City</Label>
                  <Input
                    data-testid="profile-city"
                    className="input-dark mt-2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">ZIP Code</Label>
                  <Input
                    data-testid="profile-zip"
                    className="input-dark mt-2"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
              </div>

              <Button type="submit" className="btn-primary" disabled={loading} data-testid="save-profile-btn">
                <Save size={18} className="mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-zinc-500">Member ID</p>
                <p className="text-cyan-400 font-mono text-lg">{user.member_id}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Role</p>
                <p className="text-white capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Joining Date</p>
                <p className="text-white">{formatDate(user.joining_date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Account Created</p>
                <p className="text-white">{formatDate(user.created_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminProfile;
