class SudokuCanvasGame {
  constructor() {
    this.canvas = document.getElementById('sudokuCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.gridSize = 9;

    this.initialBoard = Array(9).fill(null).map(() => Array(9).fill(0));
    this.currentBoard = Array(9).fill(null).map(() => Array(9).fill(0));
    this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.conflicts = Array(9).fill(null).map(() => Array(9).fill(false));

    this.selectedCell = null;
    this.isNoteMode = false;
    this.undoStack = [];
    this.isPaused = false;
    this.isVictory = false;

    this.secondsElapsed = 0;
    this.timerInterval = null;
    this.STORAGE_KEY = 'sudoku_canvas_state_v1';

    // New state: currently highlighted number (for issue #4)
    this.highlightNumber = null;

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.setupEventListeners();

    if (this.checkHashAndLoad()) {
      // Loaded from hash seed
    } else if (!this.loadGameState()) {
      this.startNewGame('medium');
    } else {
      this.startTimer();
      this.updateUndoButton();
      this.render();
      this.showToast('Restored previous game state');
    }
  }

  vibrate(pattern) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn('Vibration failed:', e);
      }
    }
  }

  boardToString(board) {
    return board.flat().join('');
  }

  stringToBoard(str) {
    const board = [];
    for (let r = 0; r < 9; r++) {
      const row = [];
      for (let c = 0; c < 9; c++) {
        row.push(parseInt(str[r * 9 + c]));
      }
      board.push(row);
    }
    return board;
  }

  loadBoardFromString(boardStr, isImported = false) {
    this.isVictory = false;
    const victoryOverlay = document.getElementById('victoryOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (victoryOverlay) victoryOverlay.classList.add('hidden');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');

    this.initialBoard = this.stringToBoard(boardStr);
    this.currentBoard = this.initialBoard.map(row => [...row]);
    this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.undoStack = [];
    this.selectedCell = null;
    this.secondsElapsed = 0;

    this.updateConflicts();
    this.updateUndoButton();
    this.startTimer();
    this.saveGameState();
    this.render();
    this.showToast(isImported ? 'Imported seed board successfully' : 'Loaded board from shared link');
  }

  checkHashAndLoad() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#board=')) {
      const boardStr = hash.replace('#board=', '');
      if (boardStr.length === 81 && /^[0-9]+$/.test(boardStr)) {
        this.loadBoardFromString(boardStr);
        return true;
      } else {
        this.showToast('Invalid board link');
      }
    }
    return false;
  }

  saveGameState() {
    try {
      const stateData = {
        initialBoard: this.initialBoard,
        currentBoard: this.currentBoard,
        solution: this.solution,
        notes: this.notes.map(row => row.map(cellSet => Array.from(cellSet))),
        undoStack: this.undoStack.map(action => ({
          ...action,
          prevNotes: Array.from(action.prevNotes || []),
          newNotes: Array.from(action.newNotes || []),
          clearedNotes: (action.clearedNotes || []).map(item => ({
            row: item.row,
            col: item.col,
            prevNotes: Array.from(item.prevNotes || []),
            newNotes: Array.from(item.newNotes || [])
          }))
        })),
        secondsElapsed: this.secondsElapsed,
        difficulty: document.getElementById('difficultySelect').value,
        isVictory: this.isVictory
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateData));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  loadGameState() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      if (!data || !data.currentBoard || !data.initialBoard) return false;

      this.initialBoard = data.initialBoard;
      this.currentBoard = data.currentBoard;
      this.solution = data.solution;
      this.notes = data.notes.map(row => row.map(arr => new Set(arr)));
      this.secondsElapsed = data.secondsElapsed || 0;
      this.isVictory = data.isVictory || false;

      if (data.difficulty) {
        document.getElementById('difficultySelect').value = data.difficulty;
      }

      this.undoStack = (data.undoStack || []).map(action => ({
        ...action,
        prevNotes: new Set(action.prevNotes || []),
        newNotes: new Set(action.newNotes || []),
        clearedNotes: (action.clearedNotes || []).map(item => ({
          row: item.row,
          col: item.col,
          prevNotes: new Set(item.prevNotes || []),
          newNotes: new Set(item.newNotes || [])
        }))
      }));

      this.updateConflicts();
      return true;
    } catch (e) {
      console.error('Failed to load state from LocalStorage:', e);
      return false;
    }
  }

  clearGameState() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('LocalStorage clear failed:', e);
    }
  }

  resizeCanvas() {
    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) - 8;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.scale(dpr, dpr);
    this.cellSize = size / 9;
    this.render();
  }

  startNewGame(difficulty = 'medium') {
    this.isVictory = false;
    document.getElementById('victoryOverlay').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');

    this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
    this.fillBoard(this.solution);

    this.initialBoard = this.solution.map(row => [...row]);

    const removeCount = {easy: 35, medium: 45, hard: 52, expert: 58}[difficulty] || 45;

    let removed = 0;
    while (removed < removeCount) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (this.initialBoard[r][c] !== 0) {
        this.initialBoard[r][c] = 0;
        removed++;
      }
    }

    this.currentBoard = this.initialBoard.map(row => [...row]);
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.undoStack = [];
    this.selectedCell = null;
    this.secondsElapsed = 0;

    this.updateConflicts();
    this.updateUndoButton();
    this.startTimer();
    this.saveGameState();
    this.render();
    this.showToast(`New ${difficulty.toUpperCase()} game started`);
  }

  fillBoard(board) {
    const findEmpty = () => {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0) return [r, c];
        }
      }
      return null;
    };

    const empty = findEmpty();
    if (!empty) return true;
    const [r, c] = empty;
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);

    for (const num of nums) {
      if (this.isValidPlacement(board, r, c, num)) {
        board[r][c] = num;
        if (this.fillBoard(board)) return true;
        board[r][c] = 0;
      }
    }
    return false;
  }

  isValidPlacement(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num && i !== col) return false;
      if (board[i][col] === num && i !== row) return false;
    }
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const nr = boxR + r;
        const nc = boxC + c;
        if (board[nr][nc] === num && (nr !== row || nc !== col)) return false;
      }
    }
    return true;
  }

  updateConflicts() {
    this.conflicts = Array(9).fill(null).map(() => Array(9).fill(false));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentBoard[r][c];
        if (val !== 0) {
          if (!this.isValidPlacement(this.currentBoard, r, c, val)) {
            this.conflicts[r][c] = true;
          }
        }
      }
    }
  }

  // Helper: return peer cells (row, col, box) excluding the cell itself
  getPeers(row, col) {
    const peers = new Set();
    for (let i = 0; i < 9; i++) {
      if (i !== col) peers.add(`${row},${i}`);
      if (i !== row) peers.add(`${i},${col}`);
    }
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if (r === row && c === col) continue;
        peers.add(`${r},${c}`);
      }
    }
    return Array.from(peers).map(s => {
      const [r, c] = s.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  handleCellInput(num) {
    if (!this.selectedCell || this.isVictory || this.isPaused) return;
    const {row, col} = this.selectedCell;

    if (this.initialBoard[row][col] !== 0) {
      this.showToast("Cannot modify fixed numbers");
      return;
    }

    const prevVal = this.currentBoard[row][col];
    const prevNotes = new Set(this.notes[row][col]);

    if (this.isNoteMode) {
      if (num === 0) {
        this.notes[row][col].clear();
      } else {
        if (this.notes[row][col].has(num)) {
          this.notes[row][col].delete(num);
        } else {
          this.notes[row][col].add(num);
        }
      }
      this.currentBoard[row][col] = 0;

      const newNotes = new Set(this.notes[row][col]);
      const newVal = this.currentBoard[row][col];
      if (prevVal !== newVal || [...prevNotes].join(',') !== [...newNotes].join(',')) {
        this.undoStack.push({row, col, prevVal, newVal, prevNotes, newNotes});
        this.updateUndoButton();
      }

    } else {
      // Not note mode: placing a number clears notes in peers automatically (issue #2)
      if (num === 0 || prevVal === num) {
        this.currentBoard[row][col] = 0;
        const newNotesEmpty = new Set(this.notes[row][col]);
        const newValEmpty = this.currentBoard[row][col];
        if (prevVal !== newValEmpty || [...prevNotes].join(',') !== [...newNotesEmpty].join(',')) {
          this.undoStack.push({row, col, prevVal, newVal: newValEmpty, prevNotes, newNotes: newNotesEmpty});
          this.updateUndoButton();
        }
      } else {
        // Place the number and remove that number from notes in peer cells
        this.currentBoard[row][col] = num;
        const clearedNotes = [];
        const peers = this.getPeers(row, col);
        peers.forEach(p => {
          if (this.notes[p.row][p.col].has(num)) {
            const prev = new Set(this.notes[p.row][p.col]);
            this.notes[p.row][p.col].delete(num);
            const after = new Set(this.notes[p.row][p.col]);
            clearedNotes.push({ row: p.row, col: p.col, prevNotes: prev, newNotes: after });
          }
        });

        const newNotesForCell = new Set(this.notes[row][col]);
        const newValForCell = this.currentBoard[row][col];
        this.undoStack.push({ row, col, prevVal, newVal: newValForCell, prevNotes, newNotes: newNotesForCell, clearedNotes });
        this.updateUndoButton();
      }
    }

    this.updateConflicts();

    if (num !== 0 && this.conflicts[row][col]) {
      this.vibrate([40, 30, 40]);
    } else {
      this.vibrate(20);
    }

    this.checkWinCondition();
    this.saveGameState();
    this.render();
  }

  resetBoard() {
    if (this.isVictory || this.isPaused) return;

    this.currentBoard = this.initialBoard.map(row => [...row]);
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.undoStack = [];
    this.selectedCell = null;

    this.updateConflicts();
    this.updateUndoButton();
    this.saveGameState();
    this.render();
    this.showToast("Puzzle reset to initial state");
  }

  undo() {
    if (this.undoStack.length === 0 || this.isVictory || this.isPaused) return;

    const action = this.undoStack.pop();

    // Restore any cleared notes from a placement
    if (Array.isArray(action.clearedNotes)) {
      action.clearedNotes.forEach(item => {
        this.notes[item.row][item.col] = new Set(item.prevNotes || []);
      });
    }

    const {row, col, prevVal, prevNotes} = action;

    this.currentBoard[row][col] = prevVal;
    this.notes[row][col] = new Set(prevNotes);

    this.selectedCell = {row, col};
    this.updateConflicts();
    this.updateUndoButton();
    this.saveGameState();
    this.render();
    this.showToast("Move undone");
  }

  updateUndoButton() {
    document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
  }

  render() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const cs = this.cellSize;

    this.ctx.clearRect(0, 0, width, height);

    const selectedVal = this.selectedCell ? this.currentBoard[this.selectedCell.row][this.selectedCell.col] : null;

    // Compute highlight mask if a number is highlighted (issue #4)
    let highlightMask = Array(9).fill(null).map(() => Array(9).fill(false));
    if (this.highlightNumber) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.currentBoard[r][c] === this.highlightNumber) {
            // mark entire row
            for (let cc = 0; cc < 9; cc++) highlightMask[r][cc] = true;
            // mark entire column
            for (let rr = 0; rr < 9; rr++) highlightMask[rr][c] = true;
            // mark box
            const boxR = Math.floor(r / 3) * 3;
            const boxC = Math.floor(c / 3) * 3;
            for (let br = boxR; br < boxR + 3; br++) {
              for (let bc = boxC; bc < boxC + 3; bc++) {
                highlightMask[br][bc] = true;
              }
            }
          }
        }
      }
    }

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = c * cs;
        const y = r * cs;

        let bgColor = '#0f172a';

        // Apply highlight color if applicable (low precedence)
        if (this.highlightNumber && highlightMask[r][c]) {
          bgColor = '#065f46'; // emerald-like highlight
        }

        if (this.selectedCell) {
          const {row: selR, col: selC} = this.selectedCell;
          const sameBox = Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3);
          if (r === selR || c === selC || sameBox) {
            bgColor = '#1e293b';
          }
          const val = this.currentBoard[r][c];
          if (selectedVal !== 0 && val === selectedVal) {
            bgColor = '#312e81';
          }
          if (r === selR && c === selC) {
            bgColor = '#3730a3';
          }
        }

        if (this.conflicts[r][c]) {
          bgColor = '#7f1d1d';
        }

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(x, y, cs, cs);
      }
    }

    // Draw Grid Lines
    for (let i = 0; i <= 9; i++) {
      this.ctx.beginPath();
      this.ctx.lineWidth = (i % 3 === 0) ? 3 : 1;
      this.ctx.strokeStyle = (i % 3 === 0) ? '#475569' : '#334155';

      this.ctx.moveTo(i * cs, 0);
      this.ctx.lineTo(i * cs, height);

      this.ctx.moveTo(0, i * cs);
      this.ctx.lineTo(width, i * cs);
      this.ctx.stroke();
    }

    // Draw Numbers and Notes
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = c * cs;
        const y = r * cs;
        const val = this.currentBoard[r][c];
        const isInitial = this.initialBoard[r][c] !== 0;

        if (val !== 0) {
          this.ctx.font = `${isInitial ? '700' : '600'} ${cs * 0.5}px Inter, sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';

          if (this.conflicts[r][c]) {
            this.ctx.fillStyle = '#fca5a5';
          } else if (isInitial) {
            this.ctx.fillStyle = '#f8fafc';
          } else {
            this.ctx.fillStyle = '#818cf8';
          }

          this.ctx.fillText(val, x + cs / 2, y + cs / 2 + 2);
        } else {
          const cellNotes = this.notes[r][c];
          if (cellNotes && cellNotes.size > 0) {
            this.ctx.font = `500 ${cs * 0.22}px Inter, sans-serif`;
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            const subCs = cs / 3;
            for (let note = 1; note <= 9; note++) {
              if (cellNotes.has(note)) {
                const nr = Math.floor((note - 1) / 3);
                const nc = (note - 1) % 3;
                const nx = x + nc * subCs + subCs / 2;
                const ny = y + nr * subCs + subCs / 2;
                this.ctx.fillText(note, nx, ny);
              }
            }
          }
        }
      }
    }
  }

  checkWinCondition() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 || this.conflicts[r][c]) return false;
      }
    }

    this.isVictory = true;
    this.stopTimer();
    this.clearGameState();

    this.vibrate([100, 50, 100, 50, 200, 50, 200, 50, 400]);

    document.getElementById('victoryTime').textContent = `Your time: ${this.formatTime(this.secondsElapsed)}`;
    document.getElementById('victoryOverlay').classList.remove('hidden');
    return true;
  }

  setupEventListeners() {
    const handleCanvasPointer = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const col = Math.floor(x / (rect.width / 9));
      const row = Math.floor(y / (rect.height / 9));

      if (row >= 0 && row < 9 && col >= 0 && col < 9) {
        this.selectedCell = {row, col};
        // Clear any number highlight when user selects a cell
        this.highlightNumber = null;
        this.vibrate(8);
        this.render();
      }
    };

    this.canvas.addEventListener('mousedown', handleCanvasPointer);
    this.canvas.addEventListener('touchstart', handleCanvasPointer, {passive: false});

    document.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = parseInt(btn.getAttribute('data-key'));
        this.handleNumberButton(key);
      });
    });

    document.getElementById('eraseBtn').addEventListener('click', () => this.handleCellInput(0));
    document.getElementById('undoBtn').addEventListener('click', () => this.undo());

    const noteBtn = document.getElementById('noteToggleBtn');
    const noteStatus = document.getElementById('noteStatusText');
    noteBtn.addEventListener('click', () => {
      this.isNoteMode = !this.isNoteMode;
      noteStatus.textContent = this.isNoteMode ? 'ON' : 'OFF';

      if (this.isNoteMode) {
        noteBtn.classList.add('active-note');
        noteStatus.className = 'badge-note active';
      } else {
        noteBtn.classList.remove('active-note');
        noteStatus.className = 'badge-note';
      }

      this.showToast(this.isNoteMode ? 'Pencil Note Mode ON' : 'Normal Entry Mode ON');
    });

    document.addEventListener('keydown', (e) => {
      if (this.isPaused || this.isVictory) return;

      if (e.key >= '1' && e.key <= '9') {
        this.handleCellInput(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        this.handleCellInput(0);
      } else if (e.key.toLowerCase() === 'n') {
        noteBtn.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      } else if (this.selectedCell) {
        let {row, col} = this.selectedCell;
        const prevRow = row;
        const prevCol = col;
        if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
        if (e.key === 'ArrowDown') row = Math.min(8, row + 1);
        if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
        if (e.key === 'ArrowRight') col = Math.min(8, col + 1);
        
        if (row !== prevRow || col !== prevCol) {
          this.selectedCell = {row, col};
          this.vibrate(8);
          this.render();
        }
      }
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
      const diff = document.getElementById('difficultySelect').value;
      this.startNewGame(diff);
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetBoard();
    });

    document.getElementById('victoryNewGameBtn').addEventListener('click', () => {
      const diff = document.getElementById('difficultySelect').value;
      this.startNewGame(diff);
    });

    const pauseOverlay = document.getElementById('pauseOverlay');
    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.isPaused = true;
      this.stopTimer();
      pauseOverlay.classList.remove('hidden');
    });

    document.getElementById('resumeBtn').addEventListener('click', () => {
      this.isPaused = false;
      this.startTimer();
      pauseOverlay.classList.add('hidden');
    });
  }

  // When number button clicked without cell selected, toggle highlight; otherwise place number
  handleNumberButton(key) {
    if (this.selectedCell) {
      this.handleCellInput(key);
      // after placing, clear highlight (if any)
      this.highlightNumber = null;
      return;
    }

    if (this.highlightNumber === key) {
      this.highlightNumber = null;
      this.showToast(`Highlight cleared`);
    } else {
      this.highlightNumber = key;
      this.showToast(`Highlighting ${key}`);
    }
    this.render();
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isVictory) {
        this.secondsElapsed++;
        document.getElementById('timerDisplay').textContent = this.formatTime(this.secondsElapsed);
        if (this.secondsElapsed % 10 === 0) {
          this.saveGameState();
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2200);
    }
  }
}
