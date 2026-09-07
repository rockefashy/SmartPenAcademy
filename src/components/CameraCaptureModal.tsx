import { Modal } from './ui/Modal';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  X, 
  RotateCcw, 
  Check, 
  Upload, 
  AlertCircle, 
  Calendar, 
  FileText,
  Tag,
  ImageIcon,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { studentDetailProperties } from '../properties/studentDetail.properties';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    imageData: string;
    captureDate: string;
    comments: string;
    category: string;
  }) => Promise<void>;
  studentName?: string;
}

// Client-side image resize helper to keep uploaded files light and sharp (~300KB)
const resizeImage = (dataUrl: string, maxWidth = 1600, maxHeight = 1600, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  studentName = 'Student',
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form State
  const [captureDate, setCaptureDate] = useState(new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState('');
  const [category, setCategory] = useState('Practice Sheet');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCameraError(null);
      setUploadError(null);
      setComments('');
      setCategory('Practice Sheet');
      setCaptureDate(new Date().toISOString().split('T')[0]);
      setActiveMode('camera');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraStarting(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Device camera is not supported or accessible in this browser context.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setCameraError(err.message || 'Camera access not granted or not available. Please use the Upload Image tab.');
      setActiveMode('upload');
    } finally {
      setIsCameraStarting(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const takeSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const optimized = await resizeImage(rawDataUrl);
      setCapturedImage(optimized);
      stopCamera();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          try {
            const optimized = await resizeImage(reader.result);
            setCapturedImage(optimized);
            stopCamera();
          } catch {
            setCapturedImage(reader.result);
          }
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read selected image file.');
      };
      reader.readAsDataURL(file);
    }
    // Reset file input so re-selecting same file triggers event
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setUploadError(null);
    if (activeMode === 'camera') {
      startCamera();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedImage) {
      setUploadError('Please capture or choose a writing sample image first.');
      return;
    }

    setIsSaving(true);
    setUploadError(null);
    try {
      const finalComments = comments.trim() || `${category} - ${captureDate}`;
      await onSave({
        imageData: capturedImage,
        captureDate,
        comments: finalComments,
        category,
      });
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save handwriting sample to archive.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      showCloseButton={false}
      className="p-0 border-0 overflow-hidden"
      bodyClassName="p-0 flex flex-col"
    >
          {/* Header */}
          <div className="shrink-0 bg-gradient-to-r from-[#0E3589] to-[#0084F4] px-6 py-4 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <Camera className="w-5 h-5 text-amber-300" />
              <div>
                <h3 className="font-bold text-base">Capture Student Writing Sample</h3>
                <p className="text-xs text-blue-100">Student: {studentName} • Saved to /student_works/</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs (Only if not already captured image) */}
          {!capturedImage && (
            <div className="bg-slate-100 p-1.5 flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('camera');
                  startCamera();
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeMode === 'camera'
                    ? 'bg-white text-[#0E3589] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-4 h-4 text-[#F46E20]" />
                <span>Live Device Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode('upload');
                  stopCamera();
                  fileInputRef.current?.click();
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeMode === 'upload'
                    ? 'bg-white text-[#0E3589] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4 text-[#0E3589]" />
                <span>Choose Image from Device</span>
              </button>
            </div>
          )}

          {/* Hidden File Input always ready */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain">
            {/* Inline Error Alert */}
            {uploadError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="flex-1">{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-red-500 hover:text-red-800 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Camera / Snapshot Area */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center border-2 border-dashed border-slate-300">
              {capturedImage ? (
                /* 1. Captured or Uploaded Image Preview */
                <div className="relative w-full h-full flex flex-col items-center p-2">
                  <img
                    src={capturedImage}
                    alt="Captured writing sample"
                    className="max-h-[300px] w-auto object-contain rounded-xl shadow"
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer backdrop-blur-xs transition-transform hover:scale-105"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                      <span>Retake / Change Image</span>
                    </button>
                  </div>
                </div>
              ) : activeMode === 'camera' && stream ? (
                /* 2. Live Camera Feed */
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-[300px] object-cover"
                  />
                  <div className="absolute bottom-4 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      className="px-6 py-2.5 bg-[#F46E20] hover:bg-[#d8580f] text-white font-black text-sm rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2 cursor-pointer"
                      id="btn-take-snapshot"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{studentDetailProperties.section4Camera.capturePhotoBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                      title="Upload image file instead of camera"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Or Browse File</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* 3. Upload File / Camera Error Placeholder */
                <div className="text-center p-8 space-y-4">
                  {cameraError && activeMode === 'camera' && (
                    <div className="p-3 bg-amber-500/15 border border-amber-400/30 rounded-xl text-amber-300 text-xs flex items-center gap-2 text-left max-w-md mx-auto">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div className="w-16 h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto shadow-inner">
                    <Upload className="w-8 h-8 text-amber-400" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      Upload Writing Sample Photo
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click below to select a photo from your computer, phone gallery, or camera roll (JPG, PNG, WEBP).
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer transform hover:scale-105"
                      id="btn-browse-writing-file"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Choose Image File</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <form id="camera-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0E3589]" />
                    {studentDetailProperties.section4Camera.dateLabel} *
                  </label>
                  <input
                    type="date"
                    required
                    value={captureDate}
                    onChange={(e) => setCaptureDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#F46E20]" />
                    {studentDetailProperties.section4Camera.categoryLabel} *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                  >
                    {studentDetailProperties.section4Camera.categoryOptions.map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  {studentDetailProperties.section4Camera.commentsLabel}
                </label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={studentDetailProperties.section4Camera.commentsPlaceholder}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                />
              </div>
            </form>
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="camera-form"
              disabled={!capturedImage || isSaving}
              className="px-5 py-2.5 bg-[#0E3589] hover:bg-[#092257] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              id="btn-save-writing-sample"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Work Photo...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{studentDetailProperties.section4Camera.savePhotoBtn}</span>
                </>
              )}
            </button>
          </div>
    </Modal>
  );
};
