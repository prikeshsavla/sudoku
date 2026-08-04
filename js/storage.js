import { STORAGE_KEY } from "./constants.js";

export function saveGameState(state) {
  try {
    const stateData = {
      initialBoard: state.initialBoard,
      currentBoard: state.currentBoard,
      solution: state.solution,
      notes: state.notes.map((row) =>
        row.map((cellSet) => Array.from(cellSet)),
      ),
      undoStack: state.undoStack.map((action) => ({
        ...action,
        prevNotes: Array.from(action.prevNotes || []),
        newNotes: Array.from(action.newNotes || []),
        clearedNotes: (action.clearedNotes || []).map((item) => ({
          row: item.row,
          col: item.col,
          prevNotes: Array.from(item.prevNotes || []),
          newNotes: Array.from(item.newNotes || []),
        })),
      })),
      secondsElapsed: state.secondsElapsed,
      difficulty: document.getElementById("difficultySelect").value,
      isVictory: state.isVictory,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateData));
  } catch (e) {
    console.warn("LocalStorage save failed:", e);
  }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    if (!data || !data.currentBoard || !data.initialBoard) return null;

    return {
      initialBoard: data.initialBoard,
      currentBoard: data.currentBoard,
      solution: data.solution || Array(9).fill(null).map(() => Array(9).fill(0)),
      notes: data.notes.map((row) => row.map((arr) => new Set(arr))),
      secondsElapsed: data.secondsElapsed || 0,
      isVictory: data.isVictory || false,
      difficulty: data.difficulty || "medium",
      undoStack: (data.undoStack || []).map((action) => ({
        ...action,
        prevNotes: new Set(action.prevNotes || []),
        newNotes: new Set(action.newNotes || []),
        clearedNotes: (action.clearedNotes || []).map((item) => ({
          row: item.row,
          col: item.col,
          prevNotes: new Set(item.prevNotes || []),
          newNotes: new Set(item.newNotes || []),
        })),
      })),
    };
  } catch (e) {
    console.error("Failed to load state from LocalStorage:", e);
    return null;
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("LocalStorage clear failed:", e);
  }
}
