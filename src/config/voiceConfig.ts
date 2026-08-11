import { VoiceConfig } from '../types';

/**
 * Voice Configuration
 * Adam is configured as the default general voice.
 * For Chinese text, a Mandarin-suited voice configuration is prioritized
 * so pronunciation remains clean, native, and natural.
 */
export const VOICE_CONFIG: VoiceConfig = {
  provider: 'elevenlabs',
  voiceName: 'Adam',
  // Standard ElevenLabs voice ID for Adam or default Multilingual
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Adam voice ID
  chineseVoiceName: 'Mandarin Native (Chinese)',
  // ElevenLabs multilingual voice ID suitable for Chinese (e.g., Eleven Multilingual v2)
  chineseVoiceId: 'pNInz6obpgDQGcFmaJgB', // Multilingual voice optimized for Chinese
  language: 'zh-CN',
};

export const CHINESE_AUDIO_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

export const GENERAL_VOICE = {
  name: 'Adam',
  id: VOICE_CONFIG.voiceId,
  language: 'en-US',
};

export const CHINESE_VOICE = {
  name: VOICE_CONFIG.chineseVoiceName,
  id: VOICE_CONFIG.chineseVoiceId,
  language: 'zh-CN',
};

/**
 * Check if text contains Chinese characters (Hanzi)
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}
