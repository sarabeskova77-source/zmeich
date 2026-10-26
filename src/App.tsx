import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'ring' | 'star';
}

interface SnakeSegment {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

// Constants
const GRID_SIZE = 20;
const CELL_SIZE_DESKTOP = 24;
const CELL_SIZE_MOBILE = 16;

const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 140,
  medium: 90,
  hard: 55,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
};

// Helper functions
function getRandomPosition(gridSize: number, snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
  } while (snake.some(segment => segment.x === pos.x && segment.y === pos.y));
  return pos;
}

function getInitialSnake(): Position[] {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Main App Component
export default function App() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showControls, setShowControls] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [cellSize, setCellSize] = useState(CELL_SIZE_DESKTOP);

  // Game logic refs
  const snakeRef = useRef<SnakeSegment[]>([]);
  const foodRef = useRef<Position>({ x: 15, y: 10 });
  const particlesRef = useRef<Particle[]>([]);
  const lastMoveTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>('idle');
  const difficultyRef = useRef<Difficulty>('medium');
  const scoreRef = useRef(0);
  const foodPulseRef = useRef(0);
  const screenShakeRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number; alpha: number }[]>([]);

  // Sync refs with state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Update cell size
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < 480) {
        setCellSize(Math.floor((width - 40) / GRID_SIZE));
      } else if (width < 768) {
        setCellSize(CELL_SIZE_MOBILE);
      } else {
        setCellSize(CELL_SIZE_DESKTOP);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Show touch controls
  useEffect(() => {
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (hasTouchScreen) setShowControls(true);
  }, []);

  // Spawn explosion particles
  const spawnExplosion = useCallback((x: number, y: number, cs: number) => {
    const centerX = x * cs + cs / 2;
    const centerY = y * cs + cs / 2;
    const colors = ['#ff6b6b', '#feca57', '#ff9ff3', '#48dbfb', '#00d2d3', '#ff9f43', '#ee5a24'];

    // Sparks
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 5;
      particlesRef.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 4,
        type: 'spark',
      });
    }

    // Ring particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 1 + Math.random() * 2;
      particlesRef.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.8 + Math.random() * 0.3,
        color: '#feca57',
        size: 3 + Math.random() * 3,
        type: 'star',
      });
    }

    // Center flash
    particlesRef.current.push({
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      life: 1,
      maxLife: 0.3,
      color: '#ffffff',
      size: cs * 1.5,
      type: 'ring',
    });

    // Screen shake
    screenShakeRef.current = 8;
  }, []);

  // Initialize snake segments
  const initSnake = useCallback(() => {
    const initial = getInitialSnake();
    snakeRef.current = initial.map(pos => ({
      x: pos.x,
      y: pos.y,
      prevX: pos.x,
      prevY: pos.y,
    }));
    foodRef.current = getRandomPosition(GRID_SIZE, initial);
    particlesRef.current = [];
    trailRef.current = [];
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    initSnake();
    directionRef.current = 'RIGHT';
    scoreRef.current = 0;
    setScore(0);
    lastMoveTimeRef.current = performance.now();
  }, [initSnake]);

  // Start game
  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
    gameStateRef.current = 'playing';
  }, [resetGame]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      setGameState('paused');
      gameStateRef.current = 'paused';
    } else if (gameStateRef.current === 'paused') {
      setGameState('playing');
      gameStateRef.current = 'playing';
      lastMoveTimeRef.current = performance.now();
    }
  }, []);

  // Game over
  const triggerGameOver = useCallback(() => {
    setGameState('gameover');
    gameStateRef.current = 'gameover';
    const currentScore = scoreRef.current;
    setScore(currentScore);
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('snake-high-score', currentScore.toString());
    }
  }, [highScore]);

  // Handle direction change
  const changeDirection = useCallback((newDirection: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT',
    };
    if (opposites[newDirection] !== directionRef.current) {
      directionRef.current = newDirection;
    }
  }, []);

  // Move snake (logical step)
  const moveSnake = useCallback(() => {
    const snake = snakeRef.current;
    const head = snake[0];
    const dir = directionRef.current;

    let newX = head.x;
    let newY = head.y;

    switch (dir) {
      case 'UP': newY -= 1; break;
      case 'DOWN': newY += 1; break;
      case 'LEFT': newX -= 1; break;
      case 'RIGHT': newX += 1; break;
    }

    // Wall collision
    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
      triggerGameOver();
      return;
    }

    // Self collision (exclude tail which will move)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === newX && snake[i].y === newY) {
        triggerGameOver();
        return;
      }
    }

    // Save previous positions for interpolation
    for (const seg of snake) {
      seg.prevX = seg.x;
      seg.prevY = seg.y;
    }

    // Move segments
    for (let i = snake.length - 1; i > 0; i--) {
      snake[i].x = snake[i - 1].x;
      snake[i].y = snake[i - 1].y;
    }
    snake[0].x = newX;
    snake[0].y = newY;

    // Check food
    const food = foodRef.current;
    if (newX === food.x && newY === food.y) {
      // Grow snake
      const tail = snake[snake.length - 1];
      snake.push({
        x: tail.prevX,
        y: tail.prevY,
        prevX: tail.prevX,
        prevY: tail.prevY,
      });

      // Spawn explosion
      spawnExplosion(food.x, food.y, cellSize);

      // Update score
      scoreRef.current += 10;
      setScore(scoreRef.current);

      // New food
      const positions = snake.map(s => ({ x: s.x, y: s.y }));
      foodRef.current = getRandomPosition(GRID_SIZE, positions);
    }

    lastMoveTimeRef.current = performance.now();
  }, [cellSize, spawnExplosion, triggerGameOver]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault(); changeDirection('UP'); break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault(); changeDirection('DOWN'); break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault(); changeDirection('LEFT'); break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault(); changeDirection('RIGHT'); break;
        case ' ': case 'Escape':
          e.preventDefault();
          if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
            togglePause();
          } else if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
            startGame();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
            startGame();
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, togglePause, startGame]);

  // Touch controls (swipe)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minSwipe) changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        if (Math.abs(dy) > minSwipe) changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
      touchStartRef.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [changeDirection]);

  // Main game loop with requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const cs = cellSize;
      const canvasSize = GRID_SIZE * cs;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      // Screen shake
      let shakeX = 0, shakeY = 0;
      if (screenShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        screenShakeRef.current *= 0.85;
        if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Clear
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect(-5, -5, canvasSize + 10, canvasSize + 10);

      // Grid
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cs, 0);
        ctx.lineTo(i * cs, canvasSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cs);
        ctx.lineTo(canvasSize, i * cs);
        ctx.stroke();
      }

      // Game logic step
      if (gameStateRef.current === 'playing') {
        const speed = DIFFICULTY_SPEEDS[difficultyRef.current];
        if (currentTime - lastMoveTimeRef.current >= speed) {
          moveSnake();
        }
      }

      // Calculate interpolation factor
      const speed = DIFFICULTY_SPEEDS[difficultyRef.current];
      const elapsed = currentTime - lastMoveTimeRef.current;
      const rawT = Math.min(elapsed / speed, 1);
      const t = easeOutCubic(rawT);

      // Draw trail
      trailRef.current = trailRef.current.filter(tr => {
        tr.alpha -= deltaTime * 3;
        return tr.alpha > 0;
      });
      for (const tr of trailRef.current) {
        ctx.fillStyle = `rgba(0, 210, 211, ${tr.alpha * 0.15})`;
        ctx.beginPath();
        ctx.arc(tr.x * cs + cs / 2, tr.y * cs + cs / 2, cs / 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw food with pulsing animation
      foodPulseRef.current += deltaTime * 4;
      const pulse = Math.sin(foodPulseRef.current) * 0.15 + 1;
      const food = foodRef.current;
      const foodCX = food.x * cs + cs / 2;
      const foodCY = food.y * cs + cs / 2;
      const foodR = (cs / 2 - 2) * pulse;

      // Food glow
      const glowSize = cs * 1.5 * pulse;
      const foodGlow = ctx.createRadialGradient(foodCX, foodCY, 0, foodCX, foodCY, glowSize);
      foodGlow.addColorStop(0, 'rgba(255, 75, 75, 0.25)');
      foodGlow.addColorStop(0.5, 'rgba(255, 75, 75, 0.08)');
      foodGlow.addColorStop(1, 'rgba(255, 75, 75, 0)');
      ctx.fillStyle = foodGlow;
      ctx.fillRect(foodCX - glowSize, foodCY - glowSize, glowSize * 2, glowSize * 2);

      // Food body
      ctx.beginPath();
      ctx.arc(foodCX, foodCY, foodR, 0, Math.PI * 2);
      const foodGrad = ctx.createRadialGradient(foodCX - 2, foodCY - 2, 0, foodCX, foodCY, foodR);
      foodGrad.addColorStop(0, '#ff6b6b');
      foodGrad.addColorStop(0.7, '#ee5a24');
      foodGrad.addColorStop(1, '#c0392b');
      ctx.fillStyle = foodGrad;
      ctx.fill();

      // Food shine
      ctx.beginPath();
      ctx.arc(foodCX - foodR * 0.3, foodCY - foodR * 0.3, foodR * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();

      // Draw snake with interpolation
      const snake = snakeRef.current;
      if (snake.length > 0) {
        for (let i = snake.length - 1; i >= 0; i--) {
          const seg = snake[i];
          const drawX = lerp(seg.prevX, seg.x, t);
          const drawY = lerp(seg.prevY, seg.y, t);
          const px = drawX * cs;
          const py = drawY * cs;
          const padding = 1;

          if (i === 0) {
            // Head glow
            const headGlow = ctx.createRadialGradient(
              px + cs / 2, py + cs / 2, 0,
              px + cs / 2, py + cs / 2, cs
            );
            headGlow.addColorStop(0, 'rgba(0, 210, 211, 0.2)');
            headGlow.addColorStop(1, 'rgba(0, 210, 211, 0)');
            ctx.fillStyle = headGlow;
            ctx.fillRect(px - cs / 2, py - cs / 2, cs * 2, cs * 2);

            // Head
            const headGrad = ctx.createLinearGradient(px, py, px + cs, py + cs);
            headGrad.addColorStop(0, '#00fff2');
            headGrad.addColorStop(0.5, '#00d2d3');
            headGrad.addColorStop(1, '#01a3a4');
            ctx.fillStyle = headGrad;
            ctx.beginPath();
            ctx.roundRect(px + padding, py + padding, cs - padding * 2, cs - padding * 2, cs / 3);
            ctx.fill();

            // Head shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.roundRect(px + padding + 2, py + padding + 2, cs / 2 - 3, cs / 3, cs / 6);
            ctx.fill();

            // Eyes
            const eyeSize = cs / 7;
            const pupilSize = eyeSize * 0.6;
            ctx.fillStyle = '#fff';
            let e1x: number, e1y: number, e2x: number, e2y: number;
            const cx = px + cs / 2;
            const cy = py + cs / 2;

            switch (directionRef.current) {
              case 'UP':
                e1x = cx - cs / 4.5; e1y = cy - cs / 5;
                e2x = cx + cs / 4.5; e2y = cy - cs / 5;
                break;
              case 'DOWN':
                e1x = cx - cs / 4.5; e1y = cy + cs / 5;
                e2x = cx + cs / 4.5; e2y = cy + cs / 5;
                break;
              case 'LEFT':
                e1x = cx - cs / 5; e1y = cy - cs / 4.5;
                e2x = cx - cs / 5; e2y = cy + cs / 4.5;
                break;
              case 'RIGHT':
                e1x = cx + cs / 5; e1y = cy - cs / 4.5;
                e2x = cx + cs / 5; e2y = cy + cs / 4.5;
                break;
            }

            // Eye whites
            ctx.beginPath();
            ctx.arc(e1x, e1y, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(e2x, e2y, eyeSize, 0, Math.PI * 2);
            ctx.fill();

            // Pupils
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(e1x, e1y, pupilSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(e2x, e2y, pupilSize, 0, Math.PI * 2);
            ctx.fill();

            // Add trail from head
            if (gameStateRef.current === 'playing' && Math.random() < 0.3) {
              trailRef.current.push({ x: drawX, y: drawY, alpha: 0.5 });
            }
          } else {
            // Body segment with gradient
            const progress = i / snake.length;
            const r = Math.floor(0 + progress * 10);
            const g = Math.floor(220 - progress * 100);
            const b = Math.floor(210 - progress * 80);
            const alpha = 1 - progress * 0.3;

            // Body glow (subtle)
            if (i < 5) {
              const bodyGlow = ctx.createRadialGradient(
                px + cs / 2, py + cs / 2, 0,
                px + cs / 2, py + cs / 2, cs * 0.8
              );
              bodyGlow.addColorStop(0, `rgba(0, ${g}, ${b}, 0.1)`);
              bodyGlow.addColorStop(1, `rgba(0, ${g}, ${b}, 0)`);
              ctx.fillStyle = bodyGlow;
              ctx.fillRect(px - cs * 0.3, py - cs * 0.3, cs * 1.6, cs * 1.6);
            }

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();
            const segPadding = padding + 1 + progress * 1;
            ctx.roundRect(
              px + segPadding, py + segPadding,
              cs - segPadding * 2, cs - segPadding * 2,
              cs / 4
            );
            ctx.fill();

            // Segment shine
            ctx.fillStyle = `rgba(255, 255, 255, ${0.08 - progress * 0.06})`;
            ctx.beginPath();
            ctx.roundRect(px + segPadding + 1, py + segPadding + 1, cs / 3, cs / 4, cs / 8);
            ctx.fill();
          }
        }
      }

      // Draw and update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.life -= deltaTime / p.maxLife;
        if (p.life <= 0) return false;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vy += 0.1; // gravity

        const alpha = p.life;

        if (p.type === 'spark') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();

          // Spark trail
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
          ctx.strokeStyle = p.color + Math.floor(alpha * 128).toString(16).padStart(2, '0');
          ctx.lineWidth = p.size * alpha * 0.5;
          ctx.stroke();
        } else if (p.type === 'star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(currentTime / 200);
          ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          const s = p.size * alpha;
          // Draw star
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const angle = (j * Math.PI * 2) / 5 - Math.PI / 2;
            const innerAngle = angle + Math.PI / 5;
            ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
            ctx.lineTo(Math.cos(innerAngle) * s * 0.4, Math.sin(innerAngle) * s * 0.4);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'ring') {
          const ringSize = p.size * (1 - alpha * 0.5);
          ctx.beginPath();
          ctx.arc(p.x, p.y, ringSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
          ctx.fill();
        }

        return true;
      });

      // Border glow
      const borderAlpha = gameStateRef.current === 'gameover' ? 0.5 : 0.2;
      ctx.strokeStyle = `rgba(0, 210, 211, ${borderAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvasSize - 2, canvasSize - 2);

      // Corner accents
      const cornerSize = cs;
      const corners = [
        [0, 0], [canvasSize, 0],
        [0, canvasSize], [canvasSize, canvasSize]
      ];
      ctx.strokeStyle = 'rgba(0, 210, 211, 0.5)';
      ctx.lineWidth = 2;
      corners.forEach(([cx, cy]) => {
        const dx = cx === 0 ? 1 : -1;
        const dy = cy === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx + dx * cornerSize, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * cornerSize);
        ctx.stroke();
      });

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cellSize, moveSnake]);

  const canvasSize = GRID_SIZE * cellSize;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg mb-4"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            🐍 Змейка
          </h1>
          <div className="flex gap-3">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-700">
              <span className="text-xs text-slate-400 block">Счёт</span>
              <motion.span
                key={score}
                initial={{ scale: 1.3, color: '#feca57' }}
                animate={{ scale: 1, color: '#22d3ee' }}
                className="text-lg font-bold text-cyan-400 block"
              >
                {score}
              </motion.span>
            </div>
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-700">
              <span className="text-xs text-slate-400 block">Рекорд</span>
              <span className="text-lg font-bold text-amber-400">{highScore}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Game Canvas */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="rounded-xl shadow-2xl shadow-cyan-900/20"
          style={{ width: canvasSize, height: canvasSize }}
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center px-6"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="text-5xl mb-4"
                >
                  🐍
                </motion.div>
                <h2 className="text-2xl font-bold text-white mb-2">Змейка</h2>
                <p className="text-slate-300 text-sm mb-6">Классическая аркадная игра</p>

                <div className="mb-6">
                  <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Сложность</p>
                  <div className="flex gap-2">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                      <motion.button
                        key={d}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDifficulty(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          difficulty === d
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
                >
                  Начать игру
                </motion.button>
                <p className="text-xs text-slate-500 mt-4">
                  {isMobile ? 'Свайпайте для управления' : 'Стрелки / WASD для управления'}
                </p>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'paused' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-4xl mb-3"
                >
                  ⏸️
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-4">Пауза</h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePause}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  Продолжить
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center px-6"
              >
                <motion.div
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.5 }}
                  className="text-4xl mb-3"
                >
                  💀
                </motion.div>
                <h2 className="text-xl font-bold text-red-400 mb-1">Игра окончена!</h2>
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="text-3xl font-bold text-white mb-1"
                >
                  {score}
                </motion.p>
                <p className="text-sm text-slate-400 mb-1">очков</p>
                {score >= highScore && score > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-amber-400 font-bold text-sm mb-3"
                  >
                    🏆 Новый рекорд!
                  </motion.p>
                )}
                <div className="flex flex-col gap-2 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg"
                  >
                    Играть снова
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setGameState('idle')}
                    className="px-6 py-2 bg-slate-700 text-slate-300 font-medium rounded-xl hover:bg-slate-600 transition-all"
                  >
                    Сменить сложность
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 w-full max-w-lg"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          {(gameState === 'playing' || gameState === 'paused') && (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={togglePause}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all"
              >
                {gameState === 'paused' ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    <span className="text-sm">Продолжить</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    <span className="text-sm">Пауза</span>
                  </>
                )}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
                <span className="text-sm">Рестарт</span>
              </motion.button>
            </>
          )}
        </div>

        {showControls && (gameState === 'playing' || gameState === 'paused') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center"
          >
            <div className="grid grid-cols-3 gap-1.5 w-40">
              <div />
              <motion.button
                whileTap={{ scale: 0.9, backgroundColor: '#0891b2' }}
                onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
                onClick={() => changeDirection('UP')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" /></svg>
              </motion.button>
              <div />
              <motion.button
                whileTap={{ scale: 0.9, backgroundColor: '#0891b2' }}
                onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
                onClick={() => changeDirection('LEFT')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" /></svg>
              </motion.button>
              <div className="aspect-square bg-slate-800/40 border border-slate-700/50 rounded-lg" />
              <motion.button
                whileTap={{ scale: 0.9, backgroundColor: '#0891b2' }}
                onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
                onClick={() => changeDirection('RIGHT')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" /></svg>
              </motion.button>
              <div />
              <motion.button
                whileTap={{ scale: 0.9, backgroundColor: '#0891b2' }}
                onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
                onClick={() => changeDirection('DOWN')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" /></svg>
              </motion.button>
              <div />
            </div>
          </motion.div>
        )}

        {!isMobile && (
          <div className="flex justify-center mt-3">
            <div className="flex gap-4 text-xs text-slate-500">
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">↑↓←→</kbd> Движение
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">Space</kbd> Пауза
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
