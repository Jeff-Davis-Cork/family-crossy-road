/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FamilyMember {
  id: string;
  name: string;
  relation: string; // 'Mom', 'Dad', 'Brother', 'Sister', 'Son', 'Daughter', 'Dog', 'Cat', 'Grandma', 'Grandpa', 'Custom'
  avatarUrl: string; // Base64 data URL or placeholder SVG
  primaryColor: string; // Accent color for their jumping particle or base shirt
  audioUrl?: string; // Base64 audio data URL for custom death sound
  isDefault?: boolean;
}

export interface HighScore {
  name: string;
  relation: string;
  score: number;
  date: string;
}

export type GameState = 'MENU' | 'CHARACTERS' | 'PLAYING' | 'GAMEOVER' | 'HOWTOPLAY';
