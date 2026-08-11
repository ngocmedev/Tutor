import React, { useState } from 'react';
import { Mic, Volume2, CheckCircle2, AlertCircle, RefreshCw, Sparkles, ChevronRight } from 'lucide-react';
import { HSKLevel, ShadowingItem } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { SpeechInput } from './SpeechInput';

interface ShadowingViewProps {
  hskLevel: HSKLevel;
}

const SHADOWING_DATABASE: Record<HSKLevel, ShadowingItem[]> = {
  'HSK 1': [
    { id: '1-1', chineseText: '你好，我叫小明。', pinyin: 'Nǐ hǎo, wǒ jiào Xiǎomíng.', vietnameseTranslation: 'Xin chào, tôi tên là Tiểu Minh.', hskLevel: 'HSK 1' },
    { id: '1-2', chineseText: '很高兴认识你。', pinyin: 'Hěn gāoxìng rènshi nǐ.', vietnameseTranslation: 'Rất vui được quen biết bạn.', hskLevel: 'HSK 1' },
    { id: '1-3', chineseText: '你想喝水吗？', pinyin: 'Nǐ xiǎng hē shuǐ ma?', vietnameseTranslation: 'Bạn có muốn uống nước không?', hskLevel: 'HSK 1' },
    { id: '1-4', chineseText: '今天天气很好。', pinyin: 'Jīntiān tiānqì hěn hǎo.', vietnameseTranslation: 'Hôm nay thời tiết rất tốt.', hskLevel: 'HSK 1' },
  ],
  'HSK 2': [
    { id: '2-1', chineseText: '我昨天去商店买东西了。', pinyin: 'Wǒ zuótiān qù shāngdiàn mǎi dōngxi le.', vietnameseTranslation: 'Hôm qua tôi đi cửa hàng mua đồ rồi.', hskLevel: 'HSK 2' },
    { id: '2-2', chineseText: '你知道他在哪里吗？', pinyin: 'Nǐ zhīdào tā zài nǎlǐ ma?', vietnameseTranslation: 'Bạn có biết anh ấy ở đâu không?', hskLevel: 'HSK 2' },
    { id: '2-3', chineseText: '外面在下雨，别出去了。', pinyin: 'Wàimiàn zài xià yǔ, bié chūqù le.', vietnameseTranslation: 'Bên ngoài đang mưa, đừng ra ngoài nữa.', hskLevel: 'HSK 2' },
  ],
  'HSK 3': [
    { id: '3-1', chineseText: '虽然汉语很难，但是很有趣。', pinyin: 'Suīrán Hànyǔ hěn nán, dànshì hěn yǒuqù.', vietnameseTranslation: 'Mặc dù tiếng Hán rất khó, nhưng rất thú vị.', hskLevel: 'HSK 3' },
    { id: '3-2', chineseText: '把这本书交给老师吧。', pinyin: 'Bǎ zhè běn shū jiāo gěi lǎoshī ba.', vietnameseTranslation: 'Hãy đưa cuốn sách này cho thầy giáo nhé.', hskLevel: 'HSK 3' },
  ],
  'HSK 4': [
    { id: '4-1', chineseText: '只要坚持练习，你的口语就会提高。', pinyin: 'Zhǐyào jiānchí liànxí, nǐ de kǒuyǔ jiù huì tígāo.', vietnameseTranslation: 'Chỉ cần kiên trì luyện tập, khẩu ngữ của bạn sẽ nâng cao.', hskLevel: 'HSK 4' },
  ],
  'HSK 5': [
    { id: '5-1', chineseText: '良好的沟通是解决问题的关键。', pinyin: 'Liánghǎo de gōutōng shì jiějué wèntí de guānjiàn.', vietnameseTranslation: 'Giao tiếp tốt là chìa khóa để giải quyết vấn đề.', hskLevel: 'HSK 5' },
  ],
  'HSK 6': [
    { id: '6-1', chineseText: '博大精深的中国文化吸引着世界各地的学者。', pinyin: 'Bódàjīngshēn de Zhōngguó wénhuà xīyǐn zhe shìjiè gèdì de xuézhě.', vietnameseTranslation: 'Văn hóa Trung Hoa uyên thâm thu hút các học giả trên khắp thế giới.', hskLevel: 'HSK 6' },
  ],
};

