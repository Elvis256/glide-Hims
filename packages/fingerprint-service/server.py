#!/usr/bin/env python3
"""
SecuGen Fingerprint Service for Linux
A Flask-based HTTP service that bridges SecuGen SDK to web applications
"""

import os
import sys
import base64
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173', 'http://localhost:3000', 'http://192.168.178.41:5173'])

# Try to import SecuGen library
SECUGEN_AVAILABLE = False
sgfplib = None

try:
    # Add SDK path
    SDK_PATH = os.environ.get('SECUGEN_SDK_PATH', '/opt/secugen-sdk')
    sys.path.insert(0, os.path.join(SDK_PATH, 'python'))
    
    from pysgfplib import PYSGFPLib, SGFDxErrorCode, SGFDxDeviceName
    
    sgfplib = PYSGFPLib()
    result = sgfplib.Create()
    if result == SGFDxErrorCode.SGFDX_ERROR_NONE:
        result = sgfplib.Init(SGFDxDeviceName.SG_DEV_AUTO)
        if result == SGFDxErrorCode.SGFDX_ERROR_NONE:
            SECUGEN_AVAILABLE = True
            logger.info("SecuGen SDK initialized successfully")
        else:
            logger.warning(f"SecuGen Init failed: {result}")
    else:
        logger.warning(f"SecuGen Create failed: {result}")
except ImportError as e:
    logger.warning(f"SecuGen SDK not available: {e}")
except Exception as e:
    logger.warning(f"Error initializing SecuGen: {e}")


class MockScanner:
    """Mock scanner for development/testing when no hardware is available"""
    
    def __init__(self):
        self.device_open = False
        self.image_width = 260
        self.image_height = 300
    
    def open_device(self):
        self.device_open = True
        return True
    
    def close_device(self):
        self.device_open = False
        return True
    
    def capture(self, timeout=10000):
        """Return a mock fingerprint template"""
        import random
        import time
        
        # Simulate capture delay
        time.sleep(0.5)
        
        # Generate mock template (400 bytes of "fingerprint data")
        mock_template = bytes([random.randint(0, 255) for _ in range(400)])
        mock_quality = random.randint(70, 95)
        
        return {
            'success': True,
            'template': base64.b64encode(mock_template).decode('utf-8'),
            'quality': mock_quality,
            'width': self.image_width,
            'height': self.image_height
        }
    
    def match(self, template1, template2, security_level=5):
        """Mock matching - always returns true for same template"""
        return template1 == template2 or True  # For testing, always match


class SecuGenScanner:
    """Real SecuGen scanner interface"""
    
    def __init__(self, sgfplib):
        self.sgfplib = sgfplib
        self.device_open = False
        self.image_width = 0
        self.image_height = 0
    
    def open_device(self, device_id=0):
        from ctypes import c_int, byref
        
        result = self.sgfplib.OpenDevice(device_id)
        if result == SGFDxErrorCode.SGFDX_ERROR_NONE:
            self.device_open = True
            
            # Get device info
            width = c_int(0)
            height = c_int(0)
            self.sgfplib.GetDeviceInfo(byref(width), byref(height))
            self.image_width = width.value
            self.image_height = height.value
            
            logger.info(f"Device opened: {self.image_width}x{self.image_height}")
            return True
        
        logger.error(f"Failed to open device: {result}")
        return False
    
    def close_device(self):
        if self.device_open:
            self.sgfplib.CloseDevice()
            self.device_open = False
        return True
    
    def capture(self, timeout=10000):
        """Capture fingerprint and return template"""
        from ctypes import c_char, c_int, byref
        
        if not self.device_open:
            if not self.open_device():
                return {'success': False, 'error': 'Failed to open device'}
        
        # Create image buffer
        buffer_size = self.image_width * self.image_height
        image_buffer = (c_char * buffer_size)()
        
        # Capture image
        result = self.sgfplib.GetImageEx(image_buffer, timeout, 0, 50)
        if result != SGFDxErrorCode.SGFDX_ERROR_NONE:
            return {'success': False, 'error': f'Capture failed: {result}'}
        
        # Get image quality
        quality = c_int(0)
        self.sgfplib.GetImageQuality(self.image_width, self.image_height, image_buffer, byref(quality))
        
        # Create template
        template_size = 400
        template = (c_char * template_size)()
        result = self.sgfplib.CreateTemplate(None, image_buffer, template)
        
        if result != SGFDxErrorCode.SGFDX_ERROR_NONE:
            return {'success': False, 'error': f'Template creation failed: {result}'}
        
        # Convert to base64
        template_bytes = bytes(template)
        template_b64 = base64.b64encode(template_bytes).decode('utf-8')
        
        return {
            'success': True,
            'template': template_b64,
            'quality': quality.value,
            'width': self.image_width,
            'height': self.image_height
        }
    
    def match(self, template1_b64, template2_b64, security_level=5):
        """Match two fingerprint templates"""
        from ctypes import c_bool, byref
        
        template1 = base64.b64decode(template1_b64)
        template2 = base64.b64decode(template2_b64)
        
        matched = c_bool(False)
        self.sgfplib.SetTemplateFormat(0)  # ANSI378
        
        result = self.sgfplib.MatchTemplate(template1, template2, security_level, byref(matched))
        
        if result == SGFDxErrorCode.SGFDX_ERROR_NONE:
            return matched.value
        
        logger.error(f"Match failed: {result}")
        return False


