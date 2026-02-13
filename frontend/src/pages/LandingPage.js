import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Dumbbell, Users, Clock, Award, Phone, Mail, MapPin, 
  Instagram, ChevronRight, Star, Calculator, ArrowRight,
  Activity, Heart, Zap, Target, CheckCircle
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png";
const API_URL = process.env.REACT_APP_BACKEND_URL;

// Hero Images
const heroImages = [
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920",
  "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1920",
  "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1920"
];

// Services
const services = [
  { icon: Dumbbell, title: "Strength Training", description: "State-of-the-art equipment for all fitness levels" },
  { icon: Activity, title: "Cardio Zone", description: "Treadmills, cycles, and cross trainers" },
  { icon: Users, title: "Personal Training", description: "One-on-one sessions with certified trainers" },
  { icon: Heart, title: "Group Classes", description: "Zumba, Yoga, HIIT, and more" },
  { icon: Target, title: "Weight Management", description: "Customized diet and workout plans" },
  { icon: Zap, title: "CrossFit", description: "High-intensity functional training" }
];

// Trainers
const trainers = [
  {
    name: "Rahul Sharma",
    role: "Head Trainer",
    speciality: "Strength & Conditioning",
    image: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400"
  },
  {
    name: "Priya Verma",
    role: "Fitness Coach",
    speciality: "Weight Loss & Nutrition",
    image: "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400"
  },
  {
    name: "Amit Singh",
    role: "PT Specialist",
    speciality: "Muscle Building",
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400"
  }
];

