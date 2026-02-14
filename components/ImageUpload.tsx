
import React, { useRef } from 'react';
import { Button } from './Button';

interface ImageUploadProps {
  label: string;
  onUpload: (base64: string) => void;
  currentImage?: string;
  icon?: React.ReactNode;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ label, onUpload, currentImage, icon }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer border-2 border-dashed rounded-xl overflow-hidden transition-all h-40 flex items-center justify-center
          ${currentImage ? 'border-emerald-200 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 bg-white'}
        `}
      >
        {currentImage ? (
          <img src={currentImage} alt="Uploaded preview" className="w-full h-full object-contain p-1" />
        ) : (
          <div className="text-center p-4">
            <div className="mx-auto w-10 h-10 mb-2 text-slate-400">
              {icon || (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">Click to upload photo</p>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*" 
        />
      </div>
    </div>
  );
};
