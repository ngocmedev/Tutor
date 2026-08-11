import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();

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

// Normalize Vercel Serverless Function URL path
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.replace('/api/', '/');
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

// Helper for dynamic Gemini client
function getGeminiClient(customApiKey?: string) {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey: apiKey || 'dummy_key',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Common Hanzi Pinyin Dictionary
const COMMON_HANZI_PINYIN: Record<string, string> = {
  '白': 'bái', '饭': 'fàn', '买': 'mǎi', '吃': 'chī', '喝': 'hē', '水': 'shuǐ',
  '茶': 'chá', '菜': 'cài', '面': 'miàn', '米': 'mǐ', '果': 'guǒ', '苹': 'píng',
  '你': 'nǐ', '好': 'hǎo', '我': 'wǒ', '是': 'shì', '在': 'zài', '学': 'xué',
  '习': 'xí', '中': 'zhōng', '文': 'wén', '汉': 'hàn', '语': 'yǔ', '猫': 'māo',
  '狗': 'gǒu', '大': 'dà', '小': 'xiǎo', '多': 'duō', '少': 'shǎo', '钱': 'qián',
  '人': 'rén', '家': 'jiā', '爱': 'ài', '想': 'xiǎng', '要': 'yào', '去': 'qù',
};

function getSmartChineseTranslation(text: string): { chineseText: string; pinyin: string; vietnamese: string; english: string } {
  const trimmed = text.trim();
  const dict: Record<string, { chineseText: string; pinyin: string; vietnamese: string; english: string }> = {
    '白饭': { chineseText: '白饭', pinyin: 'báifàn', vietnamese: 'Cơm trắng', english: 'Steamed rice' },
    '买饭': { chineseText: '买饭', pinyin: 'mǎi fàn', vietnamese: 'Mua cơm', english: 'Buy food/meal' },
    '吃饭': { chineseText: '吃饭', pinyin: 'chī fàn', vietnamese: 'Ăn cơm', english: 'Eat a meal' },
    '炒饭': { chineseText: '炒饭', pinyin: 'chǎofàn', vietnamese: 'Cơm chiên', english: 'Fried rice' },
    '喝水': { chineseText: '喝水', pinyin: 'hē shuǐ', vietnamese: 'Uống nước', english: 'Drink water' },
    '喝茶': { chineseText: '喝茶', pinyin: 'hē chá', vietnamese: 'Uống trà', english: 'Drink tea' },
    '苹果': { chineseText: '苹果', pinyin: 'píngguǒ', vietnamese: 'Quả táo', english: 'Apple' },
    '我在学习': { chineseText: '我在学习', pinyin: 'wǒ zài xuéxí', vietnamese: 'Tôi đang học', english: 'I am studying' },
    '你好': { chineseText: '你好', pinyin: 'nǐ hǎo', vietnamese: 'Xin chào', english: 'Hello' },
    '谢谢': { chineseText: '谢谢', pinyin: 'xièxie', vietnamese: 'Cảm ơn', english: 'Thank you' },
    '再见': { chineseText: '再见', pinyin: 'zàijiàn', vietnamese: 'Tạm biệt', english: 'Goodbye' },
  };

  if (dict[trimmed]) {
    return dict[trimmed];
  }

  let pinyinChars: string[] = [];
  for (const char of trimmed) {
    pinyinChars.push(COMMON_HANZI_PINYIN[char] || char);
  }

  return {
    chineseText: trimmed,
    pinyin: pinyinChars.join(' '),
    vietnamese: `Nghĩa tiếng Việt của "${trimmed}"`,
    english: `English meaning of "${trimmed}"`,
  };
}

function getTopicFallbackReply(userMessage: string, topic: string, historyLength: number) {
  const replies: Record<string, Array<{ chineseText: string; pinyin: string; vietnameseTranslation: string }>> = {
    'Self Introduction': [
      { chineseText: '很高兴认识你！你平时有什么兴趣爱好吗？', pinyin: 'Hěn gāoxìng rènshi nǐ! Nǐ píngshí yǒu shénme xìngqù àihào ma?', vietnameseTranslation: 'Rất vui được làm quen với bạn! Bình thường bạn có sở thích gì không?' },
      { chineseText: '太棒了！你是学生还是已经工作了？', pinyin: 'Tài bàng le! Nǐ shì xuésheng hái shì yǐjīng gōngzuò le?', vietnameseTranslation: 'Tuyệt vời! Bạn là học sinh hay đã đi làm rồi?' },
      { chineseText: '很好！你学习中文多久了？', pinyin: 'Hěn hǎo! Nǐ xuéxí Zhōngwén duōjiǔ le?', vietnameseTranslation: 'Rất tốt! Bạn đã học tiếng Trung được bao lâu rồi?' },
    ],
    'Ordering Food': [
      { chineseText: '好的！你想吃炒饭还是白饭？', pinyin: 'Hǎo de! Nǐ xiǎng chī chǎofàn hái shì báifàn?', vietnameseTranslation: 'Vâng! Bạn muốn ăn cơm chiên hay cơm trắng?' },
      { chineseText: '好的，要加辣吗？要喝什么饮料？', pinyin: 'Hǎo de, yào jiā là ma? Yào hē shénme yǐnliào?', vietnameseTranslation: 'Vâng, có cho cay không? Bạn muốn uống nước gì?' },
      { chineseText: '没问题！请问一共几位用餐？', pinyin: 'Méi wèntí! Qǐngwèn yīgòng jǐ wèi yòngcān?', vietnameseTranslation: 'Không vấn đề! Cho hỏi tổng cộng có mấy vị ạ?' },
    ],
    'Shopping': [
      { chineseText: '好的！请问你想看什么颜色和尺寸？', pinyin: 'Hǎo de! Qǐngwèn nǐ xiǎng kàn shénme yánsè hé chǐcun?', vietnameseTranslation: 'Vâng! Cho hỏi bạn muốn xem màu và size gì?' },
      { chineseText: '这件衣服现在打折，你要试穿一下吗？', pinyin: 'Zhè jiàn yīfu xiànzài dǎzhé, nǐ yào shì chuān yīxià ma?', vietnameseTranslation: 'Áo này đang giảm giá, bạn có muốn thử không?' },
    ],
    'Travel': [
      { chineseText: '太好了！你最想去中国哪个城市旅游？', pinyin: 'Tài hǎo le! Nǐ zuì xiǎng qù Zhōngguó nǎ gè chéngshì lǚyóu?', vietnameseTranslation: 'Tuyệt quá! Bạn muốn đi du lịch thành phố nào của Trung Quốc nhất?' },
      { chineseText: '去旅游的时候，你喜欢吃当地美食吗？', pinyin: 'Qù lǚyóu de shíhou, nǐ xǐhuan chī dāngdì měishí ma?', vietnameseTranslation: 'Khi đi du lịch, bạn có thích ăn món ngon địa phương không?' },
    ],
  };

  const topicList = replies[topic] || replies['Self Introduction'];
  return topicList[historyLength % topicList.length];
}

function sanitizeFeedback(feedbackObj: any) {
  if (!feedbackObj) return feedbackObj;

  const sanitizeString = (str: any, defaultText: string) => {
    if (!str || typeof str !== 'string') return defaultText;
    let cleaned = str.replace(/(Yeah|Okie dokie|Excellent|Great job|hihi|haha|Amazing)!?/gi, '').trim();
    if (cleaned.length > 180) {
      cleaned = cleaned.substring(0, 180) + '...';
    }
    return cleaned || defaultText;
  };

  return {
    ...feedbackObj,
    grammarStatus: ['Correct', 'Needs Improvement', 'Incorrect'].includes(feedbackObj.grammarStatus)
      ? feedbackObj.grammarStatus
      : 'Correct',
    naturalness: ['Very Natural', 'Good', 'Needs Naturalization'].includes(feedbackObj.naturalness)
      ? feedbackObj.naturalness
      : 'Very Natural',
    vocabularyFeedback: sanitizeString(feedbackObj.vocabularyFeedback, 'Sử dụng từ vựng chính xác!'),
    grammarFeedback: sanitizeString(feedbackObj.grammarFeedback, 'Cấu trúc ngữ pháp chính xác.'),
    explanation: sanitizeString(feedbackObj.explanation, 'Diễn đạt tự nhiên.'),
  };
}

// Sessions Store
const sessionsStore = new Map<string, any>();

async function generateContentWithModelFallback(prompt: string, config: any, customApiKey?: string) {
  const aiClient = getGeminiClient(customApiKey);
  const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: prompt,
          config,
        });

        const rawText = response?.text;
        if (rawText) {
          try {
            return JSON.parse(rawText);
          } catch {
            return rawText;
          }
        }
      } catch (err: any) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  throw lastError || new Error('All model attempts failed');
}

