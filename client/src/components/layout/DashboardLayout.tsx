import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Webhook,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import styles from './DashboardLayout.module.css';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Endpoints',
    href: '/dashboard',
    icon: Webhook,
  },
];

interface SidebarContentProps {
  pathname: string;
  handleLogout: () => void;
  user: { email?: string | null } | null;
  isAnonymous: boolean;
  setMobileOpen: (open: boolean) => void;
}

function getInitials(email: string) {
  return email
    .split('@')[0]
    .substring(0, 2)
    .toUpperCase();
}

function isActivePath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(path + '/');
}

function SidebarContent({ pathname, handleLogout, user, setMobileOpen }: SidebarContentProps) {
  return (
    <div className={styles.dashLayoutSidebarInner}>
      {/* Logo */}
      <div className={styles.dashLayoutSidebarLogo}>
        <Webhook className={styles.dashLayoutSidebarLogoIcon} />
        <span className={styles.dashLayoutSidebarLogoText}>Hooklab</span>
      </div>

      {/* Navigation */}
      <ScrollArea className={styles.dashLayoutSidebarScroll}>
        <nav className={styles.dashLayoutNavGroup}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  styles.dashLayoutNavLink,
                  isActive && styles.dashLayoutNavLinkActive,
                )}
              >
                <Icon className={styles.dashLayoutNavIcon} />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <Separator className={styles.dashLayoutNavSep} />

        <nav className={styles.dashLayoutNavGroup}>
          <Link
            to="/dashboard/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              styles.dashLayoutNavLink,
              isActivePath(pathname, '/dashboard/settings') && styles.dashLayoutNavLinkActive,
            )}
          >
            <Settings className={styles.dashLayoutNavIcon} />
            Settings
          </Link>
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className={styles.dashLayoutUserSection}>
        <div className={styles.dashLayoutUserCard}>
          <Avatar className={styles.dashLayoutUserAvatar}>
            <AvatarFallback className={styles.dashLayoutUserAvatarFallback}>
              {user?.email ? getInitials(user.email) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className={styles.dashLayoutUserInfo}>
            <p className={styles.dashLayoutUserEmail}>{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className={styles.dashLayoutUserLogout}
            title="Sign out"
          >
            <LogOut className={styles.dashLayoutUserLogoutIcon} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const isAnonymous = !user?.email;

  return (
    <div className={styles.dashLayout}>
      {/* Desktop Sidebar */}
      <aside className={styles.dashLayoutSidebarDesktop}>
        <SidebarContent pathname={location.pathname} handleLogout={handleLogout} user={user} isAnonymous={isAnonymous} setMobileOpen={setSidebarOpen} />
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className={styles.dashLayoutMobileOverlayWrap}>
          <div
            role="button"
            tabIndex={0}
            className={styles.dashLayoutMobileBackdrop}
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSidebarOpen(false); }}
          />
          <aside className={styles.dashLayoutMobileSidebar}>
            <div className={styles.dashLayoutMobileSidebarHeader}>
              <div className={styles.dashLayoutSidebarLogo}>
                <Webhook className={styles.dashLayoutSidebarLogoIcon} />
                <span className={styles.dashLayoutSidebarLogoText}>Hooklab</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className={styles.dashLayoutCloseIcon} />
              </Button>
            </div>
            <div className={styles.dashLayoutMobileSidebarBody}>
              <SidebarContent pathname={location.pathname} handleLogout={handleLogout} user={user} isAnonymous={isAnonymous} setMobileOpen={setSidebarOpen} />
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className={styles.dashLayoutMain}>
        {/* Header */}
        <header className={styles.dashLayoutHeader}>
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className={styles.dashLayoutMobileMenuBtn}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className={styles.dashLayoutMobileMenuIcon} />
          </Button>

          {/* Breadcrumb or Title */}
          <div className={styles.dashLayoutBreadcrumb}>
            <Link to="/dashboard" className={styles.dashLayoutBreadcrumbLink}>
              Dashboard
            </Link>
            {location.pathname !== '/dashboard' && (
              <>
                <ChevronRight className={styles.dashLayoutBreadcrumbSep} />
                <span className={styles.dashLayoutBreadcrumbCurrent}>
                  {location.pathname.includes('/endpoint/')
                    ? 'Endpoint Details'
                    : location.pathname.split('/').pop()}
                </span>
              </>
            )}
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={styles.dashLayoutAvatarBtn}>
                <Avatar className={styles.dashLayoutHeaderAvatar}>
                  <AvatarFallback>
                    {user?.email ? getInitials(user.email) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.dashLayoutDropdown}>
              <DropdownMenuLabel>
                <div className={styles.dashLayoutDropdownLabel}>
                  <p className={styles.dashLayoutDropdownName}>My Account</p>
                  <p className={styles.dashLayoutDropdownEmail}>
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                <Settings className={styles.dashLayoutDropdownIcon} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className={styles.dashLayoutDropdownIcon} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className={styles.dashLayoutContent}>
          <div className={styles.dashLayoutContentInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
