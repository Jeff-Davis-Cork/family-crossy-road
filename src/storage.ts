/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FamilyMember, HighScore } from './types';

// Default family members to populate on first run
const DEFAULT_MEMBERS: FamilyMember[] = [
  {
    id: 'mom-default',
    name: 'Mom',
    relation: 'Mom',
    avatarUrl: 'default-mom', // We will render a custom blocky avatar if it matches 'default-*'
    primaryColor: '#ec4899', // Pink
    isDefault: true,
  },
  {
    id: 'dad-default',
    name: 'Dad',
    relation: 'Dad',
    avatarUrl: 'default-dad',
    primaryColor: '#3b82f6', // Blue
    isDefault: true,
  },
  {
    id: 'sister-default',
    name: 'Sister',
    relation: 'Sister',
    avatarUrl: 'default-sister',
    primaryColor: '#a855f7', // Purple
    isDefault: true,
  },
  {
    id: 'brother-default',
    name: 'Brother',
    relation: 'Brother',
    avatarUrl: 'default-brother',
    primaryColor: '#10b981', // Green
    isDefault: true,
  },
  {
    id: 'dog-default',
    name: 'Sparky',
    relation: 'Dog',
    avatarUrl: 'default-dog',
    primaryColor: '#f59e0b', // Yellow/Orange
    isDefault: true,
  },
];

const STORAGE_MEMBERS_KEY = 'family_crossy_members_v1';
const STORAGE_HIGHSCORES_KEY = 'family_crossy_scores_v1';

export function getFamilyMembers(): FamilyMember[] {
  try {
    const data = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(DEFAULT_MEMBERS));
      return DEFAULT_MEMBERS;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse family members from localStorage', e);
    return DEFAULT_MEMBERS;
  }
}

export function saveFamilyMembers(members: FamilyMember[]) {
  try {
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
  } catch (e) {
    console.error('Failed to save family members to localStorage', e);
  }
}

export function getHighScores(): HighScore[] {
  try {
    const data = localStorage.getItem(STORAGE_HIGHSCORES_KEY);
    if (!data) {
      const initialScores: HighScore[] = [
        { name: 'Mom', relation: 'Mom', score: 42, date: new Date().toLocaleDateString() },
        { name: 'Dad', relation: 'Dad', score: 35, date: new Date().toLocaleDateString() },
        { name: 'Sparky', relation: 'Dog', score: 18, date: new Date().toLocaleDateString() },
      ];
      localStorage.setItem(STORAGE_HIGHSCORES_KEY, JSON.stringify(initialScores));
      return initialScores;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse high scores', e);
    return [];
  }
}

export function addHighScore(score: HighScore) {
  try {
    const scores = getHighScores();
    scores.push(score);
    // Sort descending and keep top 10
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, 10);
    localStorage.setItem(STORAGE_HIGHSCORES_KEY, JSON.stringify(topScores));
    return topScores;
  } catch (e) {
    console.error('Failed to add high score', e);
    return [];
  }
}

/**
 * Resizes an image file to a small base64 string to keep localStorage usage tiny.
 */
export function resizeImage(file: File, maxWidth: number = 128, maxHeight: number = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio cropping to square
        const size = Math.min(width, height);
        canvas.width = maxWidth;
        canvas.height = maxHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context'));
          return;
        }

        // Center crop
        const sx = (width - size) / 2;
        const sy = (height - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxWidth, maxHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
      };
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a File or Blob into a Base64 data URL.
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const STORAGE_SELECTED_ID_KEY = 'family_crossy_selected_id_v1';

export function getSelectedCharacterId(): string | null {
  try {
    return localStorage.getItem(STORAGE_SELECTED_ID_KEY);
  } catch (e) {
    return null;
  }
}

export function saveSelectedCharacterId(id: string) {
  try {
    localStorage.setItem(STORAGE_SELECTED_ID_KEY, id);
  } catch (e) {}
}

