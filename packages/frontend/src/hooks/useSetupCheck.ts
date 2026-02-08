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
        // If API fails, assume setup is complete (for backwards compatibility)
        console.warn('[Setup] Failed to check setup status:', error);
        setSetupStatus({ isSetupComplete: true });
      } finally {
        setIsChecking(false);
      }
    };

    checkSetup();
  }, [navigate, location.pathname]);

  return { isChecking, setupStatus };
}

export default useSetupCheck;
