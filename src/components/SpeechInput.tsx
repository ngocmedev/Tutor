import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Globe, AlertCircle } from 'lucide-react';
import { TextToSpeechService } from '../services/textToSpeech';

interface SpeechInputProps {
  onSendMessage: (text: string, recordedAudioUrl?: string) => void;
  placeholder?: string;
  defaultLang?: 'zh-CN' | 'vi-VN' | 'auto';
  disabled?: boolean;
  className?: string;
}

// Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Mobile-compatible MIME type detector for MediaRecorder
const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/wav',
  ];
  for (const t of types) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch (_) {}
  }
  return '';
};

// Check MediaDevices support (handles HTTP insecure context on mobile)
const isMediaDevicesSupported = (): boolean => {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia
  );
};

export const SpeechInput: React.FC<SpeechInputProps> = ({
  onSendMessage,
  placeholder = 'Nói hoặc nhập tiếng Trung/Tiếng Việt...',
  defaultLang = 'auto',
  disabled = false,
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechLang, setSpeechLang] = useState<'zh-CN' | 'vi-VN'>(
    defaultLang === 'zh-CN' ? 'zh-CN' : 'vi-VN'
  );
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const baseTextRef = useRef('');

  // Mobile Microphone MediaRecorder state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordedAudioUrlRef = useRef<string | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getApiKeyHeader = (): Record<string, string> => {
    const customKey = localStorage.getItem('user_gemini_api_key');
    return customKey && customKey.trim() ? { 'x-gemini-api-key': customKey.trim() } : {};
  };

  const transcribeAudioWithAI = async (audioDataUrl: string): Promise<string> => {
    try {
      setIsTranscribing(true);
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiKeyHeader() },
        body: JSON.stringify({ audioUrl: audioDataUrl, language: speechLang }),
      });

      if (!res.ok) return '';
      const data = await res.json();
      if (data && data.text) {
        return data.text.trim();
      }
      return '';
    } catch (e) {
      console.warn('AI STT transcription error:', e);
      return '';
    } finally {
      setIsTranscribing(false);
    }
  };

  const startMediaRecording = async (): Promise<boolean> => {
    try {
      if (!isMediaDevicesSupported()) {
        setMicError(
          'Không thể truy cập Micro. Trên điện thoại, trình duyệt yêu cầu truy cập qua kết nối HTTPS (hoặc localhost/Vercel) để cấp quyền Micro.'
        );
        return false;
      }

      TextToSpeechService.stop(); // Stop any playing AI voice before opening mic

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        // Fallback for mobile devices rejecting complex audio constraints
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = options
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          mediaChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (mediaChunksRef.current.length > 0) {
          const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(mediaChunksRef.current, { type });
          const reader = new FileReader();
          reader.onloadend = () => {
            recordedAudioUrlRef.current = reader.result as string;
          };
          reader.readAsDataURL(blob);
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      mediaRecorder.start(250); // 250ms timeslice for mobile stream safety
      mediaRecorderRef.current = mediaRecorder;
      return true;
    } catch (e: any) {
      console.warn('MediaRecorder error:', e);
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setMicError('Quyền truy cập Micro bị từ chối. Vui lòng mở Cài đặt trình duyệt và cấp quyền Microphone.');
      } else if (e?.name === 'NotFoundError') {
        setMicError('Không tìm thấy thiết bị Microphone trên máy.');
      } else {
        setMicError(`Lỗi truy cập Micro: ${e?.message || 'Không thể khởi động Micro'}`);
      }
      return false;
    }
  };

  const stopMediaRecording = (): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(recordedAudioUrlRef.current);
        return;
      }

      let resolved = false;
      const safeResolve = (url?: string) => {
        if (!resolved) {
          resolved = true;
          resolve(url);
        }
      };

      const timeout = setTimeout(() => {
        safeResolve(recordedAudioUrlRef.current);
      }, 600);

      mediaRecorder.onstop = () => {
        clearTimeout(timeout);
        if (mediaChunksRef.current.length > 0) {
          const type = mediaRecorder.mimeType || getSupportedMimeType() || 'audio/webm';
          const blob = new Blob(mediaChunksRef.current, { type });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            recordedAudioUrlRef.current = dataUrl;
            safeResolve(dataUrl);
          };
          reader.readAsDataURL(blob);
        } else {
          safeResolve(recordedAudioUrlRef.current);
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      try {
        mediaRecorder.stop();
      } catch (e) {
        clearTimeout(timeout);
        safeResolve(recordedAudioUrlRef.current);
      }
    });
  };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);

    try {
      const recognition = new SpeechRecognition();
      const isMobile = typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // On mobile browsers, continuous mode frequently causes speech engine crashes
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const speechPart = (finalTranscript + ' ' + interimTranscript).trim();
        const prefix = baseTextRef.current.trim();
        const fullText = prefix ? (prefix + ' ' + speechPart) : speechPart;

        if (fullText) {
          setInputText(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'not-allowed') {
          setMicError('Quyền truy cập Micro bị từ chối. Vui lòng cấp quyền Microphone trong trình duyệt.');
        }
      };

      recognition.onend = () => {
        if (shouldKeepListeningRef.current && isMobile) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      recognitionRef.current = recognition;

      return () => {
        try {
          recognition.abort();
        } catch (_) {}
      };
    } catch (e) {
      console.warn('Failed to initialize Speech Recognition:', e);
      setSpeechSupported(false);
    }
  }, [speechLang]);

  const toggleListening = async () => {
    setMicError(null);

    // If currently listening, stop recording
    if (isListening || shouldKeepListeningRef.current) {
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }

      const audioUrl = await stopMediaRecording();
      if (audioUrl && !inputText.trim()) {
        const transcribedText = await transcribeAudioWithAI(audioUrl);
        if (transcribedText) {
          setInputText(transcribedText);
          baseTextRef.current = transcribedText;
        }
      }
      return;
    }

    // Start recording audio
    shouldKeepListeningRef.current = true;
    const success = await startMediaRecording();
    if (!success) {
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      return;
    }

    setIsListening(true);

    // Attempt Web Speech API live text transcription if available
    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = speechLang;
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn('Speech start info:', err);
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    baseTextRef.current = newText;
  };

  const handleClearText = () => {
    setInputText('');
    baseTextRef.current = '';
    recordedAudioUrlRef.current = undefined;
    setMicError(null);
  };

  const handleLangChange = (newLang: 'zh-CN' | 'vi-VN') => {
    setMicError(null);
    shouldKeepListeningRef.current = false;
    baseTextRef.current = '';
    stopMediaRecording();
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      setIsListening(false);
    }
    setSpeechLang(newLang);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    shouldKeepListeningRef.current = false;
    setIsListening(false);
    const audioUrlToSend = await stopMediaRecording();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }

    let messageToSend = inputText.trim();

    // If user recorded audio without typed text (e.g. spoken voice on mobile)
    if (!messageToSend && audioUrlToSend) {
      const transcribed = await transcribeAudioWithAI(audioUrlToSend);
      if (transcribed) {
        messageToSend = transcribed;
      } else {
        messageToSend = speechLang === 'zh-CN' ? '语音消息' : 'Tin nhắn giọng nói';
      }
    }

    if (!messageToSend || disabled || isTranscribing) return;

    setInputText('');
    baseTextRef.current = '';
    setMicError(null);

    onSendMessage(messageToSend, audioUrlToSend);
    recordedAudioUrlRef.current = undefined;
  };

  return (
    <div className={`bg-white rounded-xl border border-[#E5E5E1] shadow-xs p-3.5 ${className}`}>
      {/* Speech Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-[#E5E5E1]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Ngôn ngữ Mic:</span>
          <div className="inline-flex rounded-lg bg-[#F0EFED] p-0.5 border border-[#E5E5E1]">
            <button
              type="button"
              onClick={() => handleLangChange('zh-CN')}
              id="btn-lang-chinese"
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                speechLang === 'zh-CN'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              🇨🇳 Tiếng Trung (中文)
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('vi-VN')}
              id="btn-lang-vietnamese"
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                speechLang === 'vi-VN'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              🇻🇳 Tiếng Việt
            </button>
          </div>
        </div>

        {isListening && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Đang thu âm giọng nói...
          </span>
        )}

        {isTranscribing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            AI đang nhận diện chữ...
          </span>
        )}

        {!speechSupported && !isTranscribing && (
          <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
            AI Speech-to-Text Mode
          </span>
        )}
      </div>

      {/* Mic Error Banner */}
      {micError && (
        <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span className="flex-1">{micError}</span>
          <button
            type="button"
            onClick={() => setMicError(null)}
            className="ml-auto text-[10px] underline font-bold text-amber-900 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="relative flex-1">
          <textarea
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            rows={3}
            disabled={disabled || isTranscribing}
            id="input-speech-text"
            className="w-full bg-[#FAF9F6] border border-[#E5E5E1] rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-[#2D2D2D] focus:outline-none focus:ring-1 focus:ring-black focus:bg-white resize-y max-h-48 min-h-[70px] overflow-y-auto transition-all placeholder:text-gray-400 disabled:opacity-60 font-sans"
          />

          {inputText && !disabled && !isTranscribing && (
            <button
              type="button"
              onClick={handleClearText}
              className="absolute top-2 right-2 text-xs text-gray-400 hover:text-black cursor-pointer font-medium hover:underline bg-white/80 px-1.5 py-0.5 rounded-md backdrop-blur-xs"
            >
              Xóa để nói lại
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled || isTranscribing}
            id="btn-toggle-mic"
            title={isListening ? 'Bấm để dừng thu âm' : 'Bật Mic để nói'}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs border shrink-0 disabled:opacity-40 ${
              isListening
                ? 'bg-red-600 text-white border-red-600 animate-pulse ring-2 ring-red-400'
                : 'bg-[#F0EFED] text-[#2D2D2D] hover:bg-gray-200 border-[#E5E5E1]'
            }`}
          >
            {isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5 text-red-600" />
            )}
          </button>

          <button
            type="submit"
            disabled={(!inputText.trim() && !isListening) || disabled || isTranscribing}
            id="btn-send-speech"
            className="w-11 h-11 rounded-xl bg-black hover:bg-gray-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 border border-black shrink-0"
          >
            {disabled || isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