# Initialize scanner
if SECUGEN_AVAILABLE and sgfplib:
    scanner = SecuGenScanner(sgfplib)
else:
    logger.info("Using mock scanner (no hardware detected)")
    scanner = MockScanner()


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'secugen_available': SECUGEN_AVAILABLE,
        'mock_mode': not SECUGEN_AVAILABLE
    })


@app.route('/status', methods=['GET'])
def status():
    """Get scanner status"""
    device_connected = False
    
    if SECUGEN_AVAILABLE:
        try:
            if scanner.open_device():
                device_connected = True
                scanner.close_device()
        except Exception as e:
            logger.error(f"Error checking device: {e}")
    else:
        device_connected = True  # Mock mode always "connected"
    
    return jsonify({
        'connected': device_connected,
        'secugen_available': SECUGEN_AVAILABLE,
        'mock_mode': not SECUGEN_AVAILABLE
    })


@app.route('/capture', methods=['POST'])
def capture():
    """Capture fingerprint and return template"""
    try:
        data = request.get_json() or {}
        timeout = data.get('timeout', 10000)
        
        result = scanner.capture(timeout)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Capture error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/verify', methods=['POST'])
def verify():
    """Verify captured fingerprint against stored template"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        captured_template = data.get('capturedTemplate')
        stored_templates = data.get('storedTemplates', [])
        security_level = data.get('securityLevel', 5)
        
        if not captured_template:
            return jsonify({'success': False, 'error': 'No captured template'}), 400
        
        if not stored_templates:
            return jsonify({'success': False, 'error': 'No stored templates'}), 400
        
        # Try to match against any stored template
        for stored in stored_templates:
            template_data = stored.get('templateData') or stored
            if isinstance(template_data, str):
                if scanner.match(captured_template, template_data, security_level):
                    return jsonify({
                        'success': True,
                        'matched': True,
                        'fingerIndex': stored.get('fingerIndex')
                    })
        
        return jsonify({
            'success': True,
            'matched': False
        })
        
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/match', methods=['POST'])
def match():
    """Match two templates directly"""
    try:
        data = request.get_json()
        template1 = data.get('template1')
        template2 = data.get('template2')
        security_level = data.get('securityLevel', 5)
        
        if not template1 or not template2:
            return jsonify({'success': False, 'error': 'Both templates required'}), 400
        
        matched = scanner.match(template1, template2, security_level)
        return jsonify({'success': True, 'matched': matched})
        
    except Exception as e:
        logger.error(f"Match error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8444))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Fingerprint Service on port {port}")
    logger.info(f"SecuGen SDK: {'Available' if SECUGEN_AVAILABLE else 'Not available (mock mode)'}")
    
    # For development, use HTTP. For production with HTTPS, use gunicorn with SSL
    app.run(host='0.0.0.0', port=port, debug=debug)
