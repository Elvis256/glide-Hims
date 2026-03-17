import { useState, useRef, useEffect, useCallback } from 'react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function BarcodeScanner({
  onScan,
  placeholder = 'Scan barcode or type code…',
  autoFocus = true,
}: BarcodeScannerProps) {
  const [inputValue, setInputValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<number | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      onScan(inputValue.trim());
      setInputValue('');
    }
  };

  const stopCamera = useCallback(() => {
    if (detectionRef.current) {
      cancelAnimationFrame(detectionRef.current);
      detectionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraError(null);
  }, []);

  const startDetection = useCallback(
    (video: HTMLVideoElement) => {
      // Use BarcodeDetector API if available (Chrome 83+)
      if (!('BarcodeDetector' in window)) {
        setCameraError(
          'BarcodeDetector API not supported in this browser. Use a barcode scanner gun or type the code manually.',
        );
        return;
      }

      const detector = new (window as any).BarcodeDetector({
        formats: [
          'code_128',
          'code_39',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'qr_code',
          'data_matrix',
        ],
      });

      let scanning = true;

      const detect = async () => {
        if (!scanning || video.readyState < 2) {
          detectionRef.current = requestAnimationFrame(detect);
          return;
        }
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              onScan(code);
              // Brief pause after successful scan
              scanning = false;
              setTimeout(() => {
                scanning = true;
              }, 1500);
            }
          }
        } catch {
          // Detection errors are non-fatal; keep scanning
        }
        detectionRef.current = requestAnimationFrame(detect);
      };

      detectionRef.current = requestAnimationFrame(detect);
    },
    [onScan],
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      // Wait for video element to be mounted
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current!.play();
            startDetection(videoRef.current!);
          };
        }
      });
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : 'Could not access camera. Use a barcode scanner gun or type the code manually.',
      );
    }
  }, [startDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Manual input */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={toggleCamera}
          style={{
            padding: '8px 16px',
            backgroundColor: cameraActive ? '#ef4444' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
          }}
        >
          {cameraActive ? '⏹ Stop Camera' : '📷 Scan with Camera'}
        </button>
      </div>

      {/* Camera preview */}
      {cameraActive && (
        <div
          style={{
            marginTop: '12px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid #3b82f6',
            position: 'relative',
            backgroundColor: '#000',
          }}
        >
          <video
            ref={videoRef}
            style={{ width: '100%', maxHeight: '300px', display: 'block' }}
            muted
            playsInline
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: '2px',
              backgroundColor: 'rgba(239, 68, 68, 0.7)',
              transform: 'translateY(-50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: 0,
              right: 0,
              textAlign: 'center',
              color: '#fff',
              fontSize: '12px',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            Position barcode within the red line
          </div>
        </div>
      )}

      {/* Error message */}
      {cameraError && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          {cameraError}
        </div>
      )}
    </div>
  );
}