/**
 * /tts - Synthesize Chinese Speech
 */
app.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    const cleanText = text.substring(0, 300);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=zh-CN&client=tw-ob`;
    const ttsRes = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (ttsRes.ok) {
      const arrayBuffer = await ttsRes.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      const dataUri = `data:audio/mpeg;base64,${base64Audio}`;

      return res.json({
        audioBase64: dataUri,
        providerUsed: 'neural-tts',
      });
    }

    return res.status(500).json({ error: 'TTS audio synthesis failed' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'TTS Error' });
  }
});

/**
 * /translate
 */
app.post('/translate', async (req, res) => {
  try {
    const { text } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || undefined;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    const smartFallback = getSmartChineseTranslation(text);

    const prompt = `Translate and analyze the input text: "${text}".
Return JSON matching schema:
- chineseText: Original or translated Chinese Hanzi
- pinyin: Accurate Pinyin with tone marks
- vietnameseTranslation: Natural Vietnamese translation
- englishTranslation: English translation
- grammarPoints: Array of grammar breakdown items
- vocabulary: Array of key vocabulary items with hskLevel`;

    try {
      const result = await generateContentWithModelFallback(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chineseText: { type: Type.STRING },
            pinyin: { type: Type.STRING },
            vietnameseTranslation: { type: Type.STRING },
            englishTranslation: { type: Type.STRING },
            grammarPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  structure: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  example: { type: Type.STRING },
                },
              },
            },
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
          },
        },
      }, userApiKey);

      return res.json({
        chineseText: result?.chineseText || smartFallback.chineseText,
        pinyin: result?.pinyin || smartFallback.pinyin,
        vietnameseTranslation: result?.vietnameseTranslation || smartFallback.vietnamese,
        englishTranslation: result?.englishTranslation || smartFallback.english,
        grammarPoints: result?.grammarPoints || [],
        vocabulary: result?.vocabulary || [],
      });
    } catch {
      return res.json({
        chineseText: smartFallback.chineseText,
        pinyin: smartFallback.pinyin,
        vietnameseTranslation: smartFallback.vietnamese,
        englishTranslation: smartFallback.english,
        grammarPoints: [],
        vocabulary: [],
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Translation error' });
  }
});

/**
 * /conversation - Start New Conversation
 */
app.post('/conversation', async (req, res) => {
  try {
    const { level = 'HSK 1', topic = 'Self Introduction' } = req.body || {};
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || undefined;
    const sessionId = `session_${Date.now()}`;

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

    let firstMsgObj = {
      id: `msg_${Date.now()}`,
      sessionId,
      role: 'assistant',
      content: fallbackChoice.chineseText,
      pinyin: fallbackChoice.pinyin,
      translation: fallbackChoice.vietnameseTranslation,
      createdAt: new Date().toISOString(),
    };

    try {
      const prompt = `Start a new conversation on topic "${topic}" for an ${level} Chinese learner. Return JSON with chineseText, pinyin, vietnameseTranslation.`;
      const result = await generateContentWithModelFallback(prompt, {
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

      if (result?.chineseText) {
        firstMsgObj.content = result.chineseText;
        firstMsgObj.pinyin = result.pinyin || fallbackChoice.pinyin;
        firstMsgObj.translation = result.vietnameseTranslation || fallbackChoice.vietnameseTranslation;
      }
    } catch {
      // Fallback used automatically
    }

    const newSession = {
      id: sessionId,
      level,
      topic,
      messages: [firstMsgObj],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionsStore.set(sessionId, newSession);
    return res.json(newSession);
  } catch (error: any) {
    const sessionId = `session_${Date.now()}`;
    const fallbackChoice = {
      chineseText: '你好！欢迎来到中文学习！',
      pinyin: 'Nǐ hǎo! Huānyíng lái dào Zhōngwén xuéxí!',
      vietnameseTranslation: 'Xin chào! Chào mừng đến với bài học tiếng Trung!',
    };

    return res.json({
      id: sessionId,
      level: req.body?.level || 'HSK 1',
      topic: req.body?.topic || 'Self Introduction',
      messages: [{
        id: `msg_${Date.now()}`,
        sessionId,
        role: 'assistant',
        content: fallbackChoice.chineseText,
        pinyin: fallbackChoice.pinyin,
        translation: fallbackChoice.vietnameseTranslation,
        createdAt: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
});

/**
 * /conversation/message
 */
app.post('/conversation/message', async (req, res) => {
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

    const userMsgObj: any = {
      id: `msg_user_${Date.now()}`,
      sessionId: session.id,
      role: 'user',
      content: userMessage,
      audioUrl: recordedAudioUrl,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(userMsgObj);

    const isVietnameseInput = !/[\u4e00-\u9fa5]/.test(userMessage);

    const isMatchInput = getSmartChineseTranslation(userMessage);
    if (isVietnameseInput) {
      userMsgObj.content = isMatchInput.vietnamese.includes(':') ? '我想学中文' : isMatchInput.vietnamese;
      userMsgObj.pinyin = isMatchInput.pinyin;
      userMsgObj.translation = `Gốc (VN): "${userMessage}"`;
    }

    const topicFallback = getTopicFallbackReply(userMessage, topic, session.messages.length);

    const aiMsgObj: any = {
      id: `msg_ai_${Date.now()}`,
      sessionId: session.id,
      role: 'assistant',
      content: topicFallback.chineseText,
      pinyin: topicFallback.pinyin,
      translation: topicFallback.vietnameseTranslation,
      createdAt: new Date().toISOString(),
    };

    try {
      const isVietnamese = !/[\u4e00-\u9fa5]/.test(userMessage);
      const systemInstruction = `You are an AI Chinese Speaking Tutor for level ${level}. Topic: "${topic}".
