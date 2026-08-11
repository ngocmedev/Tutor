import React, { useState, useEffect } from 'react';
import { HSKLevel, VocabularyWord } from './types';
import { Header, AppMode } from './components/Header';
import { TranslatorView } from './components/TranslatorView';
import { ConversationView } from './components/ConversationView';
import { ShadowingView } from './components/ShadowingView';
import { TonePracticeView } from './components/TonePracticeView';
import { VocabularyFlashcardsView } from './components/VocabularyFlashcardsView';
import { ProgressTrackerView } from './components/ProgressTrackerView';

const DEFAULT_SAVED_WORDS: VocabularyWord[] = [
  { word: '你好', pinyin: 'nǐ hǎo', translation: 'Xin chào', hskLevel: 'HSK 1' },
  { word: '谢谢', pinyin: 'xièxie', translation: 'Cảm ơn', hskLevel: 'HSK 1' },
  { word: '学习', pinyin: 'xuéxí', translation: 'Học tập', hskLevel: 'HSK 1' },
  { word: '中文', pinyin: 'Zhōngwén', translation: 'Tiếng Trung', hskLevel: 'HSK 1' },
];

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>('translator');
  const [hskLevel, setHskLevel] = useState<HSKLevel>('HSK 1');

  // Load saved vocabulary from localStorage
  const [savedWords, setSavedWords] = useState<VocabularyWord[]>(() => {
    try {
      const item = localStorage.getItem('ai_chinese_tutor_words');
      return item ? JSON.parse(item) : DEFAULT_SAVED_WORDS;
    } catch {
      return DEFAULT_SAVED_WORDS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ai_chinese_tutor_words', JSON.stringify(savedWords));
    } catch (e) {
      console.warn('Failed to save words to localStorage:', e);
    }
  }, [savedWords]);

  const handleSaveWord = (word: VocabularyWord) => {
    if (!savedWords.some((w) => w.word === word.word)) {
      setSavedWords((prev) => [word, ...prev]);
    }
  };

  const handleRemoveWord = (wordText: string) => {
    setSavedWords((prev) => prev.filter((w) => w.word !== wordText));
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2D2D2D] flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Top Header & Navigation */}
      <Header
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        hskLevel={hskLevel}
        onLevelChange={setHskLevel}
      />

      {/* Main Mode View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeMode === 'translator' && (
          <TranslatorView
            hskLevel={hskLevel}
            onSaveWord={handleSaveWord}
            savedWords={savedWords}
          />
        )}

        {activeMode === 'conversation' && (
          <ConversationView
            hskLevel={hskLevel}
            onLevelChange={setHskLevel}
          />
        )}

        {activeMode === 'shadowing' && (
          <ShadowingView hskLevel={hskLevel} />
        )}

        {activeMode === 'tones' && <TonePracticeView />}

        {activeMode === 'flashcards' && (
          <VocabularyFlashcardsView
            savedWords={savedWords}
            onRemoveWord={handleRemoveWord}
          />
        )}

        {activeMode === 'progress' && (
          <ProgressTrackerView
            hskLevel={hskLevel}
            savedWordsCount={savedWords.length}
          />
        )}
      </main>

      {/* App Footer */}
      <footer className="bg-white border-t border-[#E5E5E1] py-4 mt-auto text-center text-xs text-gray-500">
        <p className="font-semibold text-gray-700">
          AI Chinese Tutor • Powered by Gemini AI & Text-to-Speech (ElevenLabs / Web Speech)
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          Targeting HSK 1 - 6 • Natural Chinese Voice Pronunciation & Conversational Learning
        </p>
      </footer>
    </div>
  );
}
