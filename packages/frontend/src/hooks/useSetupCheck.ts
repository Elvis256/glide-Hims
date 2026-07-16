import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setupService, type SetupStatus } from '../services/setup';

/**
 * Hook to check if system setup is complete.
 * Redirects to /setup if setup is not complete.
 */
export function useSetupCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  useEffect(() => {
    // Don't check if already on setup page
    if (location.pathname === '/setup') {
      setIsChecking(false);
      return;
    }

    const checkSetup = async () => {
      try {
        const status = await setupService.getStatus();
        setSetupStatus(status);
        
        if (!status.isSetupComplete) {
          navigate('/setup', { replace: true });
        }
      } catch (error) {
        // getStatus() resolves its own failures, so this is a last-resort guard:
        // leave status unknown rather than claim a deployment mode we never read.
        console.warn('[Setup] Failed to check setup status:', error);
        setSetupStatus(null);
      } finally {
        setIsChecking(false);
      }
    };

    checkSetup();
  }, [navigate, location.pathname]);

  return { isChecking, setupStatus };
}

export default useSetupCheck;
