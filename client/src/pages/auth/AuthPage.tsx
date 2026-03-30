import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import styles from './AuthPage.module.css';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.78h5.4a4.6 4.6 0 0 1-2 3.04v2.52h3.22c1.89-1.74 2.98-4.3 2.98-7.34Z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.22-2.52c-.9.6-2.04.96-3.4.96-2.6 0-4.8-1.76-5.6-4.12H1.08v2.6A10 10 0 0 0 10 20Z"
        fill="#34A853"
      />
      <path
        d="M4.4 11.89A6.02 6.02 0 0 1 4.08 10c0-.66.12-1.3.32-1.9V5.5H1.08A10 10 0 0 0 0 10c0 1.62.38 3.14 1.08 4.5l3.32-2.61Z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.98c1.46 0 2.78.5 3.8 1.5l2.84-2.84A9.95 9.95 0 0 0 10 0 10 10 0 0 0 1.08 5.5L4.4 8.1C5.2 5.74 7.4 3.98 10 3.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}


function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M2 7l8 5 8-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function AuthPage() {
  const { loginAsGuest, loginWithGoogle, sendEmailLink } = useAuth();
  const navigate = useNavigate();
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const handleGuestLogin = async () => {
    try {
      await loginAsGuest();
      navigate('/dashboard');
    } catch {
      navigate('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Google login failed');
    }
  };

  const handleSendEmailLink = async () => {
    if (!email) return;
    setEmailSending(true);
    try {
      await sendEmailLink(email);
      toast.success('Sign-in link sent — check your inbox');
      setShowEmailInput(false);
      setEmail('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send sign-in link');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className={styles.authPage}>
      {/* Blurred background - mimics the dashboard behind the modal */}
      <div className={styles.authPageBg} aria-hidden="true">
        <div className="auth-page__bg-blur">
          {/* Faux header */}
          <div className={styles.authPageFauxHeader}>
            <div className={styles.authPageFauxLogo} />
            <div className={styles.authPageFauxNav} />
          </div>
          {/* Faux action bar */}
          <div className={styles.authPageFauxActionbar}>
            <div className={styles.authPageFauxStatus} />
            <div className={styles.authPageFauxSpacer} />
            <div className={styles.authPageFauxSearch} />
            <div className={styles.authPageFauxAdd} />
          </div>
          {/* Faux filter pills */}
          <div className={styles.authPageFauxFilters}>
            <div className={cn(styles.authPageFauxPill, styles.authPageFauxPillActive)} />
            <div className={styles.authPageFauxPill} />
            <div className={styles.authPageFauxPill} />
          </div>
          {/* Faux cards */}
          <div className={styles.authPageFauxCards}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.authPageFauxCard} />
            ))}
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div className="auth-page__overlay" />

      {/* Modal card */}
      <div className="auth-page__modal">
        {/* Title */}
        <h1 className={styles.authPageTitle}>
          HOOKLAB
        </h1>

        {/* Description */}
        <p className={styles.authPageDesc}>
          Stop guessing what happens when an API fires and take full control of your integration
          lifecycle. Our platform lets you instantly <strong className={styles.authPageBold}>test</strong> endpoints,{' '}
          <strong className={styles.authPageBold}>record</strong> every payload for deep-dive
          debugging, and <strong className={styles.authPageBold}>replay</strong> requests to
          verify fixes without re-triggering the source. By allowing you to transform data on the
          fly, we ensure every webhook arrives exactly how your system needs it, turning a
          &quot;black box&quot; process into a transparent, programmable workflow.
        </p>

        {/* Auth buttons */}
        <div className={styles.authPageButtons}>
          <button
            onClick={handleGoogleLogin}
            className={styles.authPageProviderBtn}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            onClick={handleComingSoon}
            className={styles.authPageProviderBtn}
          >
            <EmailIcon />
            Continue with Email Link
          </button>
        </div>

        {/* Guest link */}
        <div className={styles.authPageGuest}>
          <button
            onClick={handleGuestLogin}
            className={styles.authPageGuestBtn}
          >
            Continue as <strong className={styles.authPageBold}>Guest</strong>
          </button>
        </div>
      </div>
    </div>
  );
}
