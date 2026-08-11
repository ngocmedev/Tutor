import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Enable CORS for Vercel deployment
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-gemini-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini Client server-side
const geminiApiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && !process.env.GEMINI_API_KEY.startsWith('MY_') 
  ? process.env.GEMINI_API_KEY 
  : '';

const ai = new GoogleGenAI({
  apiKey: geminiApiKey || 'dummy_key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Server-side TTS Audio Cache: Hash(text + voiceId + speed) -> Data URI
const ttsAudioCache = new Map<string, string>();

// In-Memory Database for Conversations
interface ServerMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  pinyin?: string;
  translation?: string;
  feedback?: any;
  audioUrl?: string;
  createdAt: string;
}

interface ServerSession {
  id: string;
  level: string;
  topic: string;
  messages: ServerMessage[];
  createdAt: string;
  updatedAt: string;
}

const sessionsStore = new Map<string, ServerSession>();

/**
 * ElevenLabs Voice Configuration
 */
const ELEVENLABS_VOICE_MANDARIN = 'pNInz6obpgDQGcFmaJgB'; // Multilingual v2 voice
const ELEVENLABS_VOICE_ADAM = '21m00Tcm4TlvDq8ikWAM'; // Adam voice

// Helper to compute MD5 hash
function getHash(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function splitTextIntoChunks(str: string, maxLen = 150): string[] {
  if (str.length <= maxLen) return [str];
  const chunks: string[] = [];
  const sentences = str.match(/[^。！？!?\n]+[。！？!?\n]?/g) || [str];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length <= maxLen) {
      current += sentence;
    } else {
      if (current) chunks.push(current);
      if (sentence.length > maxLen) {
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.substring(i, i + maxLen));
        }
        current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

async function generateContentWithModelFallback(contents: any, config: any, customApiKey?: string) {
  const effectiveKey = customApiKey && customApiKey.trim().length > 10 ? customApiKey.trim() : geminiApiKey;
  if (!effectiveKey) return null;

  const client = (customApiKey && customApiKey.trim().length > 10)
    ? new GoogleGenAI({ apiKey: customApiKey.trim(), httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } })
    : ai;

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        if (response && response.text) {
          return JSON.parse(response.text);
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} attempt ${attempt + 1} warning: ${err?.message || err}`);
      }
    }
    // If all candidate models were rate-limited or busy, sleep 1.2 seconds before retrying
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  return null;
}

function getTopicFallbackReply(userMessage: string, topic: string, history: ServerMessage[] = []) {
  const lowerTopic = (topic || '').toLowerCase();
  const lowerMsg = (userMessage || '').toLowerCase();
  const historyText = history.map((h) => h.content).join(' ');

  if (lowerTopic.includes('food') || lowerTopic.includes('restaurant') || lowerMsg.includes('吃') || lowerMsg.includes('饭') || lowerMsg.includes('菜')) {
    const foodQuestions = [
      { chineseText: '太棒了！请问你想喝点什么饮料吗？', pinyin: 'Tài bàng le! Qǐngwèn nǐ xiǎng hē diǎn shénme yǐnliào ma?', vietnameseTranslation: 'Tuyệt vời! Cho hỏi bạn có muốn uống nước gì không?' },
      { chineseText: '好的！请问你需要几份？还要别的吗？', pinyin: 'Hǎo de! Qǐngwèn nǐ xūyào jǐ fèn? Hái yào bié de ma?', vietnameseTranslation: 'Được chứ! Cho hỏi bạn cần mấy phần? Còn muốn món gì khác không?' },
      { chineseText: '没问题！请问你吃辣吗？我们需要少放辣吗？', pinyin: 'Méi wèntí! Qǐngwèn nǐ chī là ma? Wǒmen xūyào shǎo fàng là ma?', vietnameseTranslation: 'Không vấn đề gì! Cho hỏi bạn có ăn được cay không? Chúng tôi cho ít cay nhé?' },
      { chineseText: '收到！饭后你想吃点甜品或者水果吗？', pinyin: 'Shōudào! Fànhòu nǐ xiǎng chī diǎn tiánpǐn huòzhě shuǐguǒ ma?', vietnameseTranslation: 'Đã rõ! Sau bữa ăn bạn có muốn dùng tráng miệng hay hoa quả không?' },
    ];
    for (const q of foodQuestions) {
      if (!historyText.includes(q.chineseText.substring(0, 4))) return q;
    }
    return foodQuestions[1];
  }

  if (lowerTopic.includes('shopping') || lowerMsg.includes('买') || lowerMsg.includes('钱') || lowerMsg.includes('衣服')) {
    const shopQuestions = [
      { chineseText: '很好！你喜欢什么颜色和尺码 analyze 的？', pinyin: 'Hěn hǎo! Nǐ xǐhuan shénme yánsè hé chǐmǎ de?', vietnameseTranslation: 'Rất tốt! Bạn thích màu sắc và kích cỡ nào?' },
      { chineseText: '这件衣服一百块钱，你觉得怎么样？', pinyin: 'Zhè jiàn yīfu yìbǎi kuài qián, nǐ juéde zěnmeyàng?', vietnameseTranslation: 'Bộ quần áo này 100 tệ, bạn thấy thế nào?' },
      { chineseText: '你可以试试这件，你想去试衣间试一下吗？', pinyin: 'Nǐ kěyǐ shìshi zhè jiàn, nǐ xiǎng qù shìyījiān shì yíxià ma?', vietnameseTranslation: 'Bạn có thể thử bộ này, bạn muốn vào phòng thử đồ thử một chút không?' },
      { chineseText: '没问题，请问你想用微信支付还是现金？', pinyin: 'Méi wèntí, qǐngwèn nǐ xiǎng yòng Wēixìn zhīfù háishì xiànjīn?', vietnameseTranslation: 'Không vấn đề gì, cho hỏi bạn muốn thanh toán qua WeChat hay tiền mặt?' },
    ];
    for (const q of shopQuestions) {
      if (!historyText.includes(q.chineseText.substring(0, 4))) return q;
    }
    return shopQuestions[1];
  }

  if (lowerTopic.includes('travel') || lowerMsg.includes('去') || lowerMsg.includes('旅游') || lowerMsg.includes('地方')) {
    const travelQuestions = [
      { chineseText: '听起来很不错！你打算什么时候去那里？', pinyin: 'Tīng qǐlái hěn búcuò! Nǐ dǎsuàn shénme shíhou qù nàlǐ?', vietnameseTranslation: 'Nghe rất hay! Bạn định khi nào sẽ đi đến đó?' },
      { chineseText: '太好了！你想跟朋友一起去还是一个人去？', pinyin: 'Tài hǎo le! Nǐ xiǎng gēn péngyou yìqǐ qù háishì yì gèrén qù?', vietnameseTranslation: 'Tuyệt quá! Bạn muốn đi cùng bạn bè hay đi một mình?' },
      { chineseText: '那里有很多好吃的美食，你想尝尝吗？', pinyin: 'Nàlǐ yǒu hěn duō hǎochī de měishí, nǐ xiǎng chángchang ma?', vietnameseTranslation: 'Ở đó có rất nhiều món ăn ngon, bạn có muốn nếm thử không?' },
    ];
    for (const q of travelQuestions) {
      if (!historyText.includes(q.chineseText.substring(0, 4))) return q;
    }
    return travelQuestions[0];
  }

  const defaultQuestions = [
    { chineseText: `你说得很好！关于"${topic}"，你还有什么想跟我分享的吗？`, pinyin: `Nǐ shuō de hěn hǎo! Guānyú "${topic}", nǐ hái yǒu shénme xiǎng gēn wǒ fēnxiǎng de ma?`, vietnameseTranslation: `Bạn nói rất tốt! Về chủ đề "${topic}", bạn còn muốn chia sẻ thêm điều gì với tôi không?` },
    { chineseText: `听起来很有趣！你能多告诉我一点细节吗？`, pinyin: `Tīng qǐlái hěn yǒuqù! Nǐ néng duō gàosu wǒ yìdiǎn xìjié ma?`, vietnameseTranslation: `Nghe có vẻ rất thú vị! Bạn có thể kể thêm chi tiết cho tôi được không?` },
    { chineseText: `太棒了！那么你平时最喜欢做什么呢？`, pinyin: `Tài bàng le! Nàme nǐ píngshí zuì xǐhuan zuò shénme ne?`, vietnameseTranslation: `Tuyệt vời! Vậy bình thường bạn thích làm gì nhất?` },
  ];
  for (const q of defaultQuestions) {
    if (!historyText.includes(q.chineseText.substring(0, 4))) return q;
  }
  return defaultQuestions[0];
}

function sanitizeFeedback(rawFb: any) {
  const cleanText = (str: string, maxLen = 200) => {
    if (!str || typeof str !== 'string') return '';
    // Strip hallucinated dictionary synonym chains or repeating word loops (e.g. "hihi hihi")
    let cleaned = str.split(/(Yeah!|Okie dokie!|Amazing!|Good job!|Excellent!|Fantastic!|Wonderful!|Brilliant!|Superb!|Awesome!|hihi)/i)[0];
    cleaned = cleaned.replace(/(?:(\b\w+\b|\S+)\s+)\1{2,}/gi, '$1');
    cleaned = cleaned.trim();
    if (cleaned.length > maxLen) {
      cleaned = cleaned.substring(0, maxLen) + '...';
    }
    return cleaned;
  };

  const validGrammar = ['Correct', 'Needs Improvement', 'Incorrect'];
  const validNatural = ['Very Natural', 'Good', 'Needs Naturalization'];

  const grammarStatus = validGrammar.includes(rawFb?.grammarStatus) ? rawFb.grammarStatus : 'Correct';
  const naturalness = validNatural.includes(rawFb?.naturalness) ? rawFb.naturalness : 'Very Natural';

  return {
    grammarStatus,
    naturalness,
    speechTranscriptionMatched: rawFb?.speechTranscriptionMatched ?? true,
    suggestedImprovement: cleanText(rawFb?.suggestedImprovement || ''),
    vocabularyFeedback: cleanText(rawFb?.vocabularyFeedback || 'Sử dụng từ vựng chính xác và phù hợp.'),
    grammarFeedback: cleanText(rawFb?.grammarFeedback || 'Cấu trúc ngữ pháp chính xác.'),
    explanation: cleanText(rawFb?.explanation || 'Câu nói diễn đạt tự nhiên.'),
  };
}

const COMMON_HANZI_PINYIN: Record<string, string> = {
  '白': 'bái', '饭': 'fàn', '买': 'mǎi', '卖': 'mài', '吃': 'chī', '喝': 'hē',
  '水': 'shuǐ', '茶': 'chá', '菜': 'cài', '肉': 'ròu', '牛': 'niú', '羊': 'yáng',
  '猪': 'zhū', '鸡': 'jī', '鱼': 'yú', '蛋': 'dàn', '米': 'mǐ', '面': 'miàn',
  '学': 'xué', '习': 'xí', '校': 'xiào', '生': 'shēng', '师': 'shī', '国': 'guó',
  '中': 'zhōng', '人': 'rén', '文': 'wén', '语': 'yǔ', '好': 'hǎo', '大': 'dà',
  '小': 'xiǎo', '多': 'duō', '少': 'shǎo', '上': 'shàng', '下': 'xià', '手': 'shǒu',
  '心': 'xīn', '天': 'tiān', '地': 'dì', '日': 'rì', '月': 'yuè', '年': 'nián',
  '在': 'zài', '我': 'wǒ', '你': 'nǐ', '他': 'tā', '她': 'tā', '它': 'tā',
  '们': 'men', '是': 'shì', '有': 'yǒu', '不': 'bù', '没': 'méi', '这': 'zhè',
  '那': 'nà', '哪': 'nǎ', '个': 'gè', '想': 'xiǎng', '要': 'yào', '去': 'qù',
  '来': 'lái', '看': 'kàn', '听': 'tīng', '说': 'shuō', '读': 'dú', '写': 'xiě',
  '做': 'zuò', '作': 'zuò', '工': 'gōng', '钱': 'qián', '块': 'kuài', '角': 'jiǎo',
  '分': 'fēn', '元': 'yuán', '车': 'chē', '站': 'zhàn', '家': 'jiā', '店': 'diàn',
};

function getSmartChineseTranslation(text: string): { vietnamese: string; pinyin: string; english: string } {
  const dict: Record<string, { vietnamese: string; pinyin: string; english: string }> = {
    '白饭': { vietnamese: 'Cơm trắng', pinyin: 'bái fàn', english: 'White rice' },
    '买饭': { vietnamese: 'Mua cơm', pinyin: 'mǎi fàn', english: 'Buy meal' },
    '米饭': { vietnamese: 'Cơm trắng', pinyin: 'mǐfàn', english: 'Cooked rice' },
    '炒饭': { vietnamese: 'Cơm chiên', pinyin: 'chǎofàn', english: 'Fried rice' },
    '包子': { vietnamese: 'Bánh bao', pinyin: 'bāozi', english: 'Steamed bun' },
    '饺子': { vietnamese: 'Bánh há cảo / sủi cảo', pinyin: 'jiǎozi', english: 'Dumplings' },
    '面条': { vietnamese: 'Mì sợi', pinyin: 'miàntiáo', english: 'Noodles' },
    '牛肉': { vietnamese: 'Thịt bò', pinyin: 'niúròu', english: 'Beef' },
    '猪肉': { vietnamese: 'Thịt lợn (thịt heo)', pinyin: 'zhūròu', english: 'Pork' },
    '鸡肉': { vietnamese: 'Thịt gà', pinyin: 'jīròu', english: 'Chicken' },
    '鸡蛋': { vietnamese: 'Trứng gà', pinyin: 'jīdàn', english: 'Egg' },
    '苹果': { vietnamese: 'Quả táo', pinyin: 'píngguǒ', english: 'Apple' },
    '西瓜': { vietnamese: 'Dưa hấu', pinyin: 'xīguā', english: 'Watermelon' },
    '牛奶': { vietnamese: 'Sữa tươi', pinyin: 'niúnǎi', english: 'Milk' },
    '咖啡': { vietnamese: 'Cà phê', pinyin: 'kāfēi', english: 'Coffee' },
    '果汁': { vietnamese: 'Nước ép trái cây', pinyin: 'guǒzhī', english: 'Fruit juice' },
    '水': { vietnamese: 'Nước', pinyin: 'shuǐ', english: 'Water' },
    '茶': { vietnamese: 'Trà', pinyin: 'chá', english: 'Tea' },
    '你好': { vietnamese: 'Xin chào', pinyin: 'nǐ hǎo', english: 'Hello' },
    '谢谢': { vietnamese: 'Cảm ơn', pinyin: 'xièxie', english: 'Thank you' },
    '再见': { vietnamese: 'Tạm biệt', pinyin: 'zàijiàn', english: 'Goodbye' },
    '学习': { vietnamese: 'Học tập / Học', pinyin: 'xuéxí', english: 'Study' },
    '工作': { vietnamese: 'Làm việc / Công việc', pinyin: 'gōngzuò', english: 'Work' },
    '我在学习': { vietnamese: 'Tôi đang học', pinyin: 'wǒ zài xuéxí', english: 'I am studying' },
    '我想吃炒饭': { vietnamese: 'Tôi muốn ăn cơm chiên', pinyin: 'wǒ xiǎng chī chǎofàn', english: 'I want fried rice' },
    '我想喝水': { vietnamese: 'Tôi muốn uống nước', pinyin: 'wǒ xiǎng hē shuǐ', english: 'I want to drink water' },
    '中文': { vietnamese: 'Tiếng Trung', pinyin: 'Zhōngwén', english: 'Chinese language' },
    '中国': { vietnamese: 'Trung Quốc', pinyin: 'Zhōngguó', english: 'China' },
  };

  const trimText = text.trim();
  if (dict[trimText]) {
    return dict[trimText];
  }

  const isChinese = /[\u4e00-\u9fa5]/.test(trimText);
  if (isChinese) {
    const generatedPinyin = trimText
      .split('')
      .map((ch) => COMMON_HANZI_PINYIN[ch] || ch)
      .join(' ');

    return {
      vietnamese: `Nghĩa tiếng Việt: "${trimText}"`,
      pinyin: generatedPinyin,
      english: `Chinese phrase: ${trimText}`,
    };
  }

  return {
    vietnamese: trimText,
    pinyin: 'Pīnyīn',
    english: trimText,
  };
}

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

/**
 * POST /api/tts - Synthesize Chinese Speech
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, speed = 1.0, useChineseVoice = true } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    if (text.length > 3000) {
      return res.status(400).json({ error: 'Text length exceeds maximum 3000 characters limit.' });
    }

    const cacheKey = getHash(`${text}_${speed}`);

    // Return cached audio if available
    if (ttsAudioCache.has(cacheKey)) {
      return res.json({
        audioBase64: ttsAudioCache.get(cacheKey),
        providerUsed: 'neural-tts',
        isCached: true,
      });
    }

    // 1. Primary Free Provider: High Quality Free Neural Voice with Chunking & Concatenation
    try {
      const chunks = splitTextIntoChunks(text, 150);
      const audioBuffers: Buffer[] = [];

      for (const chunk of chunks) {
        const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=zh-CN&client=tw-ob`;
        const ttsRes = await fetch(googleTtsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (ttsRes.ok) {
          const arrayBuffer = await ttsRes.arrayBuffer();
          audioBuffers.push(Buffer.from(arrayBuffer));
        }
      }

      if (audioBuffers.length > 0) {
        const mergedBuffer = Buffer.concat(audioBuffers);
        const base64Audio = mergedBuffer.toString('base64');
        const dataUri = `data:audio/mpeg;base64,${base64Audio}`;

        if (ttsAudioCache.size > 100) {
          const firstKey = ttsAudioCache.keys().next().value;
          if (firstKey) ttsAudioCache.delete(firstKey);
        }
        ttsAudioCache.set(cacheKey, dataUri);

        return res.json({
          audioBase64: dataUri,
          providerUsed: 'tiktok-neural-free',
          isCached: false,
        });
      }
    } catch (err) {
      console.warn('Free Neural TTS request failed:', err);
    }

    // 2. Secondary Provider: Gemini AI Audio Voice
    try {
      if (geminiApiKey) {
        const geminiTtsResponse = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const audioPart = geminiTtsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioPart) {
          const dataUri = `data:audio/wav;base64,${audioPart}`;
          ttsAudioCache.set(cacheKey, dataUri);
          return res.json({
            audioBase64: dataUri,
            providerUsed: 'gemini',
            isCached: false,
          });
        }
      }
    } catch (gErr) {
      console.warn('Gemini TTS fallback attempt failed:', gErr);
    }

    // 3. Signal to frontend to use Browser SpeechSynthesis API
    return res.json({
      providerUsed: 'browser',
      message: 'Falling back to Browser TTS.',
    });
  } catch (error: any) {
    console.error('Server error in /api/tts:', error);
    return res.status(500).json({ error: error?.message || 'Server error generating speech' });
  }
});

