import * as React from "react";
import { render } from "react-dom";

import cloneDeep from "lodash-es/cloneDeep";
import maxBy from "lodash-es/maxBy";
import range from "lodash-es/range";

enum CellStatus {
  Unopened = 0,
  Blocked,
  Empty,
  Large,
  Medium,
}

interface GridState {
  grid: CellStatus[][];
}

interface GridProps {

}

class Grid extends React.Component<GridProps, GridState> {
  constructor(props: GridProps) {
    super(props);
    this.state = {
      grid: [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 1],
  [0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0],
],
    };
  }

  toggleCellBlocked = (coords: Coordinates) => {
    this.setState((state) => {
      let newState = cloneDeep(state);
      if (newState.grid[coords.y][coords.x] == CellStatus.Blocked) {
        newState.grid[coords.y][coords.x] = CellStatus.Unopened;
      } else {
        newState.grid[coords.y][coords.x] = CellStatus.Blocked;
      }
      return newState;
    });
  }

  toggleCellOpened = (coords: Coordinates) => {
    this.setState((state) => {
      let newState = cloneDeep(state);
      if (newState.grid[coords.y][coords.x] == CellStatus.Empty) {
        newState.grid[coords.y][coords.x] = CellStatus.Large;
      } else if (newState.grid[coords.y][coords.x] == CellStatus.Large) {
        newState.grid[coords.y][coords.x] = CellStatus.Medium;
      } else if (newState.grid[coords.y][coords.x] == CellStatus.Medium) {
        newState.grid[coords.y][coords.x] = CellStatus.Unopened;
      } else {
        newState.grid[coords.y][coords.x] = CellStatus.Empty;
      }
      return newState;
    });
  }

  render() {
    const targetCoordinates = SolveGrid(this.state.grid);

    const wrapperStyle = {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gridTemplateRows: 'repeat(6, 1fr)',
      width: '385px',
      height: '385px',
      gridGap: '5px',
      padding: '10px',
      border: '2px ridge rgb(108, 103, 85)',
      backgroundColor: 'rgb(49, 32, 17)',
    }

    return (
      <div style={wrapperStyle}>{
        range(36).map(v => {
          const coords = convertToCoordinates(v, false);
          const gridSquareProps = {
            coordinates: coords,
            cellStatus: this.state.grid[coords.y][coords.x],
            isTarget: targetCoordinates.x == coords.x && targetCoordinates.y == coords.y,
            leftClickHandler: (e: React.MouseEvent) => {e.preventDefault(); this.toggleCellOpened(coords)},
            rightClickHandler: (e: React.MouseEvent) => {e.preventDefault(); this.toggleCellBlocked(coords)},
          }
          return <GridSquare {...gridSquareProps} key={`grid-${coords.x}-${coords.y}`}/>
        })
      }</div>
    );
  }
}

interface GridSquareProps {
  coordinates: Coordinates;
  cellStatus: CellStatus;
  isTarget: boolean;
  leftClickHandler: (e: React.MouseEvent) => void;
  rightClickHandler: (e: React.MouseEvent) => void;
}

const GridSquare = (props: GridSquareProps) => {
  const colors = {
    [CellStatus.Unopened]: 'rgb(76, 53, 50)',
    [CellStatus.Blocked]: 'rgb(107, 93, 75)',
    [CellStatus.Empty]: 'rgb(198, 173, 143)',
    [CellStatus.Large]: 'rgb(121, 141, 159)',
    [CellStatus.Medium]: 'rgb(107, 118, 79)',
  }

  const style = {
    backgroundColor: colors[props.cellStatus],
    border: props.isTarget? '2px dashed red' : '1px solid rgb(108, 103, 85)',
    gridColumn: props.coordinates.x + 1,
    gridRow: props.coordinates.y + 1,
    borderRadius: '5px',
  }

  return (
    <div style={style} onClick={props.leftClickHandler} onContextMenu={props.rightClickHandler}>
    </div>
  );
}

