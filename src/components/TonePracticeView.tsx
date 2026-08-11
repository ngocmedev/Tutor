import React, { useState } from 'react';
import { Volume2, Music, Check, HelpCircle } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface ToneDefinition {
  number: number;
  nameZh: string;
  nameVi: string;
  contour: string;
  description: string;
  exampleChar: string;
  examplePinyin: string;
  toneColor: string;
  badgeBg: string;
}

const TONES: ToneDefinition[] = [
  {
    number: 1,
    nameZh: '第一声 (阴平)',
    nameVi: 'Thanh 1 (Thanh ngang - Cao)',
    contour: '55 ──',
    description: 'Giữ giọng cao, đều và phẳng (như hát nốt nhạc cao).',
    exampleChar: '妈',
    examplePinyin: 'mā',
    toneColor: 'text-rose-600',
    badgeBg: 'bg-rose-50 border-rose-200',
  },
  {
    number: 2,
    nameZh: '第二声 (阳平)',
    nameVi: 'Thanh 2 (Thanh sắc - Bắt đầu từ giữa lên cao)',
    contour: '35 ↗',
    description: 'Tăng tông giọng từ trung bình lên cao (như hỏi: "Hả?").',
    exampleChar: '麻',
    examplePinyin: 'má',
    toneColor: 'text-amber-600',
    badgeBg: 'bg-amber-50 border-amber-200',
  },
  {
    number: 3,
    nameZh: '第三声 (上声)',
    nameVi: 'Thanh 3 (Thanh hỏi - Giảm xuống thấp rồi vút lên)',
    contour: '214 ↘↗',
    description: 'Hạ giọng xuống rất thấp rồi vút nhẹ lên.',
    exampleChar: '马',
    examplePinyin: 'mǎ',
    toneColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-50 border-emerald-200',
  },
  {
    number: 4,
    nameZh: '第四声 (去声)',
    nameVi: 'Thanh 4 (Thanh huyền dứt khoát - Cao xuống thấp)',
    contour: '51 ↘',
    description: 'Phát âm dứt khoát từ trên đỉnh xuống (như ra lệnh "Không!").',
    exampleChar: '骂',
    examplePinyin: 'mà',
    toneColor: 'text-indigo-600',
    badgeBg: 'bg-indigo-50 border-indigo-200',
  },
  {
    number: 0,
    nameZh: '轻声 (Neutral Tone)',
    nameVi: 'Thanh nhẹ (Khinh thanh)',
    contour: '11 •',
    description: 'Phát âm ngắn, nhẹ, không nhấn giọng.',
    exampleChar: '吗',
    examplePinyin: 'ma',
    toneColor: 'text-slate-600',
    badgeBg: 'bg-slate-50 border-slate-200',
  },
];

const SANDHI_RULES = [
  {
    title: 'Biến điệu hai thanh 3 (3rd + 3rd Sandhi)',
    rule: 'Khi 2 âm tiết mang thanh 3 đi liền nhau, thanh 3 thứ nhất đọc thành thanh 2.',
    example: '你好 (nǐ hǎo) ➔ Đọc là: ní hǎo',
    audioText: '你好',
  },
  {
    title: 'Biến điệu từ 不 (bù)',
    rule: 'Từ 不 (bù) vốn mang thanh 4. Nhưng khi đứng trước từ mang thanh 4 khác, 不 chuyển thành thanh 2 (bú).',
    example: '不是 (bù shì) ➔ Đọc là: bú shì',
    audioText: '不是',
  },
  {
    title: 'Biến điệu từ 一 (yī)',
    rule: 'Đứng trước thanh 4, 一 đọc thành thanh 2 (yí). Đứng trước thanh 1, 2, 3, 一 đọc thành thanh 4 (yì).',
    example: '一定 (yī dìng) ➔ Đọc là: yí dìng',
    audioText: '一定',
  },
];