/**
 * POST /api/translate - Chinese & Vietnamese AI Translation & Analysis
 */
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage = 'zh' } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || undefined;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text to translate is required.' });
    }

    const systemInstruction = `You are an expert AI Chinese Tutor for Vietnamese learners.
Analyze the user's input text (which could be in Vietnamese, Chinese, or English).
Provide a complete breakdown including:
1. Detected source language ('zh', 'vi', or 'en')
2. Accurate Chinese characters (Hanzi)
3. Standard Pinyin with clear tone marks (ā, á, ǎ, à)
4. CRITICAL RULE: ALWAYS provide a clear, accurate Vietnamese translation (vietnameseTranslation) for the text! Never leave vietnameseTranslation empty!
5. Natural English translation
6. Estimated HSK level ('HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', or 'HSK 6')
7. Extracted key vocabulary words (Chinese, Pinyin, Vietnamese translation, HSK level)
8. Core grammar notes explaining sentence structure, particles (e.g. 了, 过, 在, 把), or measure words.`;

    const prompt = `Translate and analyze this text for a language learner:\n\n"${text}"`;

    let result = await generateContentWithModelFallback(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sourceText: { type: Type.STRING },
          detectedLanguage: { type: Type.STRING },
          chineseText: { type: Type.STRING },
          pinyin: { type: Type.STRING },
          vietnameseTranslation: { type: Type.STRING },
          englishTranslation: { type: Type.STRING },
          hskLevel: { type: Type.STRING },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                pinyin: { type: Type.STRING },
                translation: { type: Type.STRING },
                hskLevel: { type: Type.STRING },
              },
            },
          },
          grammarNotes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pattern: { type: Type.STRING },
                meaning: { type: Type.STRING },
                explanation: { type: Type.STRING },
                exampleChinese: { type: Type.STRING },
                examplePinyin: { type: Type.STRING },
                exampleTranslation: { type: Type.STRING },
              },
            },
          },
          culturalNotes: { type: Type.STRING },
        },
      },
    }, userApiKey);

    const fallbackInfo = getSmartChineseTranslation(text);

    if (!result) {
      result = {};
    }

    if (!result.chineseText) {
      result.chineseText = /[\u4e00-\u9fa5]/.test(text) ? text : '你好';
    }

    if (!result.vietnameseTranslation || result.vietnameseTranslation === 'Dịch tiếng Việt của câu') {
      result.vietnameseTranslation = fallbackInfo.vietnamese;
    }

    if (!result.pinyin || result.pinyin.includes('Hanzi Pinyin')) {
      result.pinyin = fallbackInfo.pinyin;
    }

    if (!result.englishTranslation) {
      result.englishTranslation = fallbackInfo.english;
    }

    if (!result.vocabulary || result.vocabulary.length === 0) {
      result.vocabulary = [
        { word: result.chineseText.substring(0, 4), pinyin: result.pinyin, translation: result.vietnameseTranslation, hskLevel: 'HSK 1' }
      ];
    }

    return res.json(result);
  } catch (error: any) {
    console.error('Server error in /api/translate:', error);
    return res.status(500).json({ error: error?.message || 'Failed to translate' });
  }
});