interface Coordinates {
  x: number;
  y: number;
}

const SolveGrid = (fullGrid: CellStatus[][]) => {
  /*
   Compute some statistics about the grid:
   # of squares marked as Large
   # of squares marked as Medium
   # of squares marked as Empty
   # of remaining attempts after opening the Large
   These will be used to determine solver mode as follows:
   If Large is unfound, solver mode is default
     In this mode, the comparison metric will be the # of 2x3s remaining when removing 3 test squares from grid
     and tiebreak metric is weighted 2x3s (and 2x2s, if # remaining attempts is at least 9 and medium is unfound) remaining
   If Large is found, but Medium is unfound, and # remaining attempts is at least 4 after accounting for finishing the Large, solver mode is med-find
     In this mode, the comparison metric will be the # of 2x2s remaining when removing #attempts test squares from grid
   In any other case, solver mode is small-find
     In this mode, the comparison metric will be the sum of # 2x3s and # 2x2s remaining when removing a test square from the grid
   */

  var largeSquares = 0;
  var mediumSquares = 0;
  var emptySquares = 0;

  fullGrid.map(row => row.map(cellStatus => {
    if (cellStatus == CellStatus.Large) {
      largeSquares += 1;
    } else if (cellStatus == CellStatus.Medium) {
      mediumSquares += 1;
    } else if (cellStatus == CellStatus.Empty) {
      emptySquares += 1;
    }
  }));

  const remainingAttemptsAfterLargeOpen = 5 - emptySquares;

  if (largeSquares == 0) {
    // If no attempts are burned on Empty, we should check mediums up to depth 3
    // If 1 attempt is burned, we should check mediums up to depth 2
    // etc.
    const medDepth = (mediumSquares == 0) ? Math.max(remainingAttemptsAfterLargeOpen - 2, 0) : 0;
    return solveGridDefault(convertGrid(fullGrid), medDepth);
  } else if (mediumSquares == 0 && remainingAttemptsAfterLargeOpen >= 4) {
    // med-find solve
    return solveGridMedFind(convertGrid(fullGrid), remainingAttemptsAfterLargeOpen - 3);
  } else {
    // small-find solve
    return solveGridSmallFind(convertGrid(fullGrid));
  }
}

