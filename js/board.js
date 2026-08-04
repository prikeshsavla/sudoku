export function boardToString(board) {
  return board.flat().join("");
}

export function stringToBoard(str) {
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

export function isValidPlacement(board, row, col, num) {
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

export function getPeers(row, col) {
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
  return Array.from(peers).map((s) => {
    const [r, c] = s.split(",").map(Number);
    return { row: r, col: c };
  });
}
