/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { FamilyMember } from '../types';
import { getFamilyMembers, saveFamilyMembers, resizeImage, fileToBase64 } from '../storage';
import FamilyBlockAvatar from './FamilyBlockAvatar';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, Trash2, Camera, Check, X, ShieldAlert, Sparkles, Smile, Crown, Mic, Square, Play, Volume2, Upload 
} from 'lucide-react';

interface FamilyManagerProps {
  onBack: () => void;
  onSelectCharacter: (member: FamilyMember) => void;
  selectedCharacterId?: string;
}

const RELATION_TYPES = [
  'Mom', 'Dad', 'Brother', 'Sister', 'Son', 'Daughter', 'Grandma', 'Grandpa', 'Dog', 'Cat', 'Custom'
];

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
];

export default function FamilyManager({ onBack, onSelectCharacter, selectedCharacterId }: FamilyManagerProps) {
  const [members, setMembers] = useState<FamilyMember[]>(() => getFamilyMembers());
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Mom');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio State
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const compressedBase64 = await resizeImage(file);
      setImageSrc(compressedBase64);
    } catch (err: any) {
      console.error(err);
      setError('Failed to process image. Please try a different photo.');
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const base64 = await fileToBase64(audioBlob);
          setAudioSrc(base64);
        } catch (err) {
          console.error(err);
          setError('Failed to convert recorded audio.');
        }
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setError('Could not access microphone. Please ensure permissions are granted or upload an audio file.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (!audioSrc) return;
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    const audio = new Audio(audioSrc);
    audioPreviewRef.current = audio;
    audio.play();
    setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
    };
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      if (file.size > 500 * 1024) {
        setError('Audio file is too large (limit: 500KB). Please record or upload a shorter clip.');
        return;
      }
      const base64 = await fileToBase64(file);
      setAudioSrc(base64);
    } catch (err: any) {
      console.error(err);
      setError('Failed to process audio file.');
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name.');
      return;
    }

    const newMember: FamilyMember = {
      id: `custom-${Date.now()}`,
      name: name.trim().slice(0, 15),
      relation,
      avatarUrl: imageSrc || `default-${relation.toLowerCase()}`,
      primaryColor: color,
      audioUrl: audioSrc || undefined,
    };

    const updated = [...members, newMember];
    setMembers(updated);
    saveFamilyMembers(updated);
    
    // Automatically select the newly created character
    onSelectCharacter(newMember);

    // Reset Form
    setName('');
    setRelation('Mom');
    setColor(PRESET_COLORS[0]);
    setImageSrc(null);
    setAudioSrc(null);
    setIsAdding(false);
  };

  const handleDeleteMember = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the deleted member
    
    // Confirm deletion
    if (!confirm('Are you sure you want to remove this family member?')) return;

    const filtered = members.filter(m => m.id !== id);
    setMembers(filtered);
    saveFamilyMembers(filtered);

    // If the selected character was deleted, fall back to the first available character
    if (selectedCharacterId === id && filtered.length > 0) {
      onSelectCharacter(filtered[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      try {
        setError(null);
        const compressedBase64 = await resizeImage(file);
        setImageSrc(compressedBase64);
      } catch (err) {
        setError('Failed to process dropped image.');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all shadow-sm flex items-center gap-1"
        >
          ← Main Menu
        </button>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Smile className="text-emerald-400 w-5 h-5" /> Family Roster
        </h2>
        <div className="w-24"></div> {/* Balance header */}
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Privacy Note */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex gap-3 items-start shadow-sm">
          <Crown className="text-emerald-400 w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-emerald-300 text-sm">🔒 100% Private Local Storage</h4>
            <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
              To respect your privacy and ensure your family photos never leave your device, the roster runs completely locally. Your photos are compressed and saved directly in your browser's local cache. They are never sent to any server and are never shared with the public.
            </p>
          </div>
        </div>

        {/* Top bar with roster status and Add button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-100">Select Character</h3>
            <p className="text-xs text-slate-400">Choose who to play as, or add your own family members below.</p>
          </div>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 text-sm font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 active:scale-95 rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Family Member
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isAdding ? (
            /* Add Member Panel */
            <motion.form
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              onSubmit={handleAddMember}
              className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-6 space-y-6 shadow-xl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="text-amber-400 w-4 h-4" /> Create Family Member
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* 3D Cube Preview & Photo Upload */}
                <div className="md:col-span-4 flex flex-col items-center justify-center space-y-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono text-slate-400">CHARACTER PREVIEW</span>
                  
                  {/* Render the actual FamilyBlockAvatar */}
                  <FamilyBlockAvatar 
                    member={{
                      id: 'preview',
                      name: name || 'Your Name',
                      relation,
                      avatarUrl: imageSrc || '',
                      primaryColor: color,
                    }}
                    size="lg"
                    isJumping
                  />

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-slate-900/40 transition-all rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer text-center group"
                  >
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition mb-1" />
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white transition">
                      {imageSrc ? 'Change Photo' : 'Upload Family Photo'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Drag & drop image here
                    </span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Form Fields */}
                <div className="md:col-span-8 space-y-4">
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Name / Nickname
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Grandma, Uncle Dave, Bobby"
                      maxLength={15}
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Relation select */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Relationship
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {RELATION_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRelation(type)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            relation === type
                              ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow'
                              : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shirt / Base Color */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Theme Color
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setColor(col)}
                          className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 relative"
                          style={{ 
                            backgroundColor: col,
                            borderColor: color === col ? 'white' : 'transparent' 
                          }}
                        >
                          {color === col && (
                            <span className="absolute inset-0 flex items-center justify-center text-white">
                              <Check className="w-4 h-4 filter drop-shadow-sm" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice Clip Section */}
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">VOICE CLIP (SQUASHED SOUND)</span>
                      {audioSrc && (
                        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/15 px-2 py-0.5 rounded-full">
                          ✓ Loaded
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {isRecording ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 text-xs font-bold animate-pulse cursor-pointer"
                        >
                          <Square className="w-4 h-4" /> Stop Recording
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 text-xs font-bold cursor-pointer"
                        >
                          <Mic className="w-4 h-4" /> Record Voice
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <Upload className="w-4 h-4" /> Upload Sound (.mp3, .wav)
                      </button>
                      
                      <input
                        type="file"
                        ref={audioInputRef}
                        onChange={handleAudioUpload}
                        accept="audio/*"
                        className="hidden"
                      />
                    </div>

                    {audioSrc && (
                      <div className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={playAudio}
                            className={`p-2 rounded-full cursor-pointer transition-colors ${
                              isPlaying ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                            }`}
                            title="Play sound preview"
                          >
                            {isPlaying ? <Volume2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <div className="text-xs">
                            <p className="font-semibold text-slate-200">Custom voice clip</p>
                            <p className="text-[10px] text-slate-500">Plays when "Squashed!"</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAudioSrc(null)}
                          className="p-1.5 hover:bg-red-950/20 text-slate-500 hover:text-red-400 rounded-md transition"
                          title="Remove sound"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Have your family member record saying something funny like <span className="text-amber-300">"Oh no, I've been squashed!"</span> Keep it short (1-2 seconds) to keep gameplay crisp.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-950 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  Save to Roster
                </button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        {/* Characters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {members.map((member) => {
            const isSelected = selectedCharacterId === member.id;
            return (
              <div
                key={member.id}
                onClick={() => onSelectCharacter(member)}
                className={`group relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center space-y-4 ${
                  isSelected
                    ? 'bg-emerald-950/15 border-emerald-500 shadow-lg shadow-emerald-500/5'
                    : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600'
                }`}
              >
                {/* 3D Cube representation */}
                <FamilyBlockAvatar 
                  member={member} 
                  size="md" 
                  isJumping={isSelected}
                />

                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-100 group-hover:text-white transition max-w-full truncate px-1 flex items-center justify-center gap-1.5">
                    {member.name}
                    {member.audioUrl && (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" title="Has custom squashed sound!" />
                    )}
                  </h4>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {member.relation}
                  </span>
                </div>

                {/* Selected Overlay Indicator */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-slate-950 p-0.5 rounded-full shadow">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}

                {/* Delete button (only allow deleting custom members) */}
                {!member.isDefault && (
                  <button
                    onClick={(e) => handleDeleteMember(member.id, e)}
                    className="absolute top-1.5 left-1.5 p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
