export type HSKLevel = 'HSK 1' | 'HSK 2' | 'HSK 3' | 'HSK 4' | 'HSK 5' | 'HSK 6';

export type ConversationTopic =
  | 'Self Introduction'
  | 'Ordering Food'
  | 'Shopping'
  | 'University'
  | 'Travel'
  | 'Daily Life'
  | 'Hobbies'
  | 'Gaming'
  | 'Work'
  | 'Restaurant'
  | 'Asking Directions'
  | 'Free Conversation';

export interface VoiceConfig {
  provider: 'elevenlabs' | 'browser' | 'gemini' | 'auto';
  voiceName: string;
  chineseVoiceName: string;
  voiceId?: string;
  chineseVoiceId?: string;
  language: string;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  language?: string;
  useChineseVoice?: boolean;
}

export interface TTSResponse {
  audioUrl?: string;
  audioBase64?: string;
  providerUsed: 'elevenlabs' | 'browser' | 'gemini';
  isCached?: boolean;
  error?: string;
}

export interface FeedbackDetail {
  grammarStatus: 'Correct' | 'Needs Improvement' | 'Incorrect';
  naturalness: 'Very Natural' | 'Good' | 'Needs Naturalization';
  speechTranscriptionMatched: boolean;
  suggestedImprovement?: string;
  vocabularyFeedback: string;
  grammarFeedback: string;
  explanation: string;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string; // Chinese text
  pinyin?: string;
  translation?: string; // Vietnamese translation
  originalVietnamese?: string;
  feedback?: FeedbackDetail;
  audioUrl?: string;
  createdAt: string;
}

export interface ConversationSession {
  id: string;
  userId?: string;
  level: HSKLevel;
  topic: ConversationTopic;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyWord {
  id?: string;
  word: string; // Chinese characters
  pinyin: string;
  translation: string; // Vietnamese / English
  hskLevel?: string;
  tonePattern?: string;
  exampleSentence?: string;
  examplePinyin?: string;
  exampleTranslation?: string;
}

export interface GrammarPoint {
  pattern: string;
  meaning: string;
  explanation: string;
  exampleChinese: string;
  examplePinyin: string;
  exampleTranslation: string;
}

export interface TranslationResult {
  sourceText: string;
  detectedLanguage: 'zh' | 'vi' | 'en';
  chineseText: string;
  pinyin: string;
  vietnameseTranslation: string;
  englishTranslation: string;
  hskLevel: HSKLevel;
  vocabulary: VocabularyWord[];
  grammarNotes: GrammarPoint[];
  culturalNotes?: string;
}

export interface ShadowingItem {
  id: string;
  chineseText: string;
  pinyin: string;
  vietnameseTranslation: string;
  hskLevel: HSKLevel;
  audioUrl?: string;
}

export interface ToneItem {
  id: string;
  character: string;
  pinyin: string;
  toneNumber: 1 | 2 | 3 | 4 | 0; // 1st, 2nd, 3rd, 4th, neutral
  toneName: string;
  meaning: string;
  exampleWord: string;
  examplePinyin: string;
}
