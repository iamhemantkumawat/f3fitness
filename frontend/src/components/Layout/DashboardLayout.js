import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  Settings,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Dumbbell,
  Bell,
  ClipboardList,
  UserCheck,
  Receipt,
  Clock,
  CalendarDays,
  Mail,
  MessageSquare
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png";

const adminMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/admin' },
  {
    label: 'Members & Staff',
    icon: Users,
    children: [
      { label: 'All Members', path: '/dashboard/admin/members' },
      { label: 'Trainers', path: '/dashboard/admin/trainers' },
      { label: 'Add New', path: '/dashboard/admin/members/new' }
    ]
  },
  {
    label: 'Payment Management',
    icon: CreditCard,
    children: [
      { label: 'All Payments', path: '/dashboard/admin/payments' },
      { label: 'Add Payment', path: '/dashboard/admin/payments/new' },
      { label: 'Payment Reports', path: '/dashboard/admin/payments/reports' },
      { label: 'Pending Requests', path: '/dashboard/admin/payments/pending' }
    ]
  },
  {
    label: 'Attendance',
    icon: UserCheck,
    children: [
      { label: 'Mark Attendance', path: '/dashboard/admin/attendance' },
      { label: 'Today\'s Report', path: '/dashboard/admin/attendance/today' },
      { label: 'Attendance History', path: '/dashboard/admin/attendance/history' }
    ]
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Plans', path: '/dashboard/admin/settings/plans' },
      { label: 'Announcements', path: '/dashboard/admin/settings/announcements' },
      { label: 'Holidays', path: '/dashboard/admin/settings/holidays' },
      { label: 'SMTP Settings', path: '/dashboard/admin/settings/smtp' },
      { label: 'WhatsApp Settings', path: '/dashboard/admin/settings/whatsapp' }
    ]
  },
  { label: 'My Profile', icon: User, path: '/dashboard/admin/profile' }
];

const memberMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/member' },
  { label: 'Plans', icon: ClipboardList, path: '/dashboard/member/plans' },
  { label: 'My Profile', icon: User, path: '/dashboard/member/profile' }
];

const trainerMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/trainer' },
  { label: 'My Clients', icon: Users, path: '/dashboard/trainer/clients' },
  { label: 'My Profile', icon: User, path: '/dashboard/trainer/profile' }
];

const SidebarItem = ({ item, isActive, isChild = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const location = useLocation();

  const isParentActive = hasChildren && item.children.some(child => location.pathname === child.path);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`sidebar-link w-full ${isParentActive ? 'active' : ''}`}
          data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <item.icon size={20} />
          <span className="flex-1 text-left">{item.label}</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {isOpen && (
          <div className="ml-8 mt-1 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                className={`sidebar-link text-sm ${location.pathname === child.path ? 'active' : ''}`}
                data-testid={`sidebar-${child.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      className={`sidebar-link ${isActive ? 'active' : ''} ${isChild ? 'text-sm ml-8' : ''}`}
      data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <item.icon size={20} />
      <span>{item.label}</span>
    </Link>
  );
};

const Sidebar = ({ menuItems, isMobileOpen, setIsMobileOpen }) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card/50 backdrop-blur-xl border-r border-white/5 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={LOGO_URL} alt="F3 Fitness" className="h-10 invert" />
          </Link>
        </div>

        <nav className="px-4 space-y-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              isActive={location.pathname === item.path}
            />
          ))}
        </nav>
      </aside>
    </>
  );
};

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-card/30 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
          data-testid="mobile-menu-btn"
        >
          <Menu size={24} />
        </button>
        
        <div className="hidden sm:flex items-center gap-2 text-zinc-400">
          <Clock size={18} />
          <span className="font-mono text-sm">
            {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="font-mono text-lg text-cyan-400">
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-white/5 rounded-lg p-2" data-testid="user-dropdown">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profile_photo_url} />
            <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
          </div>
          <ChevronDown size={16} className="text-zinc-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-card border-zinc-800">
          <DropdownMenuItem className="text-zinc-400">
            <span className="text-xs uppercase tracking-wider">ID: {user?.member_id}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            onClick={() => navigate(`/${user?.role}/profile`)}
            className="cursor-pointer"
            data-testid="profile-link"
          >
            <User size={16} className="mr-2" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-red-400"
            data-testid="logout-btn"
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export const DashboardLayout = ({ children, role }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const menuItems = {
    admin: adminMenuItems,
    member: memberMenuItems,
    trainer: trainerMenuItems
  }[role] || memberMenuItems;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        menuItems={menuItems}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      
      <div className="lg:ml-64">
        <Header onMenuClick={() => setIsMobileOpen(true)} />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
