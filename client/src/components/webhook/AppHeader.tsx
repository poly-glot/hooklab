import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { User, LogOut } from 'lucide-react';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import styles from './AppHeader.module.css';

export function AppHeader() {
  const { user, isAnonymous, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  const isDashboard = location.pathname === '/dashboard';

  return (
    <header role="banner" className={styles.appHeader}>
      <button
        onClick={() => navigate('/')}
        className={styles.appHeaderLogo}
      >
        Hooklab
      </button>

      <div className={styles.appHeaderRight}>
        {user && (
          <>
            {!isDashboard && (
              <button
                onClick={() => navigate('/dashboard')}
                className={styles.appHeaderNavLink}
              >
                Dashboard
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard/reports')}
              className={styles.appHeaderNavLink}
            >
              Reports
            </button>
            <div className={styles.appHeaderUser}>
              <User className={styles.appHeaderUserIcon} />
              <span className={styles.appHeaderUserName}>
                {isAnonymous ? 'Guest' : user.email}
              </span>
            </div>
            <a
              href="https://github.com/nicholasadamou/webhook"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.appHeaderGithub}
              aria-label="GitHub"
            >
              <GitHubIcon className={styles.appHeaderGithubIcon} />
            </a>
            <button
              onClick={handleSignOut}
              className={styles.appHeaderNavLink}
              aria-label="Sign out"
            >
              <LogOut className={styles.appHeaderSignOutIcon} />
            </button>
          </>
        )}
        {!user && (
          <a
            href="https://github.com/nicholasadamou/webhook"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.appHeaderGithub}
            aria-label="GitHub"
          >
            <GitHubIcon className={styles.appHeaderGithubIcon} />
          </a>
        )}
      </div>
    </header>
  );
}