const LandingPage = () => {
  const [currentHeroImage, setCurrentHeroImage] = useState(0);
  const [testimonials, setTestimonials] = useState([]);
  const [plans, setPlans] = useState([]);

  // BMI Calculator State
  const [bmiData, setBmiData] = useState({ weight: '', height: '' });
  const [bmiResult, setBmiResult] = useState(null);

  // Calorie Calculator State
  const [calorieData, setCalorieData] = useState({
    weight: '', height: '', age: '', gender: 'male', activity_level: 'moderate'
  });
  const [calorieResult, setCalorieResult] = useState(null);

  useEffect(() => {
    // Rotate hero images
    const interval = setInterval(() => {
      setCurrentHeroImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    // Fetch data
    fetchTestimonials();
    fetchPlans();

    return () => clearInterval(interval);
  }, []);

  const fetchTestimonials = async () => {
    try {
      const response = await fetch(`${API_URL}/api/testimonials`);
      const data = await response.json();
      setTestimonials(data);
    } catch (error) {
      console.error('Failed to fetch testimonials');
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/plans?active_only=true`);
      const data = await response.json();
      setPlans(data.slice(0, 4));
    } catch (error) {
      console.error('Failed to fetch plans');
    }
  };

  const calculateBMI = async () => {
    if (!bmiData.weight || !bmiData.height) return;
    try {
      const response = await fetch(`${API_URL}/api/calculators/bmi?weight=${bmiData.weight}&height=${bmiData.height}`, {
        method: 'POST'
      });
      const data = await response.json();
      setBmiResult(data);
    } catch (error) {
      console.error('BMI calculation failed');
    }
  };

  const calculateCalories = async () => {
    if (!calorieData.weight || !calorieData.height || !calorieData.age) return;
    try {
      const params = new URLSearchParams(calorieData);
      const response = await fetch(`${API_URL}/api/calculators/maintenance-calories?${params}`, {
        method: 'POST'
      });
      const data = await response.json();
      setCalorieResult(data);
    } catch (error) {
      console.error('Calorie calculation failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={LOGO_URL} alt="F3 Fitness" className="h-10 invert" />
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#about" className="text-zinc-400 hover:text-white transition-colors">About</a>
              <a href="#services" className="text-zinc-400 hover:text-white transition-colors">Services</a>
              <a href="#trainers" className="text-zinc-400 hover:text-white transition-colors">Trainers</a>
              <a href="#calculators" className="text-zinc-400 hover:text-white transition-colors">Calculators</a>
              <a href="#contact" className="text-zinc-400 hover:text-white transition-colors">Contact</a>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10" data-testid="nav-login">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button className="bg-cyan-500 text-black hover:bg-cyan-400 font-bold" data-testid="nav-signup">
                  Join Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${heroImages[currentHeroImage]})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6" style={{ fontFamily: 'Barlow Condensed' }}>
              Transform Your
              <span className="text-cyan-400"> Body</span>,
              <br />
              Transform Your
              <span className="text-orange-500"> Life</span>
            </h1>
            <p className="text-xl text-zinc-400 mb-8 max-w-lg">
              Join Jaipur's premier fitness destination. State-of-the-art equipment, expert trainers, and a community that motivates.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup">
                <Button className="bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-lg px-8 py-6" data-testid="hero-join">
                  Start Your Journey
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <a href="#contact">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 font-bold text-lg px-8 py-6">
                  Contact Us
                </Button>
              </a>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-8 mt-12">
              <div>
                <p className="text-4xl font-bold text-cyan-400">500+</p>
                <p className="text-zinc-500">Active Members</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-orange-500">10+</p>
                <p className="text-zinc-500">Expert Trainers</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white">5★</p>
                <p className="text-zinc-500">Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-6" style={{ fontFamily: 'Barlow Condensed' }}>
                About <span className="text-cyan-400">F3 Fitness</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-6">
                Located in the heart of Vidyadhar Nagar, Jaipur, F3 Fitness Health Club is more than just a gym – it's a community dedicated to transforming lives through fitness.
              </p>
              <p className="text-zinc-400 mb-8">
                With cutting-edge equipment, certified trainers, and a motivating atmosphere, we provide everything you need to achieve your fitness goals. Whether you're a beginner or a seasoned athlete, F3 Fitness has something for everyone.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-cyan-400" />
                  <span>Modern Equipment</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-cyan-400" />
                  <span>AC Facility</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-cyan-400" />
                  <span>Personal Training</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-cyan-400" />
                  <span>Diet Consultation</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800" 
                alt="F3 Fitness Gym"
                className="rounded-xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-cyan-500 text-black p-6 rounded-xl">
                <p className="text-4xl font-bold">5+</p>
                <p className="font-semibold">Years of Excellence</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
              Our <span className="text-cyan-400">Services</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Comprehensive fitness solutions tailored to your goals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all group">
                <CardContent className="p-6">
                  <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/30 transition-colors">
                    <service.icon className="text-cyan-400" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>
                  <p className="text-zinc-400">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trainers Section */}
      <section id="trainers" className="py-24 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
              Meet Our <span className="text-orange-500">Trainers</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Certified professionals dedicated to your fitness journey
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trainers.map((trainer, index) => (
              <Card key={index} className="bg-zinc-900 border-zinc-800 overflow-hidden group">
                <div className="relative h-80 overflow-hidden">
                  <img 
                    src={trainer.image} 
                    alt={trainer.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                </div>
                <CardContent className="p-6 relative -mt-20 z-10">
                  <h3 className="text-xl font-bold text-white">{trainer.name}</h3>
                  <p className="text-cyan-400 font-semibold">{trainer.role}</p>
                  <p className="text-zinc-500 text-sm mt-1">{trainer.speciality}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Calculators Section */}
      <section id="calculators" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
              Fitness <span className="text-cyan-400">Calculators</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Track your fitness metrics with our free tools
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* BMI Calculator */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Calculator className="text-cyan-400" size={28} />
                  <h3 className="text-2xl font-bold">BMI Calculator</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <Label className="text-zinc-500">Weight (kg)</Label>
                    <Input 
                      type="number"
                      className="bg-zinc-800 border-zinc-700 mt-2"
                      placeholder="70"
                      value={bmiData.weight}
                      onChange={(e) => setBmiData({...bmiData, weight: e.target.value})}
                      data-testid="bmi-weight"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-500">Height (cm)</Label>
                    <Input 
                      type="number"
                      className="bg-zinc-800 border-zinc-700 mt-2"
                      placeholder="175"
                      value={bmiData.height}
                      onChange={(e) => setBmiData({...bmiData, height: e.target.value})}
                      data-testid="bmi-height"
                    />
                  </div>
                </div>
                
                <Button onClick={calculateBMI} className="w-full bg-cyan-500 text-black hover:bg-cyan-400" data-testid="bmi-calculate">
                  Calculate BMI
                </Button>

                {bmiResult && (
                  <div className="mt-6 p-4 bg-zinc-800 rounded-lg text-center">
                    <p className="text-4xl font-bold text-cyan-400">{bmiResult.bmi}</p>
                    <p className="text-zinc-400">{bmiResult.category}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calorie Calculator */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="text-orange-500" size={28} />
                  <h3 className="text-2xl font-bold">Calorie Calculator</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-zinc-500">Weight (kg)</Label>
                    <Input 
                      type="number"
                      className="bg-zinc-800 border-zinc-700 mt-2"
                      placeholder="70"
                      value={calorieData.weight}
                      onChange={(e) => setCalorieData({...calorieData, weight: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-500">Height (cm)</Label>
                    <Input 
                      type="number"
                      className="bg-zinc-800 border-zinc-700 mt-2"
                      placeholder="175"
                      value={calorieData.height}
                      onChange={(e) => setCalorieData({...calorieData, height: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-500">Age</Label>
                    <Input 
                      type="number"
                      className="bg-zinc-800 border-zinc-700 mt-2"
                      placeholder="25"
                      value={calorieData.age}
                      onChange={(e) => setCalorieData({...calorieData, age: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-500">Gender</Label>
                    <select 
                      className="w-full h-10 px-3 mt-2 bg-zinc-800 border border-zinc-700 rounded-md"
                      value={calorieData.gender}
                      onChange={(e) => setCalorieData({...calorieData, gender: e.target.value})}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                
                <div className="mb-6">
                  <Label className="text-zinc-500">Activity Level</Label>
                  <select 
                    className="w-full h-10 px-3 mt-2 bg-zinc-800 border border-zinc-700 rounded-md"
                    value={calorieData.activity_level}
                    onChange={(e) => setCalorieData({...calorieData, activity_level: e.target.value})}
                  >
                    <option value="sedentary">Sedentary (little/no exercise)</option>
                    <option value="light">Light (1-3 days/week)</option>
                    <option value="moderate">Moderate (3-5 days/week)</option>
                    <option value="active">Active (6-7 days/week)</option>
                    <option value="very_active">Very Active (intense daily)</option>
                  </select>
                </div>
                
                <Button onClick={calculateCalories} className="w-full bg-orange-500 text-white hover:bg-orange-400" data-testid="calorie-calculate">
                  Calculate Calories
                </Button>

                {calorieResult && (
                  <div className="mt-6 p-4 bg-zinc-800 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-red-400">{calorieResult.weight_loss}</p>
                        <p className="text-xs text-zinc-500">Weight Loss</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-cyan-400">{calorieResult.maintenance_calories}</p>
                        <p className="text-xs text-zinc-500">Maintenance</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-400">{calorieResult.weight_gain}</p>
                        <p className="text-xs text-zinc-500">Weight Gain</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
              Membership <span className="text-cyan-400">Plans</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Choose a plan that fits your fitness goals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <Card key={plan.id} className={`bg-zinc-900 border-zinc-800 ${index === 1 ? 'ring-2 ring-cyan-500' : ''}`}>
                <CardContent className="p-6">
                  {index === 1 && (
                    <span className="inline-block bg-cyan-500 text-black text-xs font-bold uppercase px-2 py-1 rounded mb-4">
                      Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-zinc-500 mb-4">{plan.duration_days} days</p>
                  <p className="text-4xl font-bold text-cyan-400 mb-6">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </p>
                  <Link to="/signup">
                    <Button className="w-full bg-zinc-800 hover:bg-zinc-700">
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4" style={{ fontFamily: 'Barlow Condensed' }}>
                What Our <span className="text-orange-500">Members</span> Say
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="text-yellow-500 fill-yellow-500" size={18} />
                      ))}
                    </div>
                    <p className="text-zinc-300 mb-4 italic">"{testimonial.content}"</p>
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-zinc-500 text-sm">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-6" style={{ fontFamily: 'Barlow Condensed' }}>
                Get In <span className="text-cyan-400">Touch</span>
              </h2>
              <p className="text-zinc-400 mb-8">
                Ready to start your fitness journey? Visit us or get in touch!
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Address</p>
                    <p className="text-zinc-400">4th Avenue Plot No 4R-B, Mode, near Mandir Marg, Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Phone</p>
                    <a href="tel:07230052193" className="text-cyan-400 hover:text-cyan-300">072300 52193</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Email</p>
                    <a href="mailto:info@f3fitness.in" className="text-cyan-400 hover:text-cyan-300">info@f3fitness.in</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Instagram className="text-pink-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Instagram</p>
                    <a href="https://instagram.com/f3fitnessclub" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">@f3fitnessclub</a>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <p className="font-semibold text-white mb-2">Opening Hours</p>
                <p className="text-zinc-400">Monday - Saturday: 5:00 AM - 10:00 PM</p>
                <p className="text-zinc-400">Sunday: 6:00 AM - 12:00 PM</p>
              </div>
            </div>

            <div>
              {/* Google Maps Embed */}
              <div className="rounded-xl overflow-hidden h-[400px]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3556.1234567890123!2d75.8234567!3d26.9456789!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjbCsDU2JzQ0LjQiTiA3NcKwNDknMjQuNCJF!5e0!3m2!1sen!2sin!4v1234567890123"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="F3 Fitness Location"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-orange-500/20" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6" style={{ fontFamily: 'Barlow Condensed' }}>
            Ready to Transform?
          </h2>
          <p className="text-xl text-zinc-400 mb-8">
            Join F3 Fitness today and start your journey to a healthier, stronger you.
          </p>
          <Link to="/signup">
            <Button className="bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-lg px-12 py-6">
              Start Free Trial
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="F3 Fitness" className="h-10 invert" />
              <p className="text-zinc-500">© 2024 F3 Fitness Health Club. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://instagram.com/f3fitnessclub" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-400">
                <Instagram size={24} />
              </a>
              <a href="tel:07230052193" className="text-zinc-500 hover:text-cyan-400">
                <Phone size={24} />
              </a>
              <a href="mailto:info@f3fitness.in" className="text-zinc-500 hover:text-cyan-400">
                <Mail size={24} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