export const TonePracticeView: React.FC = () => {
  const [selectedQuizIndex, setSelectedQuizIndex] = useState(0);
  const [userSelectedTone, setUserSelectedTone] = useState<number | null>(null);

  const QUIZ_ITEMS = [
    { char: '好', pinyin: 'hǎo', correctTone: 3, word: '你好' },
    { char: '学', pinyin: 'xué', correctTone: 2, word: '学习' },
    { char: '是', pinyin: 'shì', correctTone: 4, word: '我是' },
    { char: '天', pinyin: 'tiān', correctTone: 1, word: '今天' },
  ];

  const currentQuiz = QUIZ_ITEMS[selectedQuizIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E5E1] shadow-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0EFED] text-[#2D2D2D] text-xs font-bold mb-2 border border-[#E5E5E1]">
          <Music className="w-3.5 h-3.5 text-red-600" /> Chinese Tone Focus (声调)
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#2D2D2D]">
          Luyện 4 Thanh Điệu & Biến Điệu Tiếng Trung
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Tiếng Trung có 4 thanh điệu chính và khinh thanh. Nắm vững thanh điệu giúp phát âm tự nhiên và chính xác.
        </p>
      </div>

      {/* 5 Tone Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {TONES.map((tone) => (
          <div
            key={tone.number}
            className={`rounded-2xl p-4 border border-[#E5E5E1] bg-white shadow-xs space-y-2 flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-lg font-black font-mono ${tone.toneColor}`}>
                  {tone.contour}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F6] border border-[#E5E5E1] text-gray-700">
                  Thanh {tone.number === 0 ? 'Nhẹ' : tone.number}
                </span>
              </div>

              <h3 className="text-xs font-bold text-[#2D2D2D] mt-2">{tone.nameZh}</h3>
              <p className="text-[11px] font-semibold text-gray-700 leading-tight">
                {tone.nameVi}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                {tone.description}
              </p>
            </div>

            {/* Example Character & Audio */}
            <div className="pt-2 border-t border-[#E5E5E1] flex items-center justify-between">
              <div>
                <span className="text-2xl font-medium font-chinese text-[#2D2D2D]">
                  {tone.exampleChar}
                </span>
                <span className={`ml-1 text-xs font-mono ${tone.toneColor}`}>
                  ({tone.examplePinyin})
                </span>
              </div>
              <AudioPlayer text={tone.exampleChar} compact />
            </div>
          </div>
        ))}
      </div>

      {/* Tone Sandhi Rules Section */}
      <div className="bg-white rounded-2xl border border-[#E5E5E1] shadow-xs p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          ⚡ Quy Tắc Biến Điệu Thanh Điệu Quan Trọng (Tone Sandhi Rules)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SANDHI_RULES.map((rule, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E5E1] space-y-2 flex flex-col justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-red-600">{rule.title}</h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{rule.rule}</p>
                <div className="mt-2 font-mono text-xs font-bold text-[#2D2D2D] bg-white p-2 rounded-lg border border-[#E5E5E1]">
                  {rule.example}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <AudioPlayer text={rule.audioText} compact label="Nghe mẫu" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Tone Listening Quiz */}
      <div className="bg-[#2D2D2D] text-white rounded-2xl border border-[#E5E5E1] shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-700 pb-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
            🎯 Luyện Tập Nhận Biết Thanh Điệu Qua Tai Nghe
          </h3>
          <span className="text-xs font-mono text-gray-400">
            Câu {selectedQuizIndex + 1} / {QUIZ_ITEMS.length}
          </span>
        </div>

        <div className="text-center space-y-3 py-2">
          <p className="text-xs text-gray-300">
            Nghe phát âm từ bên dưới và chọn thanh điệu chính xác của chữ{' '}
            <span className="font-chinese font-bold text-amber-300 text-base">
              "{currentQuiz.char}"
            </span>:
          </p>

          <div className="inline-block">
            <AudioPlayer text={currentQuiz.word} label={`Nghe phát âm: ${currentQuiz.word}`} />
          </div>

          {/* Tone Choice Buttons */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {[1, 2, 3, 4].map((t) => (
              <button
                key={t}
                onClick={() => setUserSelectedTone(t)}
                id={`btn-tone-quiz-${t}`}
                className={`px-4 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                  userSelectedTone === t
                    ? t === currentQuiz.correctTone
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-rose-600 text-white border-rose-500'
                    : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                }`}
              >
                Thanh {t}
              </button>
            ))}
          </div>

          {userSelectedTone !== null && (
            <div className="mt-3 text-xs font-bold">
              {userSelectedTone === currentQuiz.correctTone ? (
                <p className="text-emerald-400">
                  🎉 Chính xác! Chữ "{currentQuiz.char}" ({currentQuiz.pinyin}) mang Thanh{' '}
                  {currentQuiz.correctTone}.
                </p>
              ) : (
                <p className="text-rose-400">
                  ❌ Chưa đúng. Chữ "{currentQuiz.char}" ({currentQuiz.pinyin}) mang Thanh{' '}
                  {currentQuiz.correctTone}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
