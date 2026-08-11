import React, { useState } from 'react';
import { Sparkles, ArrowRightLeft, BookMarked, BookmarkCheck, Volume2, Lightbulb, Check } from 'lucide-react';
import { HSKLevel, TranslationResult, VocabularyWord } from '../types';
import { SpeechInput } from './SpeechInput';
import { AudioPlayer } from './AudioPlayer';
import { PinyinWord } from './PinyinWord';

interface TranslatorViewProps {
  hskLevel: HSKLevel;
  onSaveWord: (word: VocabularyWord) => void;
  savedWords: VocabularyWord[];
}

export const TranslatorView: React.FC<TranslatorViewProps> = ({
  hskLevel,
  onSaveWord,
  savedWords,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async (text: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const customKey = localStorage.getItem('user_gemini_api_key');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customKey && customKey.trim()) {
        headers['x-gemini-api-key'] = customKey.trim();
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data: TranslationResult = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Translation error:', err);
      setError(err?.message || 'Failed to analyze text.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSaved = (wordText: string) => {
    return savedWords.some((w) => w.word === wordText);
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner / Instructions */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E5E1] shadow-xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0EFED] text-[#2D2D2D] text-xs font-bold mb-3 border border-[#E5E5E1]">
            <Sparkles className="w-3.5 h-3.5 text-red-600" /> AI Chinese Speaking & Grammar Translator
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2D2D2D]">
            Nói hoặc Nhập tiếng Việt / tiếng Trung
          </h2>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            Hệ thống tự động phát hiện ngôn ngữ, chuyển dịch chính xác, tạo Pinyin có dấu thanh điệu, trích xuất từ vựng theo cấp độ {hskLevel}, giải thích ngữ pháp và cung cấp phát âm AI voice tự nhiên.
          </p>
        </div>
      </div>

      {/* Speech & Text Input */}
      <SpeechInput
        onSendMessage={handleTranslate}
        placeholder="Nói vào micro hoặc nhập: 'Tôi muốn học tiếng Trung' / '我想学中文'..."
        disabled={isLoading}
      />

      {isLoading && (
        <div className="bg-white rounded-2xl p-8 text-center border border-[#E5E5E1] shadow-xs space-y-3">
          <div className="inline-block w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-600">
            AI đang phân tích ngữ pháp, Pinyin và chuẩn bị audio voice...
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* Translation & Analysis Output Card */}
      {result && !isLoading && (
        <div className="bg-white rounded-2xl border border-[#E5E5E1] shadow-xs p-6 space-y-6">
          {/* Main Translation Output Header */}
          <div className="border-b border-[#E5E5E1] pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Original Input ({result.detectedLanguage?.toUpperCase() || 'AUTO'})
              </span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                {result.hskLevel || hskLevel}
              </span>
            </div>

            {/* Chinese Output */}
            <div className="bg-[#FAF9F6] rounded-xl p-4 border border-[#E5E5E1] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl sm:text-3xl font-medium text-[#2D2D2D] tracking-wide font-chinese">
                  {result.chineseText}
                </span>
                <AudioPlayer text={result.chineseText} compact label="Play Audio" />
              </div>

              {/* Pinyin with tone styling */}
              <div className="text-sm font-mono text-gray-500">
                {result.pinyin}
              </div>

              {/* Vietnamese & English Translations */}
              <div className="pt-2 border-t border-[#E5E5E1] space-y-1">
                <p className="text-sm font-semibold text-[#2D2D2D]">
                  🇻🇳 {result.vietnameseTranslation || 'Bản dịch Tiếng Việt'}
                </p>
                {result.englishTranslation && (
                  <p className="text-xs text-gray-500 font-sans">
                    🇬🇧 {result.englishTranslation}
                  </p>
                )}
              </div>
            </div>

            {/* Complete Audio Player Control */}
            <AudioPlayer
              text={result.chineseText}
              label={`Phát âm: ${result.chineseText}`}
            />
          </div>

          {/* Extracted Vocabulary Words */}
          {result.vocabulary && result.vocabulary.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-red-600" /> Key Vocabulary
              </h3>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {result.vocabulary.map((vocab, idx) => {
                  const saved = isSaved(vocab.word);
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-3 border border-[#E5E5E1] flex flex-col justify-between hover:border-red-200 hover:bg-red-50/30 transition-colors group"
                    >
                      <PinyinWord
                        chinese={vocab.word}
                        pinyin={vocab.pinyin}
                        translation={vocab.translation}
                        hskLevel={vocab.hskLevel}
                        size="sm"
                      />
                      <button
                        onClick={() => onSaveWord(vocab)}
                        id={`btn-save-vocab-${idx}`}
                        className={`mt-2 w-full py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          saved
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-[#FAF9F6] text-gray-700 hover:bg-red-600 hover:text-white border border-[#E5E5E1]'
                        }`}
                      >
                        {saved ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5 text-green-600" /> Đã lưu
                          </>
                        ) : (
                          <>+ Lưu từ vựng</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grammar Notes & Structure Breakdown */}
          {result.grammarNotes && result.grammarNotes.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#E5E5E1]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Phân Tích Cấu Trúc Ngữ Pháp (Grammar Points)
              </h3>
              <div className="space-y-3">
                {result.grammarNotes.map((g, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#FAF9F6] border border-[#E5E5E1] rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2D2D2D] text-sm">
                        📌 Cấu trúc: <span className="text-red-600">{g.pattern}</span>
                      </span>
                      <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {g.meaning}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {g.explanation}
                    </p>
                    {g.exampleChinese && (
                      <div className="bg-white rounded-lg p-2.5 border border-[#E5E5E1] flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#2D2D2D]">
                            {g.exampleChinese} ({g.examplePinyin})
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {g.exampleTranslation}
                          </p>
                        </div>
                        <AudioPlayer text={g.exampleChinese} compact />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
