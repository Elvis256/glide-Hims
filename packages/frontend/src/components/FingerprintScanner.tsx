import { useState, useEffect, useCallback } from 'react';
import { Fingerprint, Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { secugenService, type DeviceInfo, type CaptureResult, type FingerIndex } from '../services/secugen';
import { biometricsService } from '../services/biometrics';
import { toast } from 'sonner';

interface FingerprintScannerProps {
  userId: string;
  mode: 'register' | 'verify';
  onSuccess: (data: { fingerIndex?: FingerIndex; templateData?: string }) => void;
  onCancel: () => void;
  userName?: string;
}

const FINGER_NAMES: Record<FingerIndex, string> = {
  'right_thumb': 'Right Thumb',
  'right_index': 'Right Index',
  'right_middle': 'Right Middle',
  'right_ring': 'Right Ring',
  'right_little': 'Right Little',
  'left_thumb': 'Left Thumb',
  'left_index': 'Left Index',
  'left_middle': 'Left Middle',
  'left_ring': 'Left Ring',
  'left_little': 'Left Little',
};

type ScanStatus = 'idle' | 'checking' | 'ready' | 'scanning' | 'success' | 'failed' | 'no-device';

export default function FingerprintScanner({ userId, mode, onSuccess, onCancel, userName }: FingerprintScannerProps) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [status, setStatus] = useState<ScanStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [selectedFinger, setSelectedFinger] = useState<FingerIndex>('right_index');
  const [enrolledFingers, setEnrolledFingers] = useState<FingerIndex[]>([]);
  const [matchedFinger, setMatchedFinger] = useState<FingerIndex | null>(null);

  // Check device on mount
  useEffect(() => {
    checkDevice();
    if (mode === 'verify') {
      loadEnrolledFingers();
    }
  }, [userId, mode]);

  const loadEnrolledFingers = async () => {
    try {
      const enrollment = await biometricsService.checkEnrollment(userId);
      setEnrolledFingers(enrollment.fingers);
    } catch {
      console.error('Failed to load enrolled fingers');
    }
  };

  const checkDevice = async () => {
    setStatus('checking');
    setError(null);

    const info = await secugenService.getDeviceInfo();
    setDeviceInfo(info);

    if (info.connected) {
      setStatus('ready');
    } else {
      setStatus('no-device');
      setError(info.error || 'Scanner not connected');
    }
  };

  const handleCapture = useCallback(async () => {
    setStatus('scanning');
    setError(null);
    setCapturedImage(null);
    setQuality(null);

    const result = await secugenService.capture(10, 50);

    if (result.success && result.templateData) {
      setCapturedImage(result.imageData || null);
      setQuality(result.quality || null);

      if (mode === 'register') {
        // For registration, save the template
        try {
          await biometricsService.register({
            userId,
            fingerIndex: selectedFinger,
            templateData: result.templateData,
            qualityScore: result.quality,
          });
          setStatus('success');
          toast.success(`${FINGER_NAMES[selectedFinger]} registered successfully`);
          onSuccess({ fingerIndex: selectedFinger, templateData: result.templateData });
        } catch (err) {
          setStatus('failed');
          setError('Failed to save fingerprint. Please try again.');
        }
      } else {
        // For verification, match against stored templates
        try {
          const { templates } = await biometricsService.getTemplates(userId);
          const matchResult = await secugenService.matchAgainstMultiple(result.templateData, templates, 50);

          if (matchResult.matched && matchResult.fingerIndex) {
            setStatus('success');
            setMatchedFinger(matchResult.fingerIndex);
            await biometricsService.recordVerification(userId, matchResult.fingerIndex);
            toast.success('Identity verified!');
            onSuccess({ fingerIndex: matchResult.fingerIndex });
          } else {
            setStatus('failed');
            setError('Fingerprint does not match. Please try again.');
          }
        } catch (err) {
          setStatus('failed');
          setError('Verification failed. User may not have registered fingerprints.');
        }
      }
    } else {
      setStatus('failed');
      setError(result.error || 'Capture failed');
    }
  }, [userId, mode, selectedFinger, onSuccess]);

  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'bg-green-100 border-green-500';
      case 'failed': return 'bg-red-100 border-red-500';
      case 'scanning': return 'bg-blue-100 border-blue-500 animate-pulse';
      case 'no-device': return 'bg-yellow-100 border-yellow-500';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
      case 'scanning':
        return <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500" />;
      case 'no-device':
        return <AlertTriangle className="w-16 h-16 text-yellow-500" />;
      default:
        return <Fingerprint className="w-16 h-16 text-gray-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'checking': return 'Checking scanner...';
      case 'ready': return mode === 'register' ? 'Select finger and place on scanner' : 'Place finger on scanner';
      case 'scanning': return 'Scanning... Keep finger steady';
      case 'success': return mode === 'register' ? 'Fingerprint registered!' : 'Identity verified!';
      case 'failed': return error || 'Scan failed';
      case 'no-device': return 'Scanner not detected';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Fingerprint className="w-6 h-6" />
            {mode === 'register' ? 'Register Fingerprint' : 'Verify Identity'}
          </h2>
          {userName && <p className="text-blue-100 text-sm mt-1">{userName}</p>}
        </div>

        <div className="p-6">
          {/* Fingerprint Display Area */}
          <div className={`relative mx-auto w-48 h-48 rounded-xl border-4 flex items-center justify-center transition-all ${getStatusColor()}`}>
            {capturedImage ? (
              <img 
                src={`data:image/png;base64,${capturedImage}`} 
                alt="Fingerprint" 
                className="w-40 h-40 object-contain"
              />
            ) : (
              getStatusIcon()
            )}
          </div>

          {/* Status Message */}
          <p className={`text-center mt-4 font-medium ${
            status === 'success' ? 'text-green-600' :
            status === 'failed' ? 'text-red-600' :
            status === 'no-device' ? 'text-yellow-600' :
            'text-gray-600'
          }`}>
            {getStatusMessage()}
          </p>

          {/* Quality Score */}
          {quality !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Quality</span>
                <span>{quality}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${quality >= 70 ? 'bg-green-500' : quality >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${quality}%` }}
                />
              </div>
            </div>
          )}

          {/* Finger Selection (Registration only) */}
          {mode === 'register' && status !== 'success' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Finger</label>
              <select
                value={selectedFinger}
                onChange={(e) => setSelectedFinger(e.target.value as FingerIndex)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={status === 'scanning'}
              >
                {Object.entries(FINGER_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name} {enrolledFingers.includes(key as FingerIndex) ? '(Enrolled)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Matched Finger Display */}
          {mode === 'verify' && matchedFinger && (
            <p className="text-center text-green-600 mt-2">
              Matched: {FINGER_NAMES[matchedFinger]}
            </p>
          )}

          {/* Device Info */}
          {deviceInfo?.connected && (
            <p className="text-center text-xs text-gray-400 mt-4">
              {deviceInfo.deviceName} {deviceInfo.serialNumber ? `(${deviceInfo.serialNumber})` : ''}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            {status === 'no-device' && (
              <button
                onClick={checkDevice}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}

            {(status === 'ready' || status === 'failed') && (
              <button
                onClick={handleCapture}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-4 h-4" />
                {status === 'failed' ? 'Try Again' : 'Scan'}
              </button>
            )}

            {status === 'success' && (
              <button
                onClick={() => onSuccess({ fingerIndex: matchedFinger || selectedFinger })}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
