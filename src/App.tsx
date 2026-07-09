/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameState, FamilyMember, HighScore } from './types';
import { getFamilyMembers, getHighScores, getSelectedCharacterId, saveSelectedCharacterId } from './storage';
import FamilyBlockAvatar from './components/FamilyBlockAvatar';
import FamilyManager from './components/FamilyManager';
import GameCanvas from './components/GameCanvas';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Users, Award, BookOpen, Volume2, VolumeX, Tv, Gamepad2, Info, ArrowRight, ShieldCheck, Heart, X
} from 'lucide-react';
import { isSoundEnabled, toggleSound } from './audio';

export default function App() {
  const [screen, setScreen] = useState<GameState>('MENU');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<FamilyMember | null>(null);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [activeTab, setActiveTab] = useState<'roster' | 'scores' | 'tv'>('roster');

  // Load roster and scores on mount
  useEffect(() => {
    const loadedMembers = getFamilyMembers();
    setMembers(loadedMembers);
    
    const savedId = getSelectedCharacterId();
    const matchedMember = loadedMembers.find(m => m.id === savedId);
    if (matchedMember) {
      setSelectedCharacter(matchedMember);
    } else if (loadedMembers.length > 0) {
      setSelectedCharacter(loadedMembers[0]);
    } else {
      setSelectedCharacter(null);
    }

    setHighScores(getHighScores());
  }, [screen]);

  const handleSelectCharacter = (member: FamilyMember) => {
    setSelectedCharacter(member);
    saveSelectedCharacterId(member.id);
  };

  const handleSoundToggle = () => {
    const enabled = toggleSound();
    setSoundOn(enabled);
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden font-sans">
      {/* Dynamic Screen Routing */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {/* MENU SCREEN */}
          {screen === 'MENU' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full flex flex-col md:flex-row items-center justify-center p-6 md:p-12 gap-8 md:gap-16 max-w-6xl mx-auto overflow-y-auto"
            >
              {/* Left Side: Game Launcher Title & Controls */}
              <div className="flex-1 space-y-6 text-center md:text-left max-w-md">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
                    <Gamepad2 className="w-3.5 h-3.5" /> Client-Side Arcade
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-400">
                    Family Road
                  </h1>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    An endless arcade crosser! Hop across safe grasslands, dodge heavy city traffic, float on fast-moving river logs, and avoid high-speed trains. Fully customizable with your family!
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setScreen('PLAYING')}
                    disabled={!selectedCharacter}
                    className="w-full py-4 px-6 text-slate-950 font-extrabold text-lg rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-current" /> Play Game
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setScreen('CHARACTERS'); setActiveTab('roster'); }}
                      className="py-3 px-4 font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition border border-slate-700/50 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-4 h-4 text-emerald-400" /> Family Roster
                    </button>
                    <button
                      onClick={() => setScreen('HOWTOPLAY')}
                      className="py-3 px-4 font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition border border-slate-700/50 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Tv className="w-4 h-4 text-amber-400" /> Play on TV
                    </button>
                  </div>
                </div>

                {/* Privacy Badge */}
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <ShieldCheck className="text-emerald-400 w-5 h-5 shrink-0" />
                  <span className="text-[11px] text-slate-400 text-left leading-normal">
                    <strong>100% Private:</strong> Your photos stay directly on your device inside your browser's private cache and are never shared.
                  </span>
                </div>
              </div>

              {/* Right Side: Big 3D Hovering Selected Character Card */}
              <div className="w-full max-w-xs flex flex-col items-center">
                {selectedCharacter ? (
                  <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-3xl text-center space-y-6 shadow-2xl relative w-full flex flex-col items-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Selected Character
                    </span>

                    {/* Rendering 3D character block with jumping hop effect */}
                    <FamilyBlockAvatar 
                      member={selectedCharacter} 
                      size="xl" 
                      isJumping 
                    />

                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-100">
                        {selectedCharacter.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                        Relation: {selectedCharacter.relation}
                      </p>
                    </div>

                    <button
                      onClick={() => setScreen('CHARACTERS')}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group transition cursor-pointer"
                    >
                      Change Character <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-900/50 border border-slate-800/80 p-12 rounded-3xl text-center text-slate-500 w-full">
                    No family members. Click Manage below.
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* PLAYING GAME SCREEN */}
          {screen === 'PLAYING' && selectedCharacter && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full"
            >
              <GameCanvas
                character={selectedCharacter}
                onGameOver={(finalScore) => {
                  setHighScores(getHighScores()); // refresh leaderboard rankings
                }}
                onExit={() => setScreen('MENU')}
              />
            </motion.div>
          )}

          {/* FAMILY ROSTER / CHARACTERS BUILDER SCREEN */}
          {screen === 'CHARACTERS' && (
            <motion.div
              key="roster"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full"
            >
              <FamilyManager
                onBack={() => setScreen('MENU')}
                onSelectCharacter={handleSelectCharacter}
                selectedCharacterId={selectedCharacter?.id}
              />
            </motion.div>
          )}

          {/* HOW TO PLAY & TV REMOTE SETUP SCREEN */}
          {screen === 'HOWTOPLAY' && (
            <motion.div
              key="howtoplay"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="h-full flex flex-col bg-slate-900 text-white overflow-y-auto p-6 md:p-12"
            >
              <div className="max-w-2xl mx-auto w-full space-y-8 py-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                    <Tv className="text-amber-400 w-6 h-6" /> Play on Amazon Fire Stick / TV
                  </h2>
                  <button
                    onClick={() => setScreen('MENU')}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                  <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                    <h3 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                      🎮 Yes, you can play on your TV!
                    </h3>
                    <p className="text-xs">
                      Web browser control makes it incredibly easy to launch this game directly on your television using standard streaming device remotes like the Amazon Fire Stick, Android TV, or Apple TV.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-white text-base">Steps to Launch on Fire Stick:</h3>
                    <ol className="list-decimal pl-5 space-y-3 text-slate-300">
                      <li>
                        <strong>Download a browser:</strong> On your Amazon Fire Stick, open the Appstore, search for the official <strong>Amazon Silk Browser</strong> (or Downloader/Firefox) and install it.
                      </li>
                      <li>
                        <strong>Enter your private URL:</strong> Open the Silk browser and enter the private development/shared URL shown in your AI Studio dashboard (e.g. <code>{window.location.origin}</code> or your shared build URL!).
                      </li>
                      <li>
                        <strong>Play with TV remote D-Pad:</strong> The game is configured out of the box to listen for standard TV remote key events:
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-400">
                          <li><kbd className="bg-slate-800 px-1 py-0.5 rounded text-white">Arrow Up/Down/Left/Right</kbd> keys map to your Fire Stick Remote D-Pad circle!</li>
                          <li><kbd className="bg-slate-800 px-1 py-0.5 rounded text-white">Select (Center Button)</kbd> maps to restart when game is over!</li>
                        </ul>
                      </li>
                    </ol>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="font-bold text-white flex items-center gap-1.5">
                      <Award className="text-amber-400 w-4 h-4" /> Local Family Records
                    </h4>
                    {highScores.length > 0 ? (
                      <div className="divide-y divide-slate-800">
                        {highScores.slice(0, 5).map((score, i) => (
                          <div key={i} className="flex justify-between items-center py-2 text-xs">
                            <span className="font-medium text-slate-200">
                              {i + 1}. {score.name} ({score.relation})
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              {score.score} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No high scores logged yet. Start playing!</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setScreen('MENU')}
                    className="px-6 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl transition cursor-pointer"
                  >
                    Got It, Let's Play!
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Screen bottom footer */}
      {screen === 'MENU' && (
        <div className="py-4 px-6 border-t border-slate-900 bg-slate-900/40 text-center flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
            <span>FAMILY ROAD CLONER</span>
            <span className="text-slate-700">|</span>
            <span>PROUDLY LOCAL &amp; PRIVATE</span>
          </div>

          <div className="flex gap-4 items-center">
            {/* Audio controllers */}
            <button
              onClick={handleSoundToggle}
              className="text-slate-500 hover:text-slate-300 p-1.5 hover:bg-slate-900/60 rounded-lg transition"
              title={soundOn ? 'Mute Audio' : 'Unmute Audio'}
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500 fill-current" /> for privacy
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
