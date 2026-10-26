import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const CELL_SIZE_DESKTOP = 24;
const CELL_SIZE_MOBILE = 16;

const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
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

// Main App Component
export default function App() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [showControls, setShowControls] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [cellSize, setCellSize] = useState(CELL_SIZE_DESKTOP);

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Update cell size based on screen
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

  // Show touch controls on touch devices
  useEffect(() => {
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (hasTouchScreen) setShowControls(true);
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    const initialSnake = getInitialSnake();
    setSnake(initialSnake);
    setFood(getRandomPosition(GRID_SIZE, initialSnake));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
  }, []);

  // Start game
  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
  }, [resetGame]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  // Game over
  const gameOver = useCallback(() => {
    setGameState('gameover');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }
  }, [score, highScore]);

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
      setDirection(newDirection);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          changeDirection('RIGHT');
          break;
        case ' ':
        case 'Escape':
          e.preventDefault();
          if (gameState === 'playing' || gameState === 'paused') {
            togglePause();
          } else if (gameState === 'idle' || gameState === 'gameover') {
            startGame();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (gameState === 'idle' || gameState === 'gameover') {
            startGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, gameState, togglePause, startGame]);

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
        if (Math.abs(dx) > minSwipe) {
          changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
        }
      } else {
        if (Math.abs(dy) > minSwipe) {
          changeDirection(dy > 0 ? 'DOWN' : 'UP');
        }
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

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    gameLoopRef.current = window.setInterval(() => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        const dir = directionRef.current;

        switch (dir) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          gameOver();
          return prevSnake;
        }

        // Self collision
        if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Check food
        if (head.x === food.x && head.y === food.y) {
          setScore(prev => prev + 10);
          setFood(getRandomPosition(GRID_SIZE, newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, DIFFICULTY_SPEEDS[difficulty]);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, difficulty, food, gameOver]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = GRID_SIZE * cellSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Clear
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw grid background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvasSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvasSize, i * cellSize);
      ctx.stroke();
    }

    // Draw food with glow
    const foodX = food.x * cellSize + cellSize / 2;
    const foodY = food.y * cellSize + cellSize / 2;
    const foodRadius = cellSize / 2 - 2;

    // Food glow
    const foodGlow = ctx.createRadialGradient(foodX, foodY, 0, foodX, foodY, cellSize);
    foodGlow.addColorStop(0, 'rgba(255, 75, 75, 0.3)');
    foodGlow.addColorStop(1, 'rgba(255, 75, 75, 0)');
    ctx.fillStyle = foodGlow;
    ctx.fillRect(food.x * cellSize - cellSize / 2, food.y * cellSize - cellSize / 2, cellSize * 2, cellSize * 2);

    // Food body
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
    const foodGradient = ctx.createRadialGradient(foodX - 2, foodY - 2, 0, foodX, foodY, foodRadius);
    foodGradient.addColorStop(0, '#ff6b6b');
    foodGradient.addColorStop(1, '#ee5a24');
    ctx.fillStyle = foodGradient;
    ctx.fill();

    // Draw snake
    snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;

      if (index === 0) {
        // Head
        const headGradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        headGradient.addColorStop(0, '#00d2d3');
        headGradient.addColorStop(1, '#01a3a4');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, cellSize / 4);
        ctx.fill();

        // Eyes
        const eyeSize = cellSize / 8;
        ctx.fillStyle = '#fff';
        let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;

        switch (directionRef.current) {
          case 'UP':
            eye1X = centerX - cellSize / 5;
            eye1Y = centerY - cellSize / 6;
            eye2X = centerX + cellSize / 5;
            eye2Y = centerY - cellSize / 6;
            break;
          case 'DOWN':
            eye1X = centerX - cellSize / 5;
            eye1Y = centerY + cellSize / 6;
            eye2X = centerX + cellSize / 5;
            eye2Y = centerY + cellSize / 6;
            break;
          case 'LEFT':
            eye1X = centerX - cellSize / 6;
            eye1Y = centerY - cellSize / 5;
            eye2X = centerX - cellSize / 6;
            eye2Y = centerY + cellSize / 5;
            break;
          case 'RIGHT':
            eye1X = centerX + cellSize / 6;
            eye1Y = centerY - cellSize / 5;
            eye2X = centerX + cellSize / 6;
            eye2Y = centerY + cellSize / 5;
            break;
        }
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body
        const progress = index / snake.length;
        const green = Math.floor(200 - progress * 80);
        const blue = Math.floor(210 - progress * 60);
        ctx.fillStyle = `rgb(0, ${green}, ${blue})`;
        ctx.beginPath();
        ctx.roundRect(x + padding + 1, y + padding + 1, cellSize - (padding + 1) * 2, cellSize - (padding + 1) * 2, cellSize / 5);
        ctx.fill();
      }
    });

    // Draw border
    ctx.strokeStyle = 'rgba(0, 210, 211, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasSize, canvasSize);
  }, [snake, food, cellSize]);

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
              <span className="text-lg font-bold text-cyan-400">{score}</span>
            </div>
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-700">
              <span className="text-xs text-slate-400 block">Рекорд</span>
              <span className="text-lg font-bold text-amber-400">{highScore}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Game Canvas Area */}
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
                <div className="text-5xl mb-4">🐍</div>
                <h2 className="text-2xl font-bold text-white mb-2">Змейка</h2>
                <p className="text-slate-300 text-sm mb-6">Классическая аркадная игра</p>

                {/* Difficulty selector */}
                <div className="mb-6">
                  <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Сложность</p>
                  <div className="flex gap-2">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          difficulty === d
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all hover:scale-105 active:scale-95"
                >
                  Начать игру
                </button>
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
                <div className="text-4xl mb-3">⏸️</div>
                <h2 className="text-xl font-bold text-white mb-4">Пауза</h2>
                <button
                  onClick={togglePause}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                >
                  Продолжить
                </button>
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
                <div className="text-4xl mb-3">💀</div>
                <h2 className="text-xl font-bold text-red-400 mb-1">Игра окончена!</h2>
                <p className="text-3xl font-bold text-white mb-1">{score}</p>
                <p className="text-sm text-slate-400 mb-1">очков</p>
                {score >= highScore && score > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-amber-400 font-bold text-sm mb-3"
                  >
                    🏆 Новый рекорд!
                  </motion.p>
                )}
                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={startGame}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    Играть снова
                  </button>
                  <button
                    onClick={() => setGameState('idle')}
                    className="px-6 py-2 bg-slate-700 text-slate-300 font-medium rounded-xl hover:bg-slate-600 transition-all"
                  >
                    Сменить сложность
                  </button>
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
        {/* Game action buttons */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {(gameState === 'playing' || gameState === 'paused') && (
            <>
              <button
                onClick={togglePause}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all active:scale-95"
              >
                {gameState === 'paused' ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="text-sm">Продолжить</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                    <span className="text-sm">Пауза</span>
                  </>
                )}
              </button>
              <button
                onClick={startGame}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
                <span className="text-sm">Рестарт</span>
              </button>
            </>
          )}
        </div>

        {/* Touch D-Pad controls */}
        {showControls && (gameState === 'playing' || gameState === 'paused') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center"
          >
            <div className="grid grid-cols-3 gap-1.5 w-40">
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
                onClick={() => changeDirection('UP')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 active:bg-cyan-600 active:border-cyan-500 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                </svg>
              </button>
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
                onClick={() => changeDirection('LEFT')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 active:bg-cyan-600 active:border-cyan-500 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                </svg>
              </button>
              <div className="aspect-square bg-slate-800/40 border border-slate-700/50 rounded-lg" />
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
                onClick={() => changeDirection('RIGHT')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 active:bg-cyan-600 active:border-cyan-500 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </button>
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
                onClick={() => changeDirection('DOWN')}
                className="aspect-square bg-slate-800/80 border border-slate-600 rounded-lg flex items-center justify-center text-slate-300 active:bg-cyan-600 active:border-cyan-500 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                </svg>
              </button>
              <div />
            </div>
          </motion.div>
        )}

        {/* Keyboard hints (desktop only) */}
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
