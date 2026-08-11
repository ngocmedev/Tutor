import { TTSRequest } from '../../types';

export class BrowserTTSProvider {
  /**
   * Speaks text using browser Web Speech API
   */
  public static speak(request: TTSRequest): Promise<boolean> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('Browser SpeechSynthesis API not supported.');
        resolve(false);
        return;
      }

      window.speechSynthesis.cancel(); // Stop any ongoing speech

      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.lang = request.language || 'zh-CN';
      utterance.rate = request.speed || 1.0;

      // Try to select a Chinese voice if available
      const voices = window.speechSynthesis.getVoices();
      const chineseVoice = voices.find(
        (v) =>
          v.lang.startsWith('zh') ||
          v.name.includes('Chinese') ||
          v.name.includes('Mandarin') ||
          v.name.includes('Huihui') ||
          v.name.includes('Tingting')
      );

      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }

      utterance.onend = () => resolve(true);
      utterance.onerror = (err) => {
        console.warn('Browser TTS error:', err);
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  public static stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
