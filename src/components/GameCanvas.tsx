/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { FamilyMember, HighScore } from '../types';
import { addHighScore, getHighScores } from '../storage';
import { 
  playJumpSound, playCoinSound, playSplashSound, playCrashSound, 
  playTrainWarningSound, playEagleSound, isSoundEnabled, toggleSound 
} from '../audio';
import { 
  Volume2, VolumeX, RotateCcw, Award, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, HelpCircle 
} from 'lucide-react';

interface GameCanvasProps {
  character: FamilyMember;
  onGameOver: (score: number) => void;
  onExit: () => void;
}

// Coordinate & Game Config
const GRID_SIZE = 50; // Size of each cell in pixels
const HORIZONTAL_CELLS = 13; // Number of cells horizontally (-6 to +6)
const VIEW_HEIGHT = 14; // Number of rows visible vertically

type TerrainType = 'GRASS' | 'ROAD' | 'WATER' | 'RAIL';

interface GameObstacle {
  id: string;
  gridX: number; // grid position
  width: number; // width in grid cells
  type: 'CAR' | 'TRUCK' | 'LOG' | 'LILYPAD' | 'TREE' | 'ROCK' | 'COIN';
  color: string;
  speed: number; // moves X units per frame
  direction: 1 | -1; // 1 = right, -1 = left
}