const solveGridDefault = (grid: boolean[][], medDepth: number = 0) => {
  // Compute the coordinates of all open 2x3 and 3x2 rectangles as-is.
  const openWideCoordSet = getOpenCoordinates(3, 2, grid);
  const openTallCoordSet = getOpenCoordinates(2, 3, grid);

  // Compute tiebreaker - number of 2x2s covered.
  const openMedCoordSet = getOpenCoordinates(2, 2, grid);

  // hardcoded lul
  // depth 3 brute force of the middle 4x4
  let bestRemaining = openWideCoordSet.length + openTallCoordSet.length + 1;
  let bestTiebreaker = Number.MAX_SAFE_INTEGER;
  let bestIndices: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 16; i++) {
    const ci = convertToCoordinates(i, true);
    if (grid[ci.y][ci.x]) {
      continue;
    }
    // Create a grid copy with only the first square set
    let filledGrid1 = cloneDeep(grid);
    filledGrid1[ci.y][ci.x] = true;
    const remainingWideOpen1 = getOpenCoordinates(3, 2, filledGrid1, openWideCoordSet).length;
    const remainingTallOpen1 = getOpenCoordinates(2, 3, filledGrid1, openTallCoordSet).length;
    const remainingMedOpen1 = getOpenCoordinates(2, 2, filledGrid1, openMedCoordSet).length;

    for (let j = 0; j < 16; j++) {
      if (j == i) { continue; }
      const cj = convertToCoordinates(j, true);
      if (grid[cj.y][cj.x]) {
        continue;
      }
      // Create a grid copy with the first and second squares set
      let filledGrid2 = cloneDeep(filledGrid1);
      filledGrid2[cj.y][cj.x] = true;
      const remainingWideOpen2 = getOpenCoordinates(3, 2, filledGrid2, openWideCoordSet).length;
      const remainingTallOpen2 = getOpenCoordinates(2, 3, filledGrid2, openTallCoordSet).length;
      const remainingMedOpen2 = getOpenCoordinates(2, 2, filledGrid2, openMedCoordSet).length;

      for (let k = 0; k < 16; k++) {
        if (k == i || k == j) { continue; }

        const ck = convertToCoordinates(k, true);
        if (grid[ck.y][ck.x]) {
          continue;
        }
        // Create a grid copy with all three squares set
        let filledGrid3 = cloneDeep(filledGrid2);
        filledGrid3[ck.y][ck.x] = true;
        const remainingWideOpen3 = getOpenCoordinates(3, 2, filledGrid3, openWideCoordSet).length;
        const remainingTallOpen3 = getOpenCoordinates(2, 3, filledGrid3, openTallCoordSet).length;
        const remainingMedOpen3 = getOpenCoordinates(2, 2, filledGrid3, openMedCoordSet).length;

        const remaining = remainingWideOpen3 + remainingTallOpen3;
        const tiebreaker = remainingWideOpen1 + remainingTallOpen1 + (medDepth >= 1 ? remainingMedOpen1 : 0)
          + remainingWideOpen2 + remainingTallOpen2 + (medDepth >= 2 ? remainingMedOpen2 : 0)
          + remainingWideOpen3 + remainingTallOpen3 + (medDepth >= 3 ? remainingMedOpen3 : 0)

        if ((remaining < bestRemaining) || (remaining == bestRemaining && tiebreaker < bestTiebreaker)) {
          console.log(remaining);
          console.log(tiebreaker);
          bestRemaining = remaining;
          bestTiebreaker = tiebreaker;
          bestIndices = [i, j, k];
        }
      }
    }
  }

  console.log(bestIndices);
  return convertToCoordinates(bestIndices[0], true);
}

// depth must always be 1 or 2
const solveGridMedFind = (grid: boolean[][], depth: number = 1) => {
  // Compute tiebreaker number of 2x2s covered as-is.
  const openCoordSet = getOpenCoordinates(2, 2, grid);

  // Branched based on depth.
  if (depth == 1) {
    let bestRemaining = openCoordSet.length + 1;
    let bestIndex: number = 0;
    for (let i = 0; i < 16; i++) {
      const ci = convertToCoordinates(i, true);
      if (grid[ci.y][ci.x]) {
        continue;
      }
      // Create a grid copy with only the first square set
      let filledGrid1 = cloneDeep(grid);
      filledGrid1[ci.y][ci.x] = true;
      const remainingOpen = getOpenCoordinates(2, 2, filledGrid1, openCoordSet).length;

      if (remainingOpen < bestRemaining) {
        console.log(remainingOpen);
        bestRemaining = remainingOpen;
        bestIndex = i;
      }
    }

    console.log(bestIndex);
    return convertToCoordinates(bestIndex, true);
  } else {
    let bestRemaining = openCoordSet.length + 1;
    let bestTiebreaker = Number.MAX_SAFE_INTEGER;
    let bestIndices: [number, number] = [0, 0];
    for (let i = 0; i < 16; i++) {
      const ci = convertToCoordinates(i, true);
      if (grid[ci.y][ci.x]) {
        continue;
      }
      // Create a grid copy with only the first square set
      let filledGrid1 = cloneDeep(grid);
      filledGrid1[ci.y][ci.x] = true;
      const remainingOpen1 = getOpenCoordinates(2, 2, filledGrid1, openCoordSet).length;

      for (let j = 0; j < 16; j++) {
        if (j == i) { continue; }
        const cj = convertToCoordinates(j, true);
        if (grid[cj.y][cj.x]) {
          continue;
        }
        // Create a grid copy with the first and second squares set
        let filledGrid2 = cloneDeep(filledGrid1);
        filledGrid2[cj.y][cj.x] = true;
        const remainingOpen2 = getOpenCoordinates(2, 2, filledGrid2, openCoordSet).length;

        const remaining = remainingOpen1 + remainingOpen2;
        const tiebreaker = remainingOpen1;

        if ((remaining < bestRemaining) || (remaining == bestRemaining && tiebreaker < bestTiebreaker)) {
          console.log(remaining);
          console.log(tiebreaker);
          bestRemaining = remaining;
          bestTiebreaker = tiebreaker;
          bestIndices = [i, j];
        }
      }
    }

    console.log(bestIndices);
    return convertToCoordinates(bestIndices[0], true);
  }
}