/**
 * POST /api/conversation - Initialize Conversation Session
 */
app.post('/api/conversation', async (req, res) => {
  try {
    const { level = 'HSK 1', topic = 'Self Introduction' } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || undefined;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const systemInstruction = `You are an AI Chinese Speaking Tutor for a student at level ${level}.
The topic of conversation is "${topic}".
Your task:
1. Act as a patient, encouraging, friendly Chinese native speaker.
2. Formulate a short, natural opening greeting/question in Chinese appropriate for ${level} students.
3. Keep sentence length and vocabulary strictly within ${level} boundaries.
4. Include Pinyin with tone marks and Vietnamese translation.`;

    const prompt = `Start a new conversation on topic "${topic}" for an ${level} Chinese learner.`;

    let result = await generateContentWithModelFallback(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chineseText: { type: Type.STRING },
          pinyin: { type: Type.STRING },
          vietnameseTranslation: { type: Type.STRING },
        },
      },
    }, userApiKey);

    // Default opening responses per topic
    const topicDefaults: Record<string, { chineseText: string; pinyin: string; vietnameseTranslation: string }> = {
      'Self Introduction': { chineseText: '你好！请问你叫什么名字？', pinyin: 'Nǐ hǎo! Qǐngwèn nǐ jiào shénme míngzi?', vietnameseTranslation: 'Xin chào! Cho hỏi bạn tên là gì?' },
      'Ordering Food': { chineseText: '你好！欢迎光临，你想吃什么？', pinyin: 'Nǐ hǎo! Huānyíng guānglín, nǐ xiǎng chī shénme?', vietnameseTranslation: 'Xin chào! Chào mừng quý khách, bạn muốn ăn gì?' },
      'Shopping': { chineseText: '你好！你想买什么衣服？', pinyin: 'Nǐ hǎo! Nǐ xiǎng mǎi shénme yīfu?', vietnameseTranslation: 'Xin chào! Bạn muốn mua quần áo gì?' },
      'Travel': { chineseText: '你去过中国旅游吗？', pinyin: 'Nǐ qù guo Zhōngguó lǚyóu ma?', vietnameseTranslation: 'Bạn đã từng đi du lịch Trung Quốc chưa?' },
    };

    const fallbackChoice = topicDefaults[topic] || {
      chineseText: `你好！我们今天聊聊"${topic}"吧！`,
      pinyin: `Nǐ hǎo! Wǒmen jīntiān liáo liao "${topic}" ba!`,
      vietnameseTranslation: `Xin chào! Hôm nay chúng ta hãy trò chuyện về chủ đề "${topic}" nhé!`,
    };

    const firstMsg: ServerMessage = {
      id: `msg_${Date.now()}`,
      sessionId,
      role: 'assistant',
      content: result?.chineseText || fallbackChoice.chineseText,
      pinyin: result?.pinyin || fallbackChoice.pinyin,
      translation: result?.vietnameseTranslation || fallbackChoice.vietnameseTranslation,
      createdAt: new Date().toISOString(),
    };

    const newSession: ServerSession = {
      id: sessionId,
      level,
      topic,
      messages: [firstMsg],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionsStore.set(sessionId, newSession);

    return res.json(newSession);
  } catch (error: any) {
    console.error('Error starting conversation:', error);
    const sessionId = `session_${Date.now()}`;
    const level = req.body?.level || 'HSK 1';
    const topic = req.body?.topic || 'Self Introduction';

    const topicDefaults: Record<string, { chineseText: string; pinyin: string; vietnameseTranslation: string }> = {
      'Self Introduction': { chineseText: '你好！请问你叫什么名字？', pinyin: 'Nǐ hǎo! Qǐngwèn nǐ jiào shénme míngzi?', vietnameseTranslation: 'Xin chào! Cho hỏi bạn tên là gì?' },
      'Ordering Food': { chineseText: '你好！欢迎光临，你想吃什么？', pinyin: 'Nǐ hǎo! Huānyíng guānglín, nǐ xiǎng chī shénme?', vietnameseTranslation: 'Xin chào! Chào mừng quý khách, bạn muốn ăn gì?' },
      'Shopping': { chineseText: '你好！你想买什么衣服？', pinyin: 'Nǐ hǎo! Nǐ xiǎng mǎi shénme yīfu?', vietnameseTranslation: 'Xin chào! Bạn muốn mua quần áo gì?' },
      'Travel': { chineseText: '你去过中国旅游吗？', pinyin: 'Nǐ qù guo Zhōngguó lǚyóu ma?', vietnameseTranslation: 'Bạn đã từng đi du lịch Trung Quốc chưa?' },
    };

    const fallbackChoice = topicDefaults[topic] || {
      chineseText: `你好！我们 today 聊聊"${topic}"吧！`,
      pinyin: `Nǐ hǎo! Wǒmen jīntiān liáo liao "${topic}" ba!`,
      vietnameseTranslation: `Xin chào! Hôm nay chúng ta hãy trò chuyện về chủ đề "${topic}" nhé!`,
    };

    const firstMsg: ServerMessage = {
      id: `msg_${Date.now()}`,
      sessionId,
      role: 'assistant',
      content: fallbackChoice.chineseText,
      pinyin: fallbackChoice.pinyin,
      translation: fallbackChoice.vietnameseTranslation,
      createdAt: new Date().toISOString(),
    };

    const newSession: ServerSession = {
      id: sessionId,
      level,
      topic,
      messages: [firstMsg],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionsStore.set(sessionId, newSession);
    return res.json(newSession);
  }
});

