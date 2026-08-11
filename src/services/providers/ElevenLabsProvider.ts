import { TTSRequest, TTSResponse } from '../../types';

export class ElevenLabsProvider {
  /**
   * Request TTS audio from backend ElevenLabs API endpoint
   */
  public static async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          speed: request.speed || 1.0,
          useChineseVoice: request.useChineseVoice ?? true,
          language: request.language || 'zh-CN',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          providerUsed: 'elevenlabs',
          error: errorData.message || `HTTP error ${response.status}`,
        };
      }

      const data: TTSResponse = await response.json();
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      return {
        providerUsed: 'elevenlabs',
        error: message,
      };
    }
  }
}
