/**
 * Utility functions for patient call announcements
 */

export interface AnnouncementOptions {
  patientName?: string;
  ticketNumber: string;
  servicePoint: string;
  counterNumber?: string;
  repeatCount?: number;
  delayBetweenRepeats?: number; // in milliseconds
}

/**
 * Announces a patient call using Web Speech API
 * Repeats the announcement based on repeatCount (default: 3)
 */
export const announcePatientCall = (options: AnnouncementOptions): void => {
  const {
    patientName,
    ticketNumber,
    servicePoint,
    counterNumber,
    repeatCount = 3,
    delayBetweenRepeats = 2000, // 2 seconds between repeats
  } = options;

  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Map service point to user-friendly name
  const servicePointNames: Record<string, string> = {
    triage: 'triage room',
    consultation: 'consultation room',
    pharmacy: 'pharmacy counter',
    laboratory: 'laboratory',
    radiology: 'radiology department',
    billing: 'billing counter',
    cashier: 'cashier',
  };

  const locationName = servicePointNames[servicePoint] || servicePoint;

  // Create announcement text
  let announcement = `Token number ${ticketNumber.replace('-', ' ')}`;
  
  if (patientName) {
    announcement += `, ${patientName}`;
  }
  
  announcement += `, please proceed to ${locationName}`;
  
  if (counterNumber) {
    announcement += ` ${counterNumber}`;
  }

  // Function to speak once
  const speakOnce = (index: number) => {
    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.rate = 0.9;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    // Try to use an English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    // If this is the last repeat, add a small delay before the next action
    if (index === repeatCount - 1) {
      utterance.onend = () => {
        console.log('All announcements completed');
      };
    }

    window.speechSynthesis.speak(utterance);
  };

  // Speak multiple times with delay
  for (let i = 0; i < repeatCount; i++) {
    setTimeout(() => {
      speakOnce(i);
    }, i * delayBetweenRepeats);
  }
};

/**
 * Cancels any ongoing announcements
 */
export const cancelAnnouncements = (): void => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Loads voices (needed for some browsers)
 */
export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      resolve(loadedVoices);
    };
  });
};