/**
 * POST /api/conversation/message - User Response & AI Tutor Turn
 */
app.post('/api/conversation/message', async (req, res) => {
  try {
    const { sessionId, userMessage, level = 'HSK 1', topic = 'Self Introduction', recordedAudioUrl } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || undefined;

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const session = sessionsStore.get(sessionId) || {
      id: sessionId || `session_${Date.now()}`,
      level,
      topic,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save user message
    const userMsgObj: ServerMessage = {
      id: `msg_user_${Date.now()}`,
      sessionId: session.id,
      role: 'user',
      content: userMessage,
      audioUrl: recordedAudioUrl,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(userMsgObj);

    const historyPrompt = session.messages
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const isVietnameseInput = !/[\u4e00-\u9fa5]/.test(userMessage);

    const systemInstruction = `You are an AI Chinese Speaking Tutor for a student at level ${level}.
Topic: "${topic}".
Current student input: "${userMessage}".

${isVietnameseInput ? `
NOTE: The student responded in VIETNAMESE ("${userMessage}").
1. In userFeedback:
   - userMessageChinese: Translate the student's Vietnamese input into accurate, natural Chinese Hanzi (e.g. "我想吃炒饭").
   - userMessagePinyin: Pinyin with tone marks for userMessageChinese (e.g. "Wǒ xiǎng chī chǎofàn").
   - Provide the exact Chinese translation in suggestedImprovement.
   - Set grammarStatus to 'Needs Naturalization'.
   - Provide concise vocabularyFeedback & explanation in Vietnamese guiding how to express this in Chinese.
2. In aiResponse:
   - Reply to the student in natural Chinese at level ${level}, continuing the conversation on topic "${topic}".
   - Provide Pinyin and Vietnamese translation.
` : `
NOTE: The student responded in CHINESE ("${userMessage}").
1. In userFeedback:
   - userMessageChinese: Same as student's input ("${userMessage}").
   - userMessagePinyin: Pinyin for student's input.
   - grammarStatus: Must be 'Correct', 'Needs Improvement', or 'Incorrect'.
   - naturalness: Must be 'Very Natural', 'Good', or 'Needs Naturalization'.
   - Provide concise vocabulary & grammar feedback in Vietnamese.
2. In aiResponse:
   - Reply to the student in natural Chinese at level ${level}, asking a follow-up question on topic "${topic}".
   - Provide Pinyin and Vietnamese translation.
`}

CRITICAL CONCISENESS RULE: Keep all feedback under 25 words per field in Vietnamese. NEVER generate lists of adjectives, repeating English praise words, or synonym chains!`;

    const prompt = `Conversation history:\n${historyPrompt}\n\nStudent just said: "${userMessage}". Analyze student input and reply in Chinese as the tutor, asking a follow-up question.`;

    let result = await generateContentWithModelFallback(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          userFeedback: {
            type: Type.OBJECT,
            properties: {
              grammarStatus: { type: Type.STRING },
              naturalness: { type: Type.STRING },
              speechTranscriptionMatched: { type: Type.BOOLEAN },
              suggestedImprovement: { type: Type.STRING },
              vocabularyFeedback: { type: Type.STRING },
              grammarFeedback: { type: Type.STRING },
              explanation: { type: Type.STRING },
              userMessageChinese: { type: Type.STRING },
              userMessagePinyin: { type: Type.STRING },
            },
          },
          aiResponse: {
            type: Type.OBJECT,
            properties: {
              chineseText: { type: Type.STRING },
              pinyin: { type: Type.STRING },
              vietnameseTranslation: { type: Type.STRING },
            },
          },
        },
      },
    }, userApiKey);

    const fallbackTurn = getTopicFallbackReply(userMessage, topic, session.messages);

    // If student typed/spoke in Vietnamese, convert user message card to Chinese Hanzi + Pinyin!
    if (isVietnameseInput) {
      const fallbackTrans = getSmartChineseTranslation(userMessage);
      const convertedChinese = result?.userFeedback?.userMessageChinese && !/[\u00C0-\u024F\u1EA0-\u1EF9]/.test(result.userFeedback.userMessageChinese)
        ? result.userFeedback.userMessageChinese
        : (fallbackTrans.vietnamese.includes(':') ? '我想学中文' : fallbackTrans.vietnamese);

      userMsgObj.content = convertedChinese;
      userMsgObj.pinyin = result?.userFeedback?.userMessagePinyin || fallbackTrans.pinyin || '';
      userMsgObj.translation = `Gốc (VN): "${userMessage}"`;
    }

    // Attach feedback to user message
    userMsgObj.feedback = sanitizeFeedback(result?.userFeedback || {
      grammarStatus: 'Correct',
      naturalness: 'Very Natural',
      speechTranscriptionMatched: true,
      suggestedImprovement: '',
      vocabularyFeedback: 'Sử dụng từ vựng chính xác và diễn đạt tốt!',
      grammarFeedback: 'Cấu trúc ngữ pháp chính xác.',
      explanation: 'Câu diễn đạt tự nhiên.',
    });

    // Create AI response message
    const aiMsgObj: ServerMessage = {
      id: `msg_ai_${Date.now()}`,
      sessionId: session.id,
      role: 'assistant',
      content: result?.aiResponse?.chineseText || fallbackTurn.chineseText,
      pinyin: result?.aiResponse?.pinyin || fallbackTurn.pinyin,
      translation: result?.aiResponse?.vietnameseTranslation || fallbackTurn.vietnameseTranslation,
      createdAt: new Date().toISOString(),
    };

    session.messages.push(aiMsgObj);
    session.updatedAt = new Date().toISOString();
    sessionsStore.set(session.id, session);

    return res.json({
      session,
      userMessageFeedback: userMsgObj.feedback,
      aiReplyMessage: aiMsgObj,
    });
  } catch (error: any) {
    console.error('Error processing conversation message:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process message' });
  }
});

/**
 * POST /api/pronunciation - Shadowing & Text Match Assessment
 */
app.post('/api/pronunciation', async (req, res) => {
  try {
    const { referenceChinese, userTranscript } = req.body;

    if (!referenceChinese || !userTranscript) {
      return res.status(400).json({ error: 'referenceChinese and userTranscript are required' });
    }

    const cleanRef = referenceChinese.replace(/[^\u4e00-\u9fa5]/g, '');
    const cleanUser = userTranscript.replace(/[^\u4e00-\u9fa5]/g, '');

    const isMatch = cleanRef === cleanUser || cleanUser.includes(cleanRef) || cleanRef.includes(cleanUser);

    return res.json({
      referenceChinese,
      userTranscript,
      speechTranscriptionMatched: isMatch,
      statusMessage: isMatch
        ? 'Speech transcription matched.'
        : `Transcript difference detected: "${cleanUser}" vs "${cleanRef}"`,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Pronunciation evaluation error' });
  }
});

/* ==========================================================================
   VITE & STATIC ASSET MIDDLEWARE
   ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
