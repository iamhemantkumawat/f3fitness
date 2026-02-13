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
  const [step, setStep] = useState(1); // 1: Details, 2: OTP Verification
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    country_code: '+91',
    password: '',
    gender: '',
    date_of_birth: ''
  });
  const [otp, setOtp] = useState(''); // Single OTP for both channels
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const sendOTP = async () => {
    setOtpSending(true);
    
    const makeRequest = (url, body) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function() {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, data, status: xhr.status });
          } catch (e) {
            resolve({ ok: false, data: { detail: 'Server error' }, status: xhr.status });
          }
        };
        xhr.onerror = function() {
          reject(new Error('Network error'));
        };
        xhr.send(JSON.stringify(body));
      });
    };
    
    try {
      const result = await makeRequest(
        `${process.env.REACT_APP_BACKEND_URL}/api/otp/send`,
        {
          phone_number: formData.phone_number,
          country_code: formData.country_code,
          email: formData.email
        }
      );
      
      if (!result.ok) {
        throw new Error(result.data.detail || 'Failed to send OTP');
      }
      
      toast.success('OTP sent to your phone and email!');
      setStep(2);
      setResendTimer(60);
    } catch (error) {
      console.error('SendOTP error:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    if (!formData.name || !formData.email || !formData.phone_number || !formData.password) {
      toast.error('Please fill all required fields');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    await sendOTP();
  };

  const handleVerifyAndSignup = async (e) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    
    const makeRequest = (url, body) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function() {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, data, status: xhr.status });
          } catch (e) {
            resolve({ ok: false, data: { detail: 'Server error' }, status: xhr.status });
          }
        };
        xhr.onerror = function() {
          reject(new Error('Network error'));
        };
        xhr.send(JSON.stringify(body));
      });
    };
    
    setLoading(true);
    try {
      // Verify OTP first
      const verifyResult = await makeRequest(
        `${process.env.REACT_APP_BACKEND_URL}/api/otp/verify`,
        {
          phone_number: formData.phone_number,
          country_code: formData.country_code,
          phone_otp: otp,
          email: formData.email,
          email_otp: otp
        }
      );
      
      if (!verifyResult.ok) {
        throw new Error(verifyResult.data.detail || 'Invalid OTP');
      }
      
      // Signup with verified OTP
      const signupResult = await makeRequest(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/signup-with-otp`,
        {
          ...formData,
          phone_otp: otp,
          email_otp: otp
        }
      );
      
      if (!signupResult.ok) {
        throw new Error(signupResult.data.detail || 'Signup failed');
      }
      
      localStorage.setItem('token', signupResult.data.token);
      localStorage.setItem('user', JSON.stringify(signupResult.data.user));
      
      toast.success('Account created successfully!');
      navigate('/dashboard/member');
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Signup failed');
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
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-cyan-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}>1</div>
              <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-cyan-500' : 'bg-zinc-700'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-cyan-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}>2</div>
            </div>

            {step === 1 ? (
              <>
                <h2 className="text-3xl font-bold uppercase tracking-tight mb-2" style={{ fontFamily: 'Barlow Condensed' }}>
                  Create Account
                </h2>
                <p className="text-zinc-500 mb-6">Join F3 Fitness Gym today</p>

                <form onSubmit={handleStep1Submit} className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Full Name *</Label>
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
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Email *</Label>
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
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Phone Number *</Label>
                    <div className="flex gap-2 mt-2">
                      <select
                        data-testid="signup-country-code-select"
                        className="input-dark w-24 h-10 px-2 rounded-md bg-zinc-900/50 border border-zinc-800 text-sm"
                        value={formData.country_code}
                        onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      >
                        <option value="+91">+91</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                        <option value="+971">+971</option>
                      </select>
                      <Input
                        data-testid="signup-phone-input"
                        type="tel"
                        className="input-dark flex-1"
                        placeholder="9876543210"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                        required
                        maxLength={10}
                      />
                    </div>
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
                    <Label className="text-xs uppercase tracking-wider text-zinc-500">Password *</Label>
                    <div className="relative mt-2">
                      <Input
                        data-testid="signup-password-input"
                        type={showPassword ? 'text' : 'password'}
                        className="input-dark pr-10"
                        placeholder="Create a password (min 6 chars)"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
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
                    data-testid="signup-send-otp-btn"
                    type="submit"
                    className="btn-primary w-full mt-6"
                    disabled={otpSending}
                  >
                    {otpSending ? 'Sending OTP...' : 'Continue & Verify'}
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                </form>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="text-zinc-500 hover:text-white mb-4 flex items-center gap-2 text-sm"
                >
                  <ArrowRight size={16} className="rotate-180" /> Back to details
                </button>
                
                <h2 className="text-3xl font-bold uppercase tracking-tight mb-2" style={{ fontFamily: 'Barlow Condensed' }}>
                  Verify OTP
                </h2>
                <p className="text-zinc-500 mb-6">
                  Enter the OTP sent to your phone ({formData.country_code} {formData.phone_number}) and email ({formData.email})
                </p>

                <form onSubmit={handleVerifyAndSignup} className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-zinc-500 flex items-center justify-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-cyan-500/20 text-cyan-400 rounded text-xs">OTP</span>
                      Enter 6-digit OTP
                    </Label>
                    <Input
                      data-testid="signup-otp-input"
                      type="text"
                      className="input-dark text-center text-3xl tracking-[0.8em] font-mono py-6"
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      required
                      autoFocus
                    />
                    <p className="text-xs text-zinc-500 text-center mt-2">
                      Same OTP has been sent to both WhatsApp and Email
                    </p>
                  </div>

                  <div className="text-center">
                    {resendTimer > 0 ? (
                      <p className="text-zinc-500 text-sm">
                        Resend OTP in <span className="text-cyan-400 font-mono">{resendTimer}s</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={sendOTP}
                        disabled={otpSending}
                        className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold"
                      >
                        {otpSending ? 'Sending...' : 'Resend OTP'}
                      </button>
                    )}
                  </div>

                  <Button
                    data-testid="signup-verify-btn"
                    type="submit"
                    className="btn-primary w-full mt-6"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Verify & Create Account'}
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                </form>
              </>
            )}

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