const solveGridSmallFind = (grid: boolean[][]) => {
  // This mode assumes that the large is already found and marked.
  // Compute the coordinates of all open 2x2 rectangles as-is.
  const openCoordSet = getOpenCoordinates(2, 2, grid);

  let bestRemaining = 0; // In this solver mode, higher is better (since we want to hide from the med)
  let bestIndex: number = 0;
  // Unlike in other solver modes, we can (and probably should) select outer cells.
  for (let i = 0; i < 36; i++) {
    const ci = convertToCoordinates(i, false);
    if (grid[ci.y][ci.x]) {
      continue;
    }
    // Create a grid copy with only the first square set
    let filledGrid1 = cloneDeep(grid);
    filledGrid1[ci.y][ci.x] = true;
    const remainingOpen = getOpenCoordinates(2, 2, filledGrid1, openCoordSet).length;

    if (remainingOpen > bestRemaining) {
      console.log(remainingOpen);
      bestRemaining = remainingOpen;
      bestIndex = i;
    }
  }

  console.log(bestIndex);
  return convertToCoordinates(bestIndex, false);
}

// Grid input is True for blocked squares, False for non-blocked squares
// Returns a set of coordinate pairs which correspond to the upper right of rectangles that are fully available.
const getOpenCoordinates = (width: number, height: number, grid: boolean[][], coordSet?: Coordinates[]) => {
  const gridWidth = grid[0].length;
  const gridHeight = grid.length;
  if (!coordSet) {
    const yRange = range(gridHeight - height + 1);
    const xRange = range(gridWidth - width + 1);
    coordSet = xRange.flatMap(x => yRange.map(y => ({x, y} as Coordinates)));
  }

  // coords go [y, x]
  // i hate everything
  return coordSet.filter(coords => checkRectangleOpen(width, height, grid, coords));
}

// Check whether an entire rectangle is open on the grid.
const checkRectangleOpen = (width: number, height: number, grid: boolean[][], upperLeft: Coordinates) => {
  for (let x = upperLeft.x; x < upperLeft.x + width; x++) {
    for (let y = upperLeft.y; y < upperLeft.y + height; y++) {
      if (grid[x][y]) {
        return false;
      }
    }
  }
  return true;
}

// Convert a number (0-15) to x,y coordinates of a square in the center 4x4.
const convertToCoordinates = (openSquareIndex: number, pad: boolean) => {
  return {
    x: (openSquareIndex % (pad ? 4 : 6)) + (pad ? 1 : 0),
    y: Math.floor(openSquareIndex / (pad ? 4 : 6)) + (pad ? 1 : 0),
  } as Coordinates;
}

const convertGrid = (grid: CellStatus[][]) => {
  return grid.map(row => row.map(cellStatus => cellStatus != CellStatus.Unopened));
}

render(
  <>
  <div style={{fontFamily: 'Roboto'}}>
    <h2>
      Instructions
    </h2>
    Left click to cycle between opened square types: unopened - empty (beige) - large (blue) - medium (green)
    <br />
    Right click to toggle whether a cell is blocked off.
    <br />
    It's highly recommended that, on your first attempt of the week, you fully open the large picture as soon as you see it.
    Marking the full large picture on the solver will improve its recommendations.
  </div>
  <br />
  <Grid />
  </>,
  document.getElementById("root"),
);