interface GameRow {
  gridY: number;
  type: TerrainType;
  color: string;
  obstacles: GameObstacle[];
  speed: number;
  direction: 1 | -1;
  lastSpawnTime: number;
  spawnDelay: number;
  // Train track specials
  trainActive?: boolean;
  trainWarningTimer?: number; // frames remaining for warning lights
  trainX?: number; // train current X position
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export default function GameCanvas({ character, onGameOver, onExit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sound toggler state
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  // Game Core States (mirrored in refs for high-performance canvas access)
  const [currentScore, setCurrentScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [localHighScore, setLocalHighScore] = useState(0);
  const [isDeadState, setIsDeadState] = useState(false);

  // Refs for Canvas Engine
  const stateRef = useRef({
    player: {
      gridX: 0,
      gridY: 0,
      targetGridX: 0,
      targetGridY: 0,
      animProgress: 1.0, // 1.0 means resting/done jumping
      facing: 'UP' as 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
      isDead: false,
      deathType: '' as 'CAR' | 'WATER' | 'TRAIN' | 'EAGLE' | '',
      jumpAnimDuration: 12, // frames for single jump
    },
    cameraY: 0, // smoothly centers on player Y in pixels
    rows: [] as GameRow[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    coinsCount: 0,
    score: 0,
    maxReachedY: 0,
    eagleActive: false,
    eagleX: -1000,
    eagleY: -1000,
    eagleTargetY: 0,
    lastMoveTime: Date.now(), // to check for idle hawk trigger
    gameActive: true,
    keys: {} as Record<string, boolean>,
  });

  // Cached player image object for base64 uploads
  const playerImageRef = useRef<HTMLImageElement | null>(null);

  // Load avatar image if custom
  useEffect(() => {
    if (character.avatarUrl && !character.avatarUrl.startsWith('default-')) {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = character.avatarUrl;
      img.onload = () => {
        playerImageRef.current = img;
      };
    } else {
      playerImageRef.current = null;
    }

    // Get current high score for this family member
    const scores = getHighScores();
    const personalBest = scores
      .filter((s) => s.name === character.name)
      .reduce((max, curr) => (curr.score > max ? curr.score : max), 0);
    setLocalHighScore(personalBest);

    // Set initial active state
    stateRef.current.gameActive = true;
    stateRef.current.player.isDead = false;
    stateRef.current.player.deathType = '';
    stateRef.current.player.gridX = 0;
    stateRef.current.player.gridY = 0;
    stateRef.current.player.targetGridX = 0;
    stateRef.current.player.targetGridY = 0;
    stateRef.current.player.animProgress = 1.0;
    stateRef.current.cameraY = 0;
    stateRef.current.score = 0;
    stateRef.current.maxReachedY = 0;
    stateRef.current.coinsCount = 0;
    stateRef.current.particles = [];
    stateRef.current.floatingTexts = [];
    stateRef.current.eagleActive = false;
    stateRef.current.lastMoveTime = Date.now();
    setCurrentScore(0);
    setCoins(0);
    setIsDeadState(false);

    // Build initial rows
    const initialRows: GameRow[] = [];
    // safe zone grass behind player
    for (let y = -6; y < 0; y++) {
      initialRows.push(createRow(y, 'GRASS', true)); // safe grass
    }
    // starting grass
    initialRows.push(createRow(0, 'GRASS', true)); // safe starting row
    
    // generate ahead rows
    for (let y = 1; y < 30; y++) {
      initialRows.push(createRow(y));
    }
    stateRef.current.rows = initialRows;

  }, [character]);

  // Helper row generator
  function createRow(gridY: number, forceType?: TerrainType, isSafe: boolean = false): GameRow {
    let type: TerrainType = 'GRASS';
    if (!forceType) {
      const rand = Math.random();
      if (rand < 0.25) type = 'GRASS';
      else if (rand < 0.55) type = 'ROAD';
      else if (rand < 0.85) type = 'WATER';
      else type = 'RAIL';
    } else {
      type = forceType;
    }

    // Select row style colors
    let color = '#22c55e'; // default green grass
    if (type === 'ROAD') color = '#334155'; // dark slate asphalt
    if (type === 'WATER') color = '#0284c7'; // deep blue water
    if (type === 'RAIL') color = '#475569'; // gravel railroad bed

    // Obstacle spacing speeds
    const direction = Math.random() < 0.5 ? 1 : -1;
    const speed = 1.2 + Math.random() * 2.5 + Math.min(gridY * 0.04, 3.5); // scales speed slightly with distance
    const spawnDelay = 120 + Math.random() * 150 - Math.min(gridY * 1.5, 90); // decreases delay (more obstacles) as you go

    const row: GameRow = {
      gridY,
      type,
      color,
      obstacles: [],
      speed,
      direction,
      lastSpawnTime: 0,
      spawnDelay: Math.max(spawnDelay, 50),
    };

    // Pre-populate obstacles for non-safe rows so user doesn't start with empty rows
    if (!isSafe) {
      if (type === 'GRASS') {
        // Place stationary trees/rocks
        const obstacleCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < obstacleCount; i++) {
          const placementX = Math.floor(Math.random() * HORIZONTAL_CELLS) - Math.floor(HORIZONTAL_CELLS / 2);
          if (placementX !== 0 || gridY > 2) { // don't block the direct starting center lane on nearby rows
            row.obstacles.push({
              id: `tree-${gridY}-${i}`,
              gridX: placementX,
              width: 1,
              type: Math.random() < 0.7 ? 'TREE' : 'ROCK',
              color: '',
              speed: 0,
              direction: 1,
            });
          }
        }
        // Spawn standard coin on grass sometimes
        if (Math.random() < 0.15) {
          const placementX = Math.floor(Math.random() * HORIZONTAL_CELLS) - Math.floor(HORIZONTAL_CELLS / 2);
          row.obstacles.push({
            id: `coin-${gridY}`,
            gridX: placementX,
            width: 0.8,
            type: 'COIN',
            color: '#fbbf24',
            speed: 0,
            direction: 1,
          });
        }
      } else if (type === 'ROAD') {
        // Spawn 1 or 2 initial cars
        const carCount = 1 + Math.floor(Math.random() * 2);
        const col = ['#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][Math.floor(Math.random() * 6)];
        for (let i = 0; i < carCount; i++) {
          const startX = -10 + i * 12;
          row.obstacles.push({
            id: `car-${gridY}-${i}`,
            gridX: startX,
            width: Math.random() < 0.4 ? 2 : 1.5, // trucks are wider
            type: Math.random() < 0.3 ? 'TRUCK' : 'CAR',
            color: col,
            speed,
            direction,
          });
        }
        // Spawn coin in lane sometimes
        if (Math.random() < 0.1) {
          const placementX = Math.floor(Math.random() * HORIZONTAL_CELLS) - Math.floor(HORIZONTAL_CELLS / 2);
          row.obstacles.push({
            id: `coin-${gridY}`,
            gridX: placementX,
            width: 0.8,
            type: 'COIN',
            color: '#fbbf24',
            speed: 0,
            direction: 1,
          });
        }
      } else if (type === 'WATER') {
        // Spawn logs
        const logCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < logCount; i++) {
          const startX = -12 + i * 8;
          row.obstacles.push({
            id: `log-${gridY}-${i}`,
            gridX: startX,
            width: 2.5 + Math.random() * 1.5, // varying length logs
            type: Math.random() < 0.85 ? 'LOG' : 'LILYPAD',
            color: '#78350f',
            speed,
            direction,
          });
        }
      } else if (type === 'RAIL') {
        row.trainActive = false;
        row.trainWarningTimer = 0;
        row.trainX = -30;
      }
    }

    return row;
  }

  // Key Listeners and Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling when playing
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      stateRef.current.keys[e.key] = true;

      if (stateRef.current.player.isDead) {
        if (e.key === 'r' || e.key === 'R' || e.key === 'Enter' || e.key === ' ') {
          restartGame();
        }
        return;
      }

      // Read movement inputs if resting
      if (stateRef.current.player.animProgress >= 1.0) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          movePlayer(0, 1);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          movePlayer(0, -1);
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          movePlayer(-1, 0);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          movePlayer(1, 0);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Player action movement
  function movePlayer(dx: number, dy: number) {
    const state = stateRef.current;
    if (state.player.isDead) return;

    // Set facing direction
    if (dx > 0) state.player.facing = 'RIGHT';
    else if (dx < 0) state.player.facing = 'LEFT';
    else if (dy > 0) state.player.facing = 'UP';
    else if (dy < 0) state.player.facing = 'DOWN';

    const targetX = state.player.gridX + dx;
    const targetY = state.player.gridY + dy;

    // Check boundary
    const maxBoundX = Math.floor(HORIZONTAL_CELLS / 2);
    if (targetX < -maxBoundX || targetX > maxBoundX) return;

    // Obstacle collision lookup for trees/rocks
    const targetRow = state.rows.find((r) => r.gridY === targetY);
    if (targetRow) {
      const obstacleMatch = targetRow.obstacles.find(
        (obs) => (obs.type === 'TREE' || obs.type === 'ROCK') && obs.gridX === targetX
      );
      if (obstacleMatch) {
        // Can't move onto trees or rocks!
        return;
      }
    }

    // Move initiated
    state.player.targetGridX = targetX;
    state.player.targetGridY = targetY;
    state.player.animProgress = 0.0;
    state.lastMoveTime = Date.now();

    playJumpSound();

    // Spawn jump dust particles behind player
    const spawnX = state.player.gridX * GRID_SIZE;
    const spawnY = -state.player.gridY * GRID_SIZE;
    spawnParticles(spawnX, spawnY, character.primaryColor, 4);
  }

  // Particle burst spawner
  function spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 1 + Math.random() * 3;
      stateRef.current.particles.push({
        x,
        y: y + GRID_SIZE / 2,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 1, // push upward slightly
        size: 3 + Math.random() * 5,
        color,
        life: 0,
        maxLife: 20 + Math.random() * 15,
      });
    }
  }

  // Floating score texts
  function spawnFloatingText(text: string, x: number, y: number, color: string) {
    stateRef.current.floatingTexts.push({
      text,
      x,
      y,
      color,
      life: 0,
      maxLife: 40,
    });
  }

  // Restart trigger
  function restartGame() {
    // Save high score first
    if (stateRef.current.score > 0) {
      addHighScore({
        name: character.name,
        relation: character.relation,
        score: stateRef.current.score,
        date: new Date().toLocaleDateString(),
      });
    }

    // Refresh state
    const state = stateRef.current;
    state.player.isDead = false;
    state.player.deathType = '';
    state.player.gridX = 0;
    state.player.gridY = 0;
    state.player.targetGridX = 0;
    state.player.targetGridY = 0;
    state.player.animProgress = 1.0;
    state.cameraY = 0;
    state.score = 0;
    state.maxReachedY = 0;
    state.coinsCount = 0;
    state.particles = [];
    state.floatingTexts = [];
    state.eagleActive = false;
    state.lastMoveTime = Date.now();
    setCurrentScore(0);
    setCoins(0);
    setIsDeadState(false);

    // Get personal best
    const scores = getHighScores();
    const personalBest = scores
      .filter((s) => s.name === character.name)
      .reduce((max, curr) => (curr.score > max ? curr.score : max), 0);
    setLocalHighScore(personalBest);

    // Build fresh rows
    const initialRows: GameRow[] = [];
    for (let y = -6; y < 0; y++) {
      initialRows.push(createRow(y, 'GRASS', true));
    }
    initialRows.push(createRow(0, 'GRASS', true));
    for (let y = 1; y < 30; y++) {
      initialRows.push(createRow(y));
    }
    state.rows = initialRows;
  }

  // Game Loop Renderer
  useEffect(() => {
    let frameId: number;
    
    const handleUpdateAndRender = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const state = stateRef.current;

      // Ensure canvas matches container width/height
      if (containerRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
        }
      }

      const viewWidth = canvas.width / (window.devicePixelRatio || 1);
      const viewHeight = canvas.height / (window.devicePixelRatio || 1);

      // --- GAME STATE UPDATE ---
      if (state.gameActive && !state.player.isDead) {
        
        // 1. Process player jump interpolation
        if (state.player.animProgress < 1.0) {
          state.player.animProgress += 1.0 / state.player.jumpAnimDuration;
          if (state.player.animProgress >= 1.0) {
            state.player.animProgress = 1.0;
            state.player.gridX = state.player.targetGridX;
            state.player.gridY = state.player.targetGridY;

            // Update scores if player hopped forward
            if (state.player.gridY > state.maxReachedY) {
              state.maxReachedY = state.player.gridY;
              state.score = state.maxReachedY;
              setCurrentScore(state.score);
              
              // pop float text sometimes
              spawnFloatingText('+1', state.player.gridX * GRID_SIZE, -state.player.gridY * GRID_SIZE - 25, '#4ade80');
            }
          }
        }

        // 2. Eagle / Hawk idle timeout trigger (Hawk flies down if idle too long)
        const idleTime = Date.now() - state.lastMoveTime;
        if (idleTime > 11000 && !state.eagleActive) {
          triggerEagleGrab();
        }

        // 3. Keep camera smoothly tracking player Y (camera only scrolls upward)
        const targetCamY = state.player.gridY * GRID_SIZE + (viewHeight * 0.65);
        // Slowly interpolate camera up
        if (state.cameraY === 0) {
          state.cameraY = targetCamY;
        } else {
          state.cameraY += (targetCamY - state.cameraY) * 0.08;
        }

        // 4. Generate more rows dynamically ahead
        const currentMaxY = state.rows[state.rows.length - 1].gridY;
        if (state.player.gridY + 15 > currentMaxY) {
          for (let y = currentMaxY + 1; y < currentMaxY + 15; y++) {
            state.rows.push(createRow(y));
          }
        }
        // Cleanup old rows behind camera to keep performance blazing
        if (state.rows.length > 60) {
          state.rows = state.rows.filter(r => r.gridY > state.player.gridY - 12);
        }

        // 5. Update rows obstacles spawns & positions
        state.rows.forEach((row) => {
          // Increment spawn delay clock
          row.lastSpawnTime += 1;

          // Spawning logic
          if (row.type === 'ROAD') {
            if (row.lastSpawnTime >= row.spawnDelay) {
              row.lastSpawnTime = 0;
              // Spawn a car
              const sizeFactor = Math.random();
              const vehicleColors = ['#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
              row.obstacles.push({
                id: `car-${row.gridY}-${Date.now()}`,
                gridX: row.direction === 1 ? -10 : 10,
                width: sizeFactor < 0.35 ? 2.0 : 1.4, // trucks vs cars
                type: sizeFactor < 0.35 ? 'TRUCK' : 'CAR',
                color: vehicleColors[Math.floor(Math.random() * vehicleColors.length)],
                speed: row.speed,
                direction: row.direction,
              });
            }
          } else if (row.type === 'WATER') {
            if (row.lastSpawnTime >= row.spawnDelay) {
              row.lastSpawnTime = 0;
              // Spawn a log or lilypad
              const typeChoice = Math.random() < 0.18 ? 'LILYPAD' : 'LOG';
              row.obstacles.push({
                id: `log-${row.gridY}-${Date.now()}`,
                gridX: row.direction === 1 ? -12 : 12,
                width: typeChoice === 'LILYPAD' ? 0.9 : 2.5 + Math.random() * 1.5,
                type: typeChoice,
                color: typeChoice === 'LILYPAD' ? '#10b981' : '#78350f',
                speed: row.speed,
                direction: row.direction,
              });
            }
          } else if (row.type === 'RAIL') {
            // Train tracks warning trigger
            if (!row.trainActive && Math.random() < 0.007 && row.lastSpawnTime > 180) {
              row.trainActive = true;
              row.trainWarningTimer = 110; // flash lights for 110 frames before train arrives
              row.trainX = row.direction === 1 ? -32 : 32;
              row.lastSpawnTime = 0;
              playTrainWarningSound();
            }

            if (row.trainActive) {
              if (row.trainWarningTimer && row.trainWarningTimer > 0) {
                row.trainWarningTimer--;
                if (row.trainWarningTimer % 15 === 0) {
                  playTrainWarningSound();
                }
              } else {
                // Warning ended, train zoom!
                const trainSpeed = 16.0; // blazing fast train!
                if (row.trainX !== undefined) {
                  row.trainX += trainSpeed * row.direction;
                  // Despawn train
                  if ((row.direction === 1 && row.trainX > 25) || (row.direction === -1 && row.trainX < -25)) {
                    row.trainActive = false;
                  }
                }
              }
            }
          }

          // Move obstacles and filter off-screen ones
          row.obstacles = row.obstacles.filter((obs) => {
            if (obs.speed > 0) {
              obs.gridX += (obs.speed / 50) * obs.direction;
              // Let them spawn fully and clear
              if (obs.direction === 1 && obs.gridX > 12) return false;
              if (obs.direction === -1 && obs.gridX < -12) return false;
            }
            return true;
          });
        });

        // 6. Check Collisions & Float Mechanics (Calculate current active interpolated position)
        const playerX = getInterpolatedX();
        const playerY = getInterpolatedY();

        // Get actual current row the player is on (either source or target row)
        const activeRowY = Math.round(playerY);
        const activeRow = state.rows.find((r) => r.gridY === activeRowY);

        if (activeRow) {
          // --- WATER FLOW JUMP MECHANIC ---
          if (activeRow.type === 'WATER') {
            // Player is on a water row! Must stand on a log or lilypad
            let onSolidObject = false;
            let currentLogSpeed = 0;
            let currentLogDir = 1;

            activeRow.obstacles.forEach((obs) => {
              if (obs.type === 'LOG' || obs.type === 'LILYPAD') {
                const halfWidth = obs.width / 2;
                // Check if player's X matches log X boundary
                if (playerX >= obs.gridX - halfWidth - 0.25 && playerX <= obs.gridX + halfWidth + 0.25) {
                  onSolidObject = true;
                  currentLogSpeed = obs.speed;
                  currentLogDir = obs.direction;
                }
              }
            });

            if (onSolidObject && state.player.animProgress >= 1.0) {
              // Drift along with log/lilypad
              state.player.gridX += (currentLogSpeed / 50) * currentLogDir;
              state.player.targetGridX = state.player.gridX;

              // Check if floated off screen
              const maxBoundX = Math.floor(HORIZONTAL_CELLS / 2) + 0.8;
              if (state.player.gridX < -maxBoundX || state.player.gridX > maxBoundX) {
                triggerDeath('WATER');
              }
            } else if (!onSolidObject && state.player.animProgress >= 1.0) {
              // Plop! Sunk in water
              triggerDeath('WATER');
            }
          }

          // --- ROAD/RAIL TRAFFIC CRASH MECHANIC ---
          if (activeRow.type === 'ROAD') {
            activeRow.obstacles.forEach((obs) => {
              if (obs.type === 'CAR' || obs.type === 'TRUCK') {
                const distanceX = Math.abs(playerX - obs.gridX);
                // Simple box collider check
                if (distanceX < (obs.width / 2) + 0.45) {
                  triggerDeath('CAR');
                }
              }
            });
          }

          if (activeRow.type === 'RAIL') {
            if (activeRow.trainActive && (!activeRow.trainWarningTimer || activeRow.trainWarningTimer <= 0)) {
              // Train is zoomin
              const distanceX = Math.abs(playerX - (activeRow.trainX || 0));
              if (distanceX < 4.5) { // Trains are very long boxes
                triggerDeath('TRAIN');
              }
            }
          }

          // --- COIN PICKUPS ---
          activeRow.obstacles = activeRow.obstacles.filter((obs) => {
            if (obs.type === 'COIN') {
              const distanceX = Math.abs(playerX - obs.gridX);
              if (distanceX < 0.6) {
                // Collected coin!
                state.coinsCount += 1;
                setCoins(state.coinsCount);
                playCoinSound();
                
                // pop sparkly text and explosion
                spawnFloatingText('+5', obs.gridX * GRID_SIZE, -activeRow.gridY * GRID_SIZE - 25, '#eab308');
                spawnParticles(obs.gridX * GRID_SIZE, -activeRow.gridY * GRID_SIZE, '#f59e0b', 8);
                return false; // remove coin
              }
            }
            return true;
          });
        }

        // Eagle tracking loop if active
        if (state.eagleActive) {
          state.eagleX += 15; // Flies rapidly across screen
          if (state.eagleX > viewWidth / 2 + 100) {
            state.eagleActive = false;
          }
        }
      }

      // 7. Update particles and floating texts
      state.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life++;
      });
      state.particles = state.particles.filter((p) => p.life < p.maxLife);

      state.floatingTexts.forEach((ft) => {
        ft.y -= 0.5; // floats up
        ft.life++;
      });
      state.floatingTexts = state.floatingTexts.filter((ft) => ft.life < ft.maxLife);


      // --- CANVAS RENDERING (ALL PIXELS DRAWN HERE) ---
      
      // Clear screen
      ctx.fillStyle = '#0f172a'; // dark slate bg
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      // Save drawing context
      ctx.save();
      // Apply camera scrolling transform (Y-scrolling only)
      ctx.translate(viewWidth / 2, state.cameraY);

      // A. DRAW ROWS (TERRAINS)
      state.rows.forEach((row) => {
        const rowYPixels = -row.gridY * GRID_SIZE;

        // Draw Row Base Terrain Color
        ctx.fillStyle = row.color;
        ctx.fillRect(-viewWidth / 2, rowYPixels, viewWidth, GRID_SIZE);

        // Add visual texture stylings per row
        if (row.type === 'GRASS') {
          // Draw subtle alternating dark/light green grass checker blades
          ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
          for (let i = -8; i <= 8; i++) {
            if ((Math.abs(row.gridY) + Math.abs(i)) % 2 === 0) {
              ctx.fillRect(i * GRID_SIZE - GRID_SIZE / 2, rowYPixels, GRID_SIZE, GRID_SIZE);
            }
          }
        } else if (row.type === 'ROAD') {
          // Draw asphalt strip lines
          ctx.fillStyle = '#475569';
          ctx.fillRect(-viewWidth / 2, rowYPixels, viewWidth, 1.5);
          ctx.fillRect(-viewWidth / 2, rowYPixels + GRID_SIZE - 1.5, viewWidth, 1.5);

          // Center dashed line
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.setLineDash([12, 12]);
          ctx.beginPath();
          ctx.moveTo(-viewWidth / 2, rowYPixels + GRID_SIZE / 2);
          ctx.lineTo(viewWidth / 2, rowYPixels + GRID_SIZE / 2);
          ctx.stroke();
          ctx.setLineDash([]); // clear dash
        } else if (row.type === 'WATER') {
          // Draw waves
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const wavePhase = (Date.now() / 250) % 20;
          for (let sx = -viewWidth / 2; sx < viewWidth / 2; sx += 40) {
            ctx.moveTo(sx + wavePhase, rowYPixels + GRID_SIZE / 3);
            ctx.quadraticCurveTo(sx + 10 + wavePhase, rowYPixels + GRID_SIZE / 3 + 4, sx + 20 + wavePhase, rowYPixels + GRID_SIZE / 3);
            ctx.quadraticCurveTo(sx + 30 + wavePhase, rowYPixels + GRID_SIZE / 3 - 4, sx + 40 + wavePhase, rowYPixels + GRID_SIZE / 3);
          }
          ctx.stroke();
        } else if (row.type === 'RAIL') {
          // Draw track ties (wood sleepers)
          ctx.fillStyle = '#78350f'; // wood brown
          for (let i = -10; i <= 10; i++) {
            ctx.fillRect(i * 35 - 3, rowYPixels + 8, 6, GRID_SIZE - 16);
          }
          // Steel rails
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-viewWidth / 2, rowYPixels + 14, viewWidth, 4);
          ctx.fillRect(-viewWidth / 2, rowYPixels + GRID_SIZE - 18, viewWidth, 4);

          // Red Flashing lights
          if (row.trainActive && row.trainWarningTimer && row.trainWarningTimer > 0) {
            const isFlashOn = Math.floor(Date.now() / 150) % 2 === 0;
            const signalPosX = 220; // right side signal
            const signalPosY = rowYPixels + GRID_SIZE / 2;

            // post
            ctx.fillStyle = '#475569';
            ctx.fillRect(signalPosX - 2, rowYPixels, 4, GRID_SIZE);

            // lights backplate
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(signalPosX, signalPosY, 12, 0, Math.PI * 2);
            ctx.fill();

            // flash red bulb
            ctx.fillStyle = isFlashOn ? '#ef4444' : '#7f1d1d';
            ctx.beginPath();
            ctx.arc(signalPosX, signalPosY, 6, 0, Math.PI * 2);
            ctx.fill();
            if (isFlashOn) {
              // light aura
              ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
              ctx.beginPath();
              ctx.arc(signalPosX, signalPosY, 16, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // B. DRAW OBSTACLES INSIDE ROW
        row.obstacles.forEach((obs) => {
          const obsXPixels = obs.gridX * GRID_SIZE;
          const obsYPixels = rowYPixels + GRID_SIZE / 2;

          if (obs.type === 'TREE') {
            // Draw 3D-ish voxel style Tree
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);
            
            // Trunk
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-5, 0, 10, 15);

            // Foliage block
            ctx.fillStyle = '#15803d'; // dark green leaves
            ctx.fillRect(-18, -25, 36, 25);
            // Highlights top/left
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(-18, -25, 36, 6);
            ctx.fillRect(-18, -25, 6, 25);

            ctx.restore();
          } else if (obs.type === 'ROCK') {
            // Boulder
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);
            
            ctx.fillStyle = '#64748b'; // slate grey
            ctx.beginPath();
            ctx.arc(0, 5, 14, 0, Math.PI * 2);
            ctx.fill();

            // highlight
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(-4, 1, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          } else if (obs.type === 'CAR') {
            // Draw voxel car block
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);
            
            // Wheels
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-18, -12, 10, 5);
            ctx.fillRect(8, -12, 10, 5);
            ctx.fillRect(-18, 12, 10, 5);
            ctx.fillRect(8, 12, 10, 5);

            // Car Body base
            ctx.fillStyle = obs.color;
            ctx.fillRect(-22, -10, 44, 20);

            // Car cabin / windshield
            ctx.fillStyle = '#1e293b'; // dark cabin windows
            ctx.fillRect(-8, -8, 20, 16);
            ctx.fillStyle = '#e2e8f0'; // windshield reflection
            ctx.fillRect(4, -6, 6, 12);

            ctx.restore();
          } else if (obs.type === 'TRUCK') {
            // Draw long flatbed/box truck
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);
            
            // Wheels
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-28, -12, 10, 5);
            ctx.fillRect(14, -12, 10, 5);
            ctx.fillRect(-28, 12, 10, 5);
            ctx.fillRect(14, 12, 10, 5);

            // Cab
            ctx.fillStyle = obs.color;
            ctx.fillRect(12, -10, 18, 20);
            ctx.fillStyle = '#e2e8f0'; // windshield
            ctx.fillRect(20, -7, 6, 14);

            // Cargo Box
            ctx.fillStyle = '#e2e8f0'; // metallic silver container box
            ctx.fillRect(-32, -11, 44, 22);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-32, -11, 44, 22);

            ctx.restore();
          } else if (obs.type === 'LOG') {
            // Floating Log
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);

            // Planks/Log cylinder shape
            ctx.fillStyle = '#854d0e'; // darker wood
            ctx.fillRect(-(obs.width * GRID_SIZE) / 2, -12, obs.width * GRID_SIZE, 24);

            // Tree ring details
            ctx.fillStyle = '#b45309';
            ctx.fillRect(-(obs.width * GRID_SIZE) / 2, -12, 6, 24);
            ctx.fillRect((obs.width * GRID_SIZE) / 2 - 6, -12, 6, 24);

            ctx.restore();
          } else if (obs.type === 'LILYPAD') {
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);

