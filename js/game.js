import { boardToString, stringToBoard, isValidPlacement, getPeers } from "./board.js";
import { generatePuzzle } from "./generator.js";
import { saveGameState, loadGameState, clearGameState } from "./storage.js";
import { formatTime } from "./timer.js";
import { renderCanvas } from "./renderer.js";

export class SudokuCanvasGame {
  constructor() {
    this.canvas = document.getElementById("sudokuCanvas");
    this.ctx = this.canvas.getContext("2d");
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
    this.highlightNumber = null;

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.setupEventListeners();

    const saved = loadGameState();
    if (this.checkHashAndLoad()) {
      // Loaded from hash seed
    } else if (!saved) {
      this.startNewGame("medium");
    } else {
      this.initialBoard = saved.initialBoard;
      this.currentBoard = saved.currentBoard;
      this.solution = saved.solution;
      this.notes = saved.notes;
      this.secondsElapsed = saved.secondsElapsed;
      this.isVictory = saved.isVictory;
      this.undoStack = saved.undoStack;

      if (saved.difficulty) {
        const diffSelect = document.getElementById("difficultySelect");
        if (diffSelect) diffSelect.value = saved.difficulty;
      }

      this.updateConflicts();
      this.startTimer();
      this.updateUndoButton();
      this.render();
      this.showToast("Restored previous game state");
    }
  }

