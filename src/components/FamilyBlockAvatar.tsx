/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FamilyMember } from '../types';
import { Smile, Heart, User, Sparkles } from 'lucide-react';

interface FamilyBlockAvatarProps {
  member: FamilyMember;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isJumping?: boolean;
}

export default function FamilyBlockAvatar({ member, size = 'md', isJumping = false }: FamilyBlockAvatarProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const getEmoji = (relation: string) => {
    switch (relation.toLowerCase()) {
      case 'mom': return '👩‍🦰';
      case 'dad': return '👨‍🦱';
      case 'brother': return '👦';
      case 'sister': return '👧';
      case 'son': return '👶';
      case 'daughter': return '👧';
      case 'dog': return '🐶';
      case 'cat': return '🐱';
      case 'grandma': return '👵';
      case 'grandpa': return '👴';
      default: return '👤';
    }
  };

  const hasCustomPhoto = member.avatarUrl && !member.avatarUrl.startsWith('default-');

  return (
    <div
      className={`relative select-none transition-transform duration-150 ${isJumping ? 'animate-bounce' : ''}`}
      style={{
        width: size === 'sm' ? '40px' : size === 'md' ? '64px' : size === 'lg' ? '96px' : '128px',
        height: size === 'sm' ? '40px' : size === 'md' ? '64px' : size === 'lg' ? '96px' : '128px',
        perspective: '1000px',
      }}
    >
      {/* 3D Box Container */}
      <div 
        className="w-full h-full relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-12deg) rotateY(15deg)',
        }}
      >
        {/* Shadow */}
        <div 
          className="absolute rounded-full bg-black/20 blur-sm"
          style={{
            bottom: '-4px',
            left: '10%',
            width: '80%',
            height: '8px',
            transform: 'rotateX(90deg) translateZ(-10px)',
          }}
        />

        {/* Back Face */}
        <div
          className="absolute inset-0 rounded-md border-b-4 border-black/20"
          style={{
            backgroundColor: member.primaryColor,
            transform: 'translateZ(-15px)',
          }}
        />

        {/* Top Face */}
        <div
          className="absolute left-0 right-0 h-[24px] origin-top rounded-t-md brightness-110"
          style={{
            backgroundColor: member.primaryColor,
            top: 0,
            transform: 'rotateX(90deg) translateZ(0px)',
          }}
        />

        {/* Right Side Face */}
        <div
          className="absolute top-0 bottom-0 w-[24px] origin-right rounded-r-md brightness-90"
          style={{
            backgroundColor: member.primaryColor,
            right: 0,
            transform: 'rotateY(90deg) translateZ(0px)',
          }}
        />

        {/* Front Face (Face with photo/design) */}
        <div
          className="absolute inset-0 rounded-md flex flex-col items-center justify-center overflow-hidden border-2 border-black/15 shadow-md"
          style={{
            backgroundColor: member.primaryColor,
            transform: 'translateZ(10px)',
          }}
        >
          {hasCustomPhoto ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full text-white font-bold p-1 bg-gradient-to-br from-white/10 to-black/20">
              <span className="text-2xl md:text-3xl filter drop-shadow">
                {getEmoji(member.relation)}
              </span>
              {size !== 'sm' && (
                <span className="text-[10px] uppercase font-mono tracking-wider bg-black/30 px-1 py-0.5 rounded mt-1 max-w-full truncate text-center leading-none">
                  {member.name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
