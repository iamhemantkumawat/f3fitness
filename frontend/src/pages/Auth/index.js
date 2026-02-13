import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Dumbbell, ArrowRight } from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png";

export const Login = () => {
  const [formData, setFormData] = useState({ email_or_phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigateByRole(user.role);
    }
  }, [user, navigate]);

  const navigateByRole = (role) => {
    switch (role) {
      case 'admin':
        navigate('/admin');
        break;
      case 'trainer':
        navigate('/trainer');
        break;
      default:
        navigate('/member');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userData = await login(formData);
      toast.success('Welcome back!');
      navigateByRole(userData.role);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1741940513798-4ce04b95ffda?w=1200)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <img src={LOGO_URL} alt="F3 Fitness" className="w-48 mb-8 invert" />
          <h1 className="text-5xl font-black uppercase tracking-tighter text-white mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
            Transform Your
            <span className="text-cyan-400"> Body</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md">
            Join Jaipur's premier fitness community. Your journey to a stronger you starts here.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <img src={LOGO_URL} alt="F3 Fitness" className="w-32 mx-auto mb-4 invert" />
          </div>
          
          <div className="glass-card p-8">
            <h2 className="text-3xl font-bold uppercase tracking-tight mb-2" style={{ fontFamily: 'Barlow Condensed' }}>
              Welcome Back
            </h2>
            <p className="text-zinc-500 mb-8">Sign in to your account</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Email or Phone</Label>
                <Input
                  data-testid="login-email-input"
                  type="text"
                  className="input-dark mt-2"
                  placeholder="Enter email or phone number"
                  value={formData.email_or_phone}
                  onChange={(e) => setFormData({ ...formData, email_or_phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Password</Label>
                <div className="relative mt-2">
                  <Input
                    data-testid="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    className="input-dark pr-10"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300">
                  Forgot password?
                </Link>
              </div>

              <Button
                data-testid="login-submit-btn"
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </form>

            <p className="text-center text-zinc-500 mt-6">
              Don't have an account?{' '}
              <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    password: '',
    gender: '',
    date_of_birth: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(formData);
      toast.success('Account created successfully!');
      navigate('/member');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1709315957145-a4bad1feef28?w=1200)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <img src={LOGO_URL} alt="F3 Fitness" className="w-48 mb-8 invert" />
          <h1 className="text-5xl font-black uppercase tracking-tighter text-white mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
            Start Your
            <span className="text-orange-500"> Journey</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md">
            Join thousands of members who have transformed their lives at F3 Fitness Gym.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <img src={LOGO_URL} alt="F3 Fitness" className="w-32 mx-auto mb-4 invert" />
          </div>

          <div className="glass-card p-8">
            <h2 className="text-3xl font-bold uppercase tracking-tight mb-2" style={{ fontFamily: 'Barlow Condensed' }}>
              Create Account
            </h2>
            <p className="text-zinc-500 mb-6">Join F3 Fitness Gym today</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Full Name</Label>
                <Input
                  data-testid="signup-name-input"
                  type="text"
                  className="input-dark mt-2"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
                <Input
                  data-testid="signup-email-input"
                  type="email"
                  className="input-dark mt-2"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Phone Number</Label>
                <Input
                  data-testid="signup-phone-input"
                  type="tel"
                  className="input-dark mt-2"
                  placeholder="Enter phone number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Gender</Label>
                  <select
                    data-testid="signup-gender-select"
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
                    data-testid="signup-dob-input"
                    type="date"
                    className="input-dark mt-2"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Password</Label>
                <div className="relative mt-2">
                  <Input
                    data-testid="signup-password-input"
                    type={showPassword ? 'text' : 'password'}
                    className="input-dark pr-10"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                data-testid="signup-submit-btn"
                type="submit"
                className="btn-primary w-full mt-6"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </form>

            <p className="text-center text-zinc-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
      toast.success('Reset link sent to your email');
    } catch (error) {
      toast.error('Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="F3 Fitness" className="w-32 mx-auto mb-4 invert" />
        </div>

        <div className="glass-card p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="text-cyan-400" size={32} />
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-tight mb-2" style={{ fontFamily: 'Barlow Condensed' }}>
                Check Your Email
              </h2>
              <p className="text-zinc-500 mb-6">
                We've sent a password reset link to {email}
              </p>
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold uppercase tracking-tight mb-2" style={{ fontFamily: 'Barlow Condensed' }}>
                Forgot Password?
              </h2>
              <p className="text-zinc-500 mb-6">Enter your email to reset your password</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
                  <Input
                    data-testid="forgot-email-input"
                    type="email"
                    className="input-dark mt-2"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  data-testid="forgot-submit-btn"
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              <p className="text-center text-zinc-500 mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const authAPI = {
  forgotPassword: async (data) => {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