  vibrate(pattern) {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn("Vibration failed:", e);
      }
    }
  }

  boardToString(board) {
    return boardToString(board);
  }

  loadBoardFromString(boardStr, isImported = false) {
    this.isVictory = false;
    const victoryOverlay = document.getElementById("victoryOverlay");
    const pauseOverlay = document.getElementById("pauseOverlay");
    if (victoryOverlay) victoryOverlay.classList.add("hidden");
    if (pauseOverlay) pauseOverlay.classList.add("hidden");

    this.initialBoard = stringToBoard(boardStr);
    this.currentBoard = this.initialBoard.map((row) => [...row]);
    this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.undoStack = [];
    this.selectedCell = null;
    this.secondsElapsed = 0;

    this.updateConflicts();
    this.updateUndoButton();
    this.startTimer();
    this.saveState();
    this.render();
    this.showToast(
      isImported
        ? "Imported seed board successfully"
        : "Loaded board from shared link"
    );
  }

  checkHashAndLoad() {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#board=")) {
      const boardStr = hash.replace("#board=", "");
      if (boardStr.length === 81 && /^[0-9]+$/.test(boardStr)) {
        this.loadBoardFromString(boardStr);
        return true;
      } else {
        this.showToast("Invalid board link");
      }
    }
    return false;
  }

  saveState() {
    saveGameState(this);
  }

  resizeCanvas() {
    const container = document.getElementById("canvasContainer");
    if (!container) return;
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

  startNewGame(difficulty = "medium") {
    this.isVictory = false;
    const victoryOverlay = document.getElementById("victoryOverlay");
    const pauseOverlay = document.getElementById("pauseOverlay");
    if (victoryOverlay) victoryOverlay.classList.add("hidden");
    if (pauseOverlay) pauseOverlay.classList.add("hidden");

    const puzzle = generatePuzzle(difficulty);
    this.solution = puzzle.solution;
    this.initialBoard = puzzle.initialBoard;
    this.currentBoard = this.initialBoard.map((row) => [...row]);
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.undoStack = [];
    this.selectedCell = null;
    this.secondsElapsed = 0;

    this.updateConflicts();
    this.updateUndoButton();
    this.startTimer();
    this.saveState();
    this.render();
    this.showToast(`New ${difficulty.toUpperCase()} game started`);
  }

  updateConflicts() {
    this.conflicts = Array(9).fill(null).map(() => Array(9).fill(false));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentBoard[r][c];
        if (val !== 0) {
          if (!isValidPlacement(this.currentBoard, r, c, val)) {
            this.conflicts[r][c] = true;
          }
        }
      }
    }
  }

  handleCellInput(num) {
    if (!this.selectedCell || this.isVictory || this.isPaused) return;
    const { row, col } = this.selectedCell;

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
      if (prevVal !== newVal || [...prevNotes].join(",") !== [...newNotes].join(",")) {
        this.undoStack.push({ row, col, prevVal, newVal, prevNotes, newNotes });
        this.updateUndoButton();
      }
    } else {
      if (num === 0 || prevVal === num) {
        this.currentBoard[row][col] = 0;
        const newNotesEmpty = new Set(this.notes[row][col]);
        const newValEmpty = this.currentBoard[row][col];
        if (prevVal !== newValEmpty || [...prevNotes].join(",") !== [...newNotesEmpty].join(",")) {
          this.undoStack.push({
            row,
            col,
            prevVal,
            newVal: newValEmpty,
            prevNotes,
            newNotes: newNotesEmpty,
          });
          this.updateUndoButton();
        }
      } else {
        const isPlacementValid = isValidPlacement(this.currentBoard, row, col, num);

        this.currentBoard[row][col] = num;
        const clearedNotes = [];
        if (isPlacementValid) {
          const peers = getPeers(row, col);
          peers.forEach((p) => {
            if (this.notes[p.row][p.col].has(num)) {
              const prev = new Set(this.notes[p.row][p.col]);
              this.notes[p.row][p.col].delete(num);
              const after = new Set(this.notes[p.row][p.col]);
              clearedNotes.push({
                row: p.row,
                col: p.col,
                prevNotes: prev,
                newNotes: after,
              });
            }
          });
        }

        const newNotesForCell = new Set(this.notes[row][col]);
        const newValForCell = this.currentBoard[row][col];
        this.undoStack.push({
          row,
          col,
          prevVal,
          newVal: newValForCell,
          prevNotes,
          newNotes: newNotesForCell,
          clearedNotes,
        });
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
    
    // Auto-update highlight if we just filled a cell
    if (num !== 0 && this.selectedCell) {
        this.highlightNumber = num;
    }

    this.saveState();
    this.render();
  }

  resetBoard() {
    if (this.isVictory || this.isPaused) return;

    this.currentBoard = this.initialBoard.map((row) => [...row]);
    this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
    this.undoStack = [];
    this.selectedCell = null;

    this.updateConflicts();
    this.updateUndoButton();
    this.saveState();
    this.render();
    this.showToast("Puzzle reset to initial state");
  }

  undo() {
    if (this.undoStack.length === 0 || this.isVictory || this.isPaused) return;

    const action = this.undoStack.pop();

    if (Array.isArray(action.clearedNotes)) {
      action.clearedNotes.forEach((item) => {
        this.notes[item.row][item.col] = new Set(item.prevNotes || []);
      });
    }

    const { row, col, prevVal, prevNotes } = action;

    this.currentBoard[row][col] = prevVal;
    this.notes[row][col] = new Set(prevNotes);

    this.selectedCell = { row, col };
    this.updateConflicts();
    this.updateUndoButton();
    this.saveState();
    this.render();
    this.showToast("Move undone");
  }

  updateUndoButton() {
    const undoBtn = document.getElementById("undoBtn");
    if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
  }

  render() {
    renderCanvas(this);
  }

  checkWinCondition() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0 || this.conflicts[r][c]) return false;
      }
    }

    this.isVictory = true;
    this.stopTimer();
    clearGameState();

    this.vibrate([100, 50, 100, 50, 200, 50, 200, 50, 400]);

    const victoryTime = document.getElementById("victoryTime");
    const victoryOverlay = document.getElementById("victoryOverlay");
    if (victoryTime) victoryTime.textContent = `Your time: ${formatTime(this.secondsElapsed)}`;
    if (victoryOverlay) victoryOverlay.classList.remove("hidden");
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
        this.selectedCell = { row, col };
        const cellValue = this.currentBoard[row][col];
        // Automatically set highlightNumber if tapping a filled cell
        if (cellValue !== 0) {
          this.highlightNumber = cellValue;
        } else {
          this.highlightNumber = null;
        }
        this.vibrate(8);
        this.render();
      }
    };

    this.canvas.addEventListener("mousedown", handleCanvasPointer);
    this.canvas.addEventListener("touchstart", handleCanvasPointer, { passive: false });

    document.querySelectorAll(".num-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = parseInt(btn.getAttribute("data-key"));
        this.handleNumberButton(key);
      });
    });

    const eraseBtn = document.getElementById("eraseBtn");
    const undoBtn = document.getElementById("undoBtn");
    if (eraseBtn) eraseBtn.addEventListener("click", () => this.handleCellInput(0));
    if (undoBtn) undoBtn.addEventListener("click", () => this.undo());

    const noteBtn = document.getElementById("noteToggleBtn");
    const noteStatus = document.getElementById("noteStatusText");
    if (noteBtn && noteStatus) {
      noteBtn.addEventListener("click", () => {
        this.isNoteMode = !this.isNoteMode;
        noteStatus.textContent = this.isNoteMode ? "ON" : "OFF";

        if (this.isNoteMode) {
          noteBtn.classList.add("active-note");
          noteStatus.className = "badge-note active";
        } else {
          noteBtn.classList.remove("active-note");
          noteStatus.className = "badge-note";
        }

        this.showToast(this.isNoteMode ? "Pencil Note Mode ON" : "Normal Entry Mode ON");
      });
    }

    document.addEventListener("keydown", (e) => {
      if (this.isPaused || this.isVictory) return;

      if (e.key >= "1" && e.key <= "9") {
        this.handleCellInput(parseInt(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        this.handleCellInput(0);
      } else if (e.key.toLowerCase() === "n") {
        if (noteBtn) noteBtn.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.undo();
      } else if (this.selectedCell) {
        let { row, col } = this.selectedCell;
        const prevRow = row;
        const prevCol = col;
        if (e.key === "ArrowUp") row = Math.max(0, row - 1);
        if (e.key === "ArrowDown") row = Math.min(8, row + 1);
        if (e.key === "ArrowLeft") col = Math.max(0, col - 1);
        if (e.key === "ArrowRight") col = Math.min(8, col + 1);

        if (row !== prevRow || col !== prevCol) {
          this.selectedCell = { row, col };
          this.vibrate(8);
          this.render();
        }
      }
    });

    const newGameBtn = document.getElementById("newGameBtn");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", () => {
        const diff = document.getElementById("difficultySelect").value;
        this.startNewGame(diff);
      });
    }

    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetBoard());
    }

    const victoryNewGameBtn = document.getElementById("victoryNewGameBtn");
    if (victoryNewGameBtn) {
      victoryNewGameBtn.addEventListener("click", () => {
        const diff = document.getElementById("difficultySelect").value;
        this.startNewGame(diff);
      });
    }

    const pauseOverlay = document.getElementById("pauseOverlay");
    const pauseBtn = document.getElementById("pauseBtn");
    const resumeBtn = document.getElementById("resumeBtn");

    if (pauseBtn && pauseOverlay) {
      pauseBtn.addEventListener("click", () => {
        this.isPaused = true;
        this.stopTimer();
        pauseOverlay.classList.remove("hidden");
      });
    }

    if (resumeBtn && pauseOverlay) {
      resumeBtn.addEventListener("click", () => {
        this.isPaused = false;
        this.startTimer();
        pauseOverlay.classList.add("hidden");
      });
    }
  }

  handleNumberButton(key) {
    if (this.selectedCell) {
      this.handleCellInput(key);
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
        const timerDisplay = document.getElementById("timerDisplay");
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(this.secondsElapsed);
        }
        if (this.secondsElapsed % 10 === 0) {
          this.saveState();
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

  showToast(msg) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2200);
    }
  }
}
