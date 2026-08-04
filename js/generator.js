import { isValidPlacement } from "./board.js";
import { DIFFICULTIES } from "./constants.js";

export function fillBoard(board) {
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
    if (isValidPlacement(board, r, c, num)) {
      board[r][c] = num;
      if (fillBoard(board)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

export function generatePuzzle(difficulty = "medium") {
  const solution = Array(9)
    .fill(null)
    .map(() => Array(9).fill(0));
  fillBoard(solution);

  const initialBoard = solution.map((row) => [...row]);
  const removeCount = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;

  let removed = 0;
  while (removed < removeCount) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (initialBoard[r][c] !== 0) {
      initialBoard[r][c] = 0;
      removed++;
    }
  }

  return { initialBoard, solution };
}
