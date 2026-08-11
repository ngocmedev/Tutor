import { TTSRequest, TTSResponse } from '../types';
import { ElevenLabsProvider } from './providers/ElevenLabsProvider';
import { BrowserTTSProvider } from './providers/BrowserTTSProvider';

export class TextToSpeechService {
  private static currentAudio: HTMLAudioElement | null = null;

  /**
   * Primary entry point for TTS synthesis and playback
   */
  public static async speak(
    request: TTSRequest,
    onStart?: () => void,
    onEnded?: () => void,
    onError?: (error: string) => void
  ): Promise<TTSResponse> {
    // Stop any existing playback
    this.stop();

    // 1. Try ElevenLabs via backend endpoint
    const response = await ElevenLabsProvider.generateSpeech(request);

    if (response.audioUrl || response.audioBase64) {
      const src = response.audioUrl || response.audioBase64;
      if (src) {
        this.playAudioSource(src, request.speed || 1.0, onStart, onEnded, onError);
        return response;
      }
    }

    // 2. Fallback to Browser SpeechSynthesis API
    console.info('ElevenLabs not available or unconfigured. Falling back to Browser TTS.');
    if (onStart) onStart();
    const success = await BrowserTTSProvider.speak(request);
    if (success) {
      if (onEnded) onEnded();
      return {
        providerUsed: 'browser',
        isCached: false,
      };
    } else {
      const errMsg = response.error || 'Speech synthesis unavailable on this device.';
      if (onError) onError(errMsg);
      return {
        providerUsed: 'browser',
        error: errMsg,
      };
    }
  }

  /**
   * Helper to play an HTMLAudioElement or Data URL
   */
  public static playAudioSource(
    src: string,
    speed: number,
    onStart?: () => void,
    onEnded?: () => void,
    onError?: (error: string) => void
  ) {
    try {
      // Ensure previous audio playback is stopped
      this.stop();

      const audio = new Audio(src);
      audio.playbackRate = speed;
      this.currentAudio = audio;

      audio.onplay = () => {
        if (onStart) onStart();
      };

      audio.onended = () => {
        this.currentAudio = null;
        if (onEnded) onEnded();
      };

      audio.onerror = (e) => {
        this.currentAudio = null;
        console.warn('Audio playback error:', e);
        if (onError) onError('Failed to play audio.');
      };

      audio.play().catch((err) => {
        console.warn('Audio autoplay blocked or failed:', err);
        if (onError) onError('Click required to play audio.');
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audio initialization error';
      if (onError) onError(msg);
    }
  }

  /**
   * Returns current active audio element if any
   */
  public static getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  /**
   * Stops any currently playing audio (HTML audio or Web Speech)
   */
  public static stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    BrowserTTSProvider.stop();
  }
}