export const ShadowingView: React.FC<ShadowingViewProps> = ({ hskLevel }) => {
  const items = SHADOWING_DATABASE[hskLevel] || SHADOWING_DATABASE['HSK 1'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userTranscript, setUserTranscript] = useState('');
  const [assessmentResult, setAssessmentResult] = useState<{
    matched: boolean;
    message: string;
  } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const currentItem = items[currentIndex % items.length];

  const handleSpeechRecorded = async (text: string) => {
    setUserTranscript(text);
    setIsEvaluating(true);

    try {
      const response = await fetch('/api/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceChinese: currentItem.chineseText,
          userTranscript: text,
        }),
      });

      const data = await response.json();
      setAssessmentResult({
        matched: data.speechTranscriptionMatched,
        message: data.statusMessage,
      });
    } catch (err) {
      console.error('Shadowing evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const nextSentence = () => {
    setUserTranscript('');
    setAssessmentResult(null);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div className="space-y-6">
      {/* Shadowing Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E5E1] shadow-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0EFED] text-[#2D2D2D] text-xs font-bold mb-2 border border-[#E5E5E1]">
          <Sparkles className="w-3.5 h-3.5 text-red-600" /> Shadowing & Pronunciation Practice
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#2D2D2D]">Luyện Phát Âm Theo Mẫu (Shadowing)</h2>
        <p className="mt-1 text-xs text-gray-500">
          1. Nghe câu mẫu AI phát âm. 2. Nhấn Micro và nói lại chính xác. 3. AI đánh giá độ khớp văn bản.
        </p>
      </div>

      {/* Target Sentence Card */}
      <div className="bg-white rounded-2xl border border-[#E5E5E1] shadow-xs p-6 space-y-4 text-center">
        <div className="inline-block px-3 py-1 rounded-full bg-[#F0EFED] text-gray-700 font-mono text-xs font-bold border border-[#E5E5E1]">
          {currentItem.hskLevel} • Sentence {currentIndex + 1} / {items.length}
        </div>

        <div className="space-y-2 py-4">
          <h3 className="text-3xl sm:text-4xl font-medium font-chinese text-[#2D2D2D] tracking-wide">
            {currentItem.chineseText}
          </h3>
          <p className="text-sm font-mono text-gray-500">
            {currentItem.pinyin}
          </p>
          <p className="text-sm font-semibold text-gray-700">
            🇻🇳 {currentItem.vietnameseTranslation}
          </p>
        </div>

        {/* Audio Player */}
        <div className="max-w-md mx-auto">
          <AudioPlayer text={currentItem.chineseText} label="Nghe mẫu (Listen to Reference)" />
        </div>
      </div>

      {/* User Turn Section */}
      <div className="bg-[#FAF9F6] rounded-2xl border border-[#E5E5E1] p-6 space-y-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          🎙️ Lượt Của Bạn (Your Turn)
        </h4>

        <SpeechInput
          onSendMessage={handleSpeechRecorded}
          placeholder="Nhấn biểu tượng micro, đọc lại câu tiếng Trung ở trên..."
          defaultLang="zh-CN"
          disabled={isEvaluating}
        />

        {isEvaluating && (
          <p className="text-xs font-semibold text-gray-500 text-center animate-pulse">
            Đang so sánh transcript giọng nói của bạn với mẫu...
          </p>
        )}

        {/* Assessment Result Box */}
        {assessmentResult && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              assessmentResult.matched
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              {assessmentResult.matched ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Speech transcription matched!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Transcript mismatch detected</span>
                </>
              )}
            </div>

            <p className="text-xs font-mono">{assessmentResult.message}</p>
            {userTranscript && (
              <p className="text-xs font-semibold">
                Nội dung thu âm được: <span className="font-chinese text-sm">"{userTranscript}"</span>
              </p>
            )}
          </div>
        )}

        {/* Next Sentence Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={nextSentence}
            id="btn-next-shadowing-sentence"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span>Câu tiếp theo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
