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
  Tag
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
  studentName: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  studentName,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [captureDate, setCaptureDate] = useState(new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState('');
  const [category, setCategory] = useState('Practice Sheet');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setCapturedImage(null);
      setCameraError(null);
      setComments('');
      setCategory('Practice Sheet');
      setCaptureDate(new Date().toISOString().split('T')[0]);
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
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError('Camera access not granted or not available. You can also upload a saved photo.');
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

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCapturedImage(reader.result);
          stopCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedImage) return;

    setIsSaving(true);
    try {
      await onSave({
        imageData: capturedImage,
        captureDate,
        comments,
        category,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save photo');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm">
      <div className="min-h-full w-full flex items-center justify-center p-3 sm:p-4 text-center">
        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col text-left">
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
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain">
          {/* Camera / Snapshot Area */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center border-2 border-dashed border-slate-300">
            {capturedImage ? (
              <div className="relative w-full h-full flex flex-col items-center">
                <img
                  src={capturedImage}
                  alt="Captured writing"
                  className="max-h-[300px] w-auto object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRetake}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {studentDetailProperties.section4Camera.retakeBtn}
                </button>
              </div>
            ) : stream ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[300px] object-cover"
                />
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="absolute bottom-4 px-6 py-2.5 bg-[#F46E20] hover:bg-[#d8580f] text-white font-bold text-sm rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  {studentDetailProperties.section4Camera.capturePhotoBtn}
                </button>
              </div>
            ) : (
              <div className="text-center p-6 space-y-3">
                {cameraError ? (
                  <div className="text-amber-400 text-xs flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8" />
                    <span>{cameraError}</span>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">Starting camera feed...</p>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white text-slate-800 hover:bg-slate-100 font-bold text-xs rounded-xl shadow transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#0E3589]" />
                    {studentDetailProperties.section4Camera.uploadAlternativeBtn}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
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
                  {studentDetailProperties.section4Camera.dateLabel}
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
                  {studentDetailProperties.section4Camera.categoryLabel}
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
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="camera-form"
            disabled={!capturedImage || isSaving}
            className="px-5 py-2.5 bg-[#0E3589] hover:bg-[#092257] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Saving Work Photo...'
                : studentDetailProperties.section4Camera.savePhotoBtn}
            </span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