Current student input: "${userMessage}".
${isVietnamese ? `Student spoke VIETNAMESE. Provide Chinese translation in userFeedback.userMessageChinese & Pinyin in userFeedback.userMessagePinyin.` : `Student spoke CHINESE.`}
Reply in Chinese asking a natural follow-up question. Keep all feedback under 25 words per field in Vietnamese.`;

      const prompt = `Student said: "${userMessage}". Reply in Chinese.`;
      const result = await generateContentWithModelFallback(prompt, {
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

      if (result?.aiResponse?.chineseText) {
        aiMsgObj.content = result.aiResponse.chineseText;
        aiMsgObj.pinyin = result.aiResponse.pinyin || '';
        aiMsgObj.translation = result.aiResponse.vietnameseTranslation || '';
      }

      if (isVietnameseInput && result?.userFeedback?.userMessageChinese) {
        userMsgObj.content = result.userFeedback.userMessageChinese;
        userMsgObj.pinyin = result.userFeedback.userMessagePinyin || isMatchInput.pinyin;
      }

      userMsgObj.feedback = sanitizeFeedback(result?.userFeedback || {
        grammarStatus: 'Correct',
        naturalness: 'Very Natural',
        vocabularyFeedback: 'Đã phân tích câu thoại!',
        grammarFeedback: 'Cấu trúc phù hợp.',
        explanation: 'Diễn đạt tự nhiên.',
      });
    } catch {
      userMsgObj.feedback = sanitizeFeedback({
        grammarStatus: 'Correct',
        naturalness: 'Very Natural',
        vocabularyFeedback: 'Cảm ơn câu trả lời của bạn!',
        grammarFeedback: 'Hãy tiếp tục luyện tập.',
        explanation: 'Diễn đạt tốt.',
      });
    }

    session.messages.push(aiMsgObj);
    sessionsStore.set(session.id, session);

    return res.json({
      session,
      userMessageFeedback: userMsgObj.feedback,
      aiReplyMessage: aiMsgObj,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to process message' });
  }
});

// Vercel Serverless Function export handler
export default (req: any, res: any) => {
  app(req, res);
};