            // Circular leaf pad
            ctx.fillStyle = '#065f46';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 1.7); // cute slice taken out of circle like lilypad
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          } else if (obs.type === 'COIN') {
            // Gold shiny coin
            ctx.save();
            ctx.translate(obsXPixels, obsYPixels);

            // Spinning factor
            const spinScale = Math.abs(Math.sin(Date.now() / 200));

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.ellipse(0, 0, 10 * spinScale, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fef08a'; // core shine
            ctx.beginPath();
            ctx.ellipse(0, 0, 5 * spinScale, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }

          // Render train tracks zooming bullet trains
          if (row.type === 'RAIL' && row.trainActive && (!row.trainWarningTimer || row.trainWarningTimer <= 0)) {
            const trX = (row.trainX || 0) * GRID_SIZE;
            const trY = rowYPixels + GRID_SIZE / 2;

            ctx.save();
            ctx.translate(trX, trY);

            // Giant Train Engine Block
            ctx.fillStyle = '#b91c1c'; // fast red bullet train
            ctx.fillRect(-220, -14, 440, 28);

            // cabin windows strip
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-180, -8, 360, 4);

            // headlights (yellow projection beams)
            ctx.fillStyle = '#fef08a';
            const headX = row.direction === 1 ? 220 : -220;
            ctx.beginPath();
            ctx.arc(headX, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            // Draw yellow headlight cone on tracks
            ctx.fillStyle = 'rgba(254, 240, 138, 0.15)';
            ctx.beginPath();
            if (row.direction === 1) {
              ctx.moveTo(headX, 0);
              ctx.lineTo(headX + 180, -60);
              ctx.lineTo(headX + 180, 60);
            } else {
              ctx.moveTo(headX, 0);
              ctx.lineTo(headX - 180, -60);
              ctx.lineTo(headX - 180, 60);
            }
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          }
        });
      });

      // C. DRAW PLAYER CHARACTER
      if (state.player.isDead && state.player.deathType === 'EAGLE') {
        // Player is carried by eagle! Draw player attached to eagle below
      } else {
        const pX = getInterpolatedX() * GRID_SIZE;
        const pY = -getInterpolatedY() * GRID_SIZE;

        // Hopping squash & stretch physics
        const progress = state.player.animProgress;
        const hopArcHeight = Math.sin(progress * Math.PI) * 18; // peak height in air
        
        // Scale values
        let scaleX = 1.0;
        let scaleY = 1.0;

        if (progress > 0 && progress < 1.0) {
          // squishing down/up
          scaleX = 0.9 + Math.sin(progress * Math.PI) * 0.15;
          scaleY = 1.1 - Math.sin(progress * Math.PI) * 0.15;
        }

        ctx.save();
        // Translate player to coordinates including active jump height offsets
        ctx.translate(pX, pY - hopArcHeight);
        ctx.scale(scaleX, scaleY);

        // Render player block
        if (state.player.isDead && state.player.deathType === 'TRAIN') {
          // Flat/squished paper shape for train death!
          ctx.scale(1.5, 0.1);
        }

        // Draw Player 3D voxel box container (Same box geometry as list view)
        // Adjust coordinate center-bottom
        const pSize = 34;
        
        ctx.save();
        ctx.translate(0, GRID_SIZE / 2 - 2);
        // Face rotation depending on direction
        let rotY = 0;
        if (state.player.facing === 'LEFT') rotY = -Math.PI / 4;
        else if (state.player.facing === 'RIGHT') rotY = Math.PI / 4;
        else if (state.player.facing === 'DOWN') rotY = Math.PI;

        // Shadow under player block
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 * scaleX, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3D Box extrusion colors
        ctx.fillStyle = character.primaryColor;
        ctx.fillRect(-pSize / 2, -pSize, pSize, pSize);

        // Top cap extrusion
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; // highlight
        ctx.fillRect(-pSize / 2, -pSize, pSize, 6);

        // Render image front cover or stylized smile
        if (playerImageRef.current) {
          // Draw their real cropped family member photo!
          ctx.save();
          ctx.beginPath();
          // Slightly indent photo inside block
          ctx.rect(-pSize / 2 + 2, -pSize + 4, pSize - 4, pSize - 6);
          ctx.clip();
          ctx.drawImage(playerImageRef.current, -pSize / 2 + 2, -pSize + 4, pSize - 4, pSize - 6);
          ctx.restore();
        } else {
          // Draw cute customizable face
          ctx.fillStyle = '#ffffff';
          // eyes
          ctx.fillRect(-8, -pSize + 10, 4, 6);
          ctx.fillRect(4, -pSize + 10, 4, 6);
          // cheeks
          ctx.fillStyle = 'rgba(255,100,100,0.5)';
          ctx.fillRect(-11, -pSize + 16, 4, 3);
          ctx.fillRect(7, -pSize + 16, 4, 3);
          // smile
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, -pSize + 16, 3, 0, Math.PI);
          ctx.stroke();
        }

        ctx.restore();
        ctx.restore();
      }

      // D. DRAW GIANT EAGLE / HAWK zoom grabber
      if (state.eagleActive) {
        const egX = state.eagleX;
        const egY = -state.eagleTargetY * GRID_SIZE + GRID_SIZE / 2;

        ctx.save();
        ctx.translate(egX, egY);

        // Giant Wing span shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(-80, 20, 160, 40);

        // Draw Eagle Box shape
        ctx.fillStyle = '#451a03'; // Eagle dark brown
        ctx.fillRect(-55, -20, 110, 34);

        // Head
        ctx.fillStyle = '#ffffff'; // Bald eagle white head
        ctx.fillRect(40, -18, 18, 22);
        // Beak
        ctx.fillStyle = '#eab308'; // Gold beak
        ctx.fillRect(58, -12, 10, 10);

        // Wings
        ctx.fillStyle = '#270e01';
        // Flapping wings logic based on frame
        const isWingUp = Math.floor(Date.now() / 90) % 2 === 0;
        if (isWingUp) {
          ctx.fillRect(-45, -50, 40, 40);
          ctx.fillRect(5, -50, 40, 40);
        } else {
          ctx.fillRect(-45, 10, 40, 40);
          ctx.fillRect(5, 10, 40, 40);
        }

        // If carrying player, draw player block in eagle claws!
        if (state.player.isDead && state.player.deathType === 'EAGLE') {
          ctx.save();
          ctx.translate(0, 20); // Clung beneath claws
          ctx.fillStyle = character.primaryColor;
          ctx.fillRect(-15, 0, 30, 30);
          
          if (playerImageRef.current) {
            ctx.drawImage(playerImageRef.current, -13, 2, 26, 26);
          } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(-4, 6, 2, 4);
            ctx.fillRect(2, 6, 2, 4);
          }
          ctx.restore();
        }

        ctx.restore();
      }

      // E. DRAW SPARKS PARTICLES
      state.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        // Fade particle out with age
        const alpha = 1.0 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      });
      ctx.globalAlpha = 1.0; // reset

      // F. DRAW FLOATING SCORES
      state.floatingTexts.forEach((ft) => {
        ctx.fillStyle = ft.color;
        const alpha = 1.0 - ft.life / ft.maxLife;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 15px "JetBrains Mono", monospace';
        ctx.fillText(ft.text, ft.x - 10, ft.y);
      });
      ctx.globalAlpha = 1.0; // reset

      // Restore translate context
      ctx.restore();


      // --- HUD ELEMENT CONTROLS (SCREEN FIXED) ---

      // Score counter (huge bold retro text)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.font = 'bold 50px "Inter", sans-serif';
      ctx.textBaseline = 'top';
      ctx.strokeText(state.score.toString(), 25, 25);
      ctx.fillText(state.score.toString(), 25, 25);

      // Coins display
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.strokeText(`🟡 ${coins}`, 25, 80);
      ctx.fillText(`🟡 ${coins}`, 25, 80);

      // Character indicator and Personal Best
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px "JetBrains Mono", monospace';
      const indicatorText = `PLAYING AS: ${character.name.toUpperCase()} (BEST: ${localHighScore})`;
      ctx.strokeText(indicatorText, 25, 120);
      ctx.fillText(indicatorText, 25, 120);

      // Trigger frame recursion
      frameId = requestAnimationFrame(handleUpdateAndRender);
    };

    frameId = requestAnimationFrame(handleUpdateAndRender);
    return () => cancelAnimationFrame(frameId);
  }, [coins, localHighScore, character, soundOn]);

  // Helpers to fetch interpolated player coordinates for smooth scrolling/centering
  function getInterpolatedX() {
    const p = stateRef.current.player;
    return p.gridX + (p.targetGridX - p.gridX) * p.animProgress;
  }

  function getInterpolatedY() {
    const p = stateRef.current.player;
    return p.gridY + (p.targetGridY - p.gridY) * p.animProgress;
  }

  // Crash / Drown triggers
  function triggerDeath(type: 'CAR' | 'WATER' | 'TRAIN') {
    const state = stateRef.current;
    state.player.isDead = true;
    state.player.deathType = type;
    setIsDeadState(true);

    // Play custom family squashed voice clip if available
    if (isSoundEnabled() && character.audioUrl) {
      try {
        const voice = new Audio(character.audioUrl);
        voice.volume = 1.0;
        voice.play().catch(e => console.warn('Browser voice clip play delayed/blocked:', e));
      } catch (err) {
        console.error('Error initializing family voice clip:', err);
      }
    }

    if (type === 'CAR' || type === 'TRAIN') {
      playCrashSound();
      const pX = state.player.gridX * GRID_SIZE;
      const pY = -state.player.gridY * GRID_SIZE;
      // Explosive blood-red/custom parts particles!
      spawnParticles(pX, pY, '#ef4444', 15);
      spawnParticles(pX, pY, character.primaryColor, 15);
    } else if (type === 'WATER') {
      playSplashSound();
      const pX = state.player.gridX * GRID_SIZE;
      const pY = -state.player.gridY * GRID_SIZE;
      // Splash blue droplets
      spawnParticles(pX, pY, '#38bdf8', 25);
    }

    // Call callback in parent after 1.5 seconds delay
    setTimeout(() => {
      onGameOver(stateRef.current.score);
    }, 1500);
  }

  // Hawk zoom grab trigger
  function triggerEagleGrab() {
    const state = stateRef.current;
    if (state.player.isDead) return;

    state.eagleActive = true;
    state.eagleTargetY = state.player.gridY;
    state.eagleX = -250; // starts off screen
    state.player.isDead = true;
    state.player.deathType = 'EAGLE';
    setIsDeadState(true);

    // Play custom family squashed voice clip if available
    if (isSoundEnabled() && character.audioUrl) {
      try {
        const voice = new Audio(character.audioUrl);
        voice.volume = 1.0;
        voice.play().catch(e => console.warn('Browser voice clip play delayed/blocked:', e));
      } catch (err) {
        console.error('Error initializing family voice clip:', err);
      }
    }

    playEagleSound();

    setTimeout(() => {
      onGameOver(stateRef.current.score);
    }, 1500);
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden relative font-sans select-none" ref={containerRef}>
      {/* HUD Bar controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => {
            const enabled = toggleSound();
            setSoundOn(enabled);
          }}
          className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-xl transition backdrop-blur border border-white/10 active:scale-95 cursor-pointer"
          title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
        >
          {soundOn ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
        </button>

        <button
          onClick={restartGame}
          className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-xl transition backdrop-blur border border-white/10 active:scale-95 cursor-pointer"
          title="Restart Game (R)"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={onExit}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition border border-red-500/20 shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
        >
          Quit Game
        </button>
      </div>

      {/* Main Game Rendering Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Touch Screen / On-Screen Controls for mobile and Fire Stick browsers */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center gap-1 md:hidden">
        {/* Up */}
        <button
          onClick={() => movePlayer(0, 1)}
          className="w-14 h-14 bg-white/20 hover:bg-white/35 active:scale-90 text-white rounded-full flex items-center justify-center backdrop-blur border border-white/15 shadow-xl cursor-pointer"
        >
          <ArrowUp className="w-6 h-6 stroke-[3]" />
        </button>
        <div className="flex gap-14">
          {/* Left */}
          <button
            onClick={() => movePlayer(-1, 0)}
            className="w-14 h-14 bg-white/20 hover:bg-white/35 active:scale-90 text-white rounded-full flex items-center justify-center backdrop-blur border border-white/15 shadow-xl cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6 stroke-[3]" />
          </button>
          {/* Right */}
          <button
            onClick={() => movePlayer(1, 0)}
            className="w-14 h-14 bg-white/20 hover:bg-white/35 active:scale-90 text-white rounded-full flex items-center justify-center backdrop-blur border border-white/15 shadow-xl cursor-pointer"
          >
            <ArrowRight className="w-6 h-6 stroke-[3]" />
          </button>
        </div>
        {/* Down */}
        <button
          onClick={() => movePlayer(0, -1)}
          className="w-14 h-14 bg-white/20 hover:bg-white/35 active:scale-90 text-white rounded-full flex items-center justify-center backdrop-blur border border-white/15 shadow-xl cursor-pointer"
        >
          <ArrowDown className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* Helpful tip about controls */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-1.5 text-xs text-white/50 bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>Use <kbd className="bg-white/10 px-1 rounded">Arrow Keys</kbd> or <kbd className="bg-white/10 px-1 rounded">WASD</kbd> to jump. Fits standard TV Remote control!</span>
      </div>

      {/* Death Modal / Game Over Overlay */}
      {isDeadState && (
        <div className="absolute inset-0 z-30 bg-black/75 flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
            <h3 className="text-3xl font-extrabold text-red-500 tracking-tight uppercase">
              Wasted!
            </h3>
            
            <div className="space-y-1">
              <span className="text-slate-400 text-xs uppercase tracking-widest font-mono">You got</span>
              <p className="text-5xl font-black text-white">{stateRef.current.score}</p>
              <span className="text-slate-400 text-xs uppercase tracking-widest font-mono">points</span>
            </div>

            <p className="text-sm text-slate-300">
              {stateRef.current.player.deathType === 'CAR' && `🚗 Oh no! ${character.name} got run over by a car!`}
              {stateRef.current.player.deathType === 'WATER' && `🌊 Splash! ${character.name} fell into the river!`}
              {stateRef.current.player.deathType === 'TRAIN' && `🚊 Flattened! ${character.name} was squished by a high-speed train!`}
              {stateRef.current.player.deathType === 'EAGLE' && `🦅 Hawk Strike! ${character.name} stood idle for too long and got taken!`}
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={restartGame}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer"
              >
                Play Again (Enter)
              </button>
              <button
                onClick={onExit}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition active:scale-95 cursor-pointer"
              >
                Roster Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
