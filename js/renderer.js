export function renderCanvas(gameInstance) {
  const canvas = gameInstance.canvas;
  const ctx = gameInstance.ctx;
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  const cs = gameInstance.cellSize;

  ctx.clearRect(0, 0, width, height);

  const selectedVal = gameInstance.selectedCell
    ? gameInstance.currentBoard[gameInstance.selectedCell.row][gameInstance.selectedCell.col]
    : null;

  const activeHighlight = gameInstance.highlightNumber;
  let highlightMask = Array(9)
    .fill(null)
    .map(() => Array(9).fill(false));

  if (activeHighlight !== null && activeHighlight !== 0) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (gameInstance.currentBoard[r][c] === activeHighlight) {
          // Highlight the row, column, and box of each matching number
          for (let i = 0; i < 9; i++) {
            highlightMask[r][i] = true; // Row
            highlightMask[i][c] = true; // Column
          }
          const boxR = Math.floor(r / 3) * 3;
          const boxC = Math.floor(c / 3) * 3;
          for (let br = boxR; br < boxR + 3; br++) {
            for (let bc = boxC; bc < boxC + 3; bc++) {
              highlightMask[br][bc] = true; // Box
            }
          }
        }
      }
    }
  }

  // --- RENDERING PHASE ---
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const x = c * cs;
      const y = r * cs;

      let bgColor = "#0f172a";

      // 1. Highlight matches (including their rows/cols/boxes)
      if (
        activeHighlight !== null &&
        activeHighlight !== 0 &&
        highlightMask[r][c]
      ) {
        bgColor = "#1e293b"; // Light grey for rows/cols/boxes of matching numbers
      }

      // 2. Selected Cell/Group Highlighting
      if (gameInstance.selectedCell) {
        const { row: selR, col: selC } = gameInstance.selectedCell;
        const sameBox =
          Math.floor(r / 3) === Math.floor(selR / 3) &&
          Math.floor(c / 3) === Math.floor(selC / 3);
        
        // Highlight focused row/col/box
        if (r === selR || c === selC || sameBox) {
          bgColor = "#1e293b";
        }
        
        // Highlight specific cells matching the selected cell's value
        const val = gameInstance.currentBoard[r][c];
        if (selectedVal !== 0 && val === selectedVal) {
          bgColor = "#312e81"; // Dark purple for matches
        }
        
        // Highlight the strictly selected cell
        if (r === selR && c === selC) {
          bgColor = "#3730a3"; // Brighter purple for selected cell
        }
      }

      // 3. Highlight all occurrences of the focused number (from highlightNumber)
      if (activeHighlight !== null && activeHighlight !== 0 && gameInstance.currentBoard[r][c] === activeHighlight) {
          bgColor = "#312e81"; // Dark purple for matches of the focused number
      }

      // 3. Error state
      if (gameInstance.conflicts[r][c]) {
        bgColor = "#7f1d1d";
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, cs, cs);
    }
  }

  // Draw Grid Lines
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath();
    ctx.lineWidth = i % 3 === 0 ? 3 : 1;
    ctx.strokeStyle = i % 3 === 0 ? "#475569" : "#334155";

    ctx.moveTo(i * cs, 0);
    ctx.lineTo(i * cs, height);

    ctx.moveTo(0, i * cs);
    ctx.lineTo(width, i * cs);
    ctx.stroke();
  }

  // Draw Numbers and Notes
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const x = c * cs;
      const y = r * cs;
      const val = gameInstance.currentBoard[r][c];
      const isInitial = gameInstance.initialBoard[r][c] !== 0;

      if (val !== 0) {
        ctx.font = `${isInitial ? "700" : "600"} ${cs * 0.5}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (gameInstance.conflicts[r][c]) {
          ctx.fillStyle = "#fca5a5";
        } else if (isInitial) {
          ctx.fillStyle = "#f8fafc";
        } else {
          ctx.fillStyle = "#818cf8";
        }

        ctx.fillText(val, x + cs / 2, y + cs / 2 + 2);
      } else {
        const cellNotes = gameInstance.notes[r][c];
        if (cellNotes && cellNotes.size > 0) {
          ctx.font = `500 ${cs * 0.22}px Inter, sans-serif`;
          ctx.fillStyle = "#94a3b8";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const subCs = cs / 3;
          for (let note = 1; note <= 9; note++) {
            if (cellNotes.has(note)) {
              const nr = Math.floor((note - 1) / 3);
              const nc = (note - 1) % 3;
              const nx = x + nc * subCs + subCs / 2;
              const ny = y + nr * subCs + subCs / 2;
              ctx.fillText(note, nx, ny);
            }
          }
        }
      }
    }
  }
}
