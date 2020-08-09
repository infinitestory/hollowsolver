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

interface SolverOptions {
  attempt: number;
}

interface GridState {
  grid: CellStatus[][];
  solverOptions: SolverOptions;
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
      solverOptions: {
        attempt: 1,
      },
    };
  }

  onReset = () => {
    this.setState({
      grid: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
    })
  }

  onChangeAttempt = (event: React.ChangeEvent) => {
    event.preventDefault();
    this.setState({
      solverOptions: {
        attempt: Number((event.target as any).value)
      }
    });
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
    const targetCoordinates = SolveGrid(this.state.grid, this.state.solverOptions);

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
      <>
      <div>
        Attempt number:
        <select value={this.state.solverOptions.attempt} onChange={this.onChangeAttempt}>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
        <button style={{marginLeft: '20px'}} type="button" onClick={this.onReset}>
          Reset grid
        </button>
      </div>
      <br />
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
      </>
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

const SolveGrid = (fullGrid: CellStatus[][], solverOptions: SolverOptions) => {
  /*
   Compute some statistics about the grid:
   # of squares marked as Large
   # of squares marked as Medium
   # of squares marked as Empty
   # of remaining attempts after opening the Large
   These will be used to determine solver mode as follows:
   Attempt #1 (prioritize Large):
     If Large is unfound, solver mode is default
       In this mode, the comparison metric is the # of 2x3s remaining when removing 3 test squares from grid
       and tiebreak metric is weighted 2x3s (and 2x2s, if # remaining attempts is at least 9 and medium is unfound) remaining
     If Large is found, but Medium is unfound, and # remaining attempts is at least 4 after accounting for finishing the Large, solver mode is med-find
       In this mode, the comparison metric is the # of 2x2s remaining when removing #attempts test squares from grid
     In any other case, solver mode is small-find
       In this mode, the comparison metric is the sum of # 2x3s and # 2x2s remaining when removing a test square from the grid
   Attempt #2 (prioritize Medium):
     If Medium is unfound, solver mode is weighted-med-find
       In this mode, the comparison metric will be the weighted # of 2x2s (and 2x3s, if # remaining attempts is at least 9 and large is unfound) remaining when removing 3 test squares from grid
     If Medium is found, but Large is unfound, and # remaining attempts is at least 4 after accounting for finishing the Medium, solver mode is large-find
       In this mode, the comparison metric is # of 2x3s remaining when removing #attempts test squares from grid
     In any other case, solver mode is small-find
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

  const remainingAttempts = 11 - largeSquares - mediumSquares - emptySquares;
  if (solverOptions.attempt == 1) {
    const remainingAttemptsAfterLargeOpen = 5 - emptySquares;

    if (largeSquares == 0 && remainingAttempts >= 6) {
      // If no attempts are burned on Empty, we should check mediums up to depth 3
      // If 1 attempt is burned, we should check mediums up to depth 2
      // etc.
      const medDepth = (mediumSquares == 0) ? Math.max(remainingAttemptsAfterLargeOpen - 2, 0) : 0;
      console.log('solver mode: default');
      return solveGridDefault(convertGrid(fullGrid), medDepth);
    } else if (mediumSquares == 0 && remainingAttemptsAfterLargeOpen >= 4) {
      // med-find solve
      console.log('solver mode: med-find');
      return solveGridMedFind(convertGrid(fullGrid), remainingAttemptsAfterLargeOpen - 3);
    } else {
      // small-find solve
      console.log('solver mode: small-find');
      return solveGridSmallFind(convertGrid(fullGrid), mediumSquares != 0, largeSquares != 0);
    }
  } else {
    const remainingAttemptsAfterMediumOpen = 7 - emptySquares;

    if (mediumSquares == 0 && remainingAttempts >= 4) {
      // If no attempts are burned on Empty, we should check large up to depth 3
      // If 1 attempt is burned, we should check large up to depth 2
      // etc.
      const largeDepth = (mediumSquares == 0) ? Math.max(remainingAttemptsAfterMediumOpen - 4, 0) : 0;
      console.log('solver mode: weighted-med-find');
      return solveGridWeightedMedFind(convertGrid(fullGrid), largeDepth);
    } else if (largeSquares == 0 && remainingAttemptsAfterMediumOpen >= 6) {
      // large-find solve
      console.log('solver mode: large-find');
      return solveGridLargeFind(convertGrid(fullGrid), remainingAttemptsAfterMediumOpen - 5);
    } else {
      // small-find solve
      console.log('solver mode: small-find');
      return solveGridSmallFind(convertGrid(fullGrid), mediumSquares != 0, largeSquares != 0);
    }
  }
}

const solveGridDefault = (grid: boolean[][], medDepth: number = 0) => {
  // Compute the coordinates of all open 2x3 and 3x2 rectangles as-is.
  const openWideCoordSet = getOpenCoordinates(3, 2, grid);
  const openTallCoordSet = getOpenCoordinates(2, 3, grid);

  // Compute for tiebreaker - number of 2x2s covered.
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
    const remainingLargeOpen1 = remainingWideOpen1 + remainingTallOpen1;
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
      const remainingLargeOpen2 = remainingWideOpen2 + remainingTallOpen2;
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
        const remainingLargeOpen3 = remainingWideOpen3 + remainingTallOpen3;
        const remainingMedOpen3 = getOpenCoordinates(2, 2, filledGrid3, openMedCoordSet).length;

        const tiebreaker = remainingLargeOpen1+ (medDepth >= 1 ? remainingMedOpen1 : 0)
          + remainingLargeOpen2 + (medDepth >= 2 ? remainingMedOpen2 : 0)
          + remainingLargeOpen3 + (medDepth >= 3 ? remainingMedOpen3 : 0)

        if ((remainingLargeOpen3 < bestRemaining) || (remainingLargeOpen3 == bestRemaining && tiebreaker < bestTiebreaker)) {
          bestRemaining = remainingLargeOpen3;
          bestTiebreaker = tiebreaker;
          bestIndices = [i, j, k];
        }
      }
    }
  }

  return convertToCoordinates(bestIndices[0], true);
}

const solveGridWeightedMedFind = (grid: boolean[][], largeDepth: number) => {
  // Compute the coordinates of all open 2x2, 2x3, and 3x2 rectangles as-is.
  const openWideCoordSet = getOpenCoordinates(3, 2, grid);
  const openTallCoordSet = getOpenCoordinates(2, 3, grid);
  const openMedCoordSet = getOpenCoordinates(2, 2, grid);

  // hardcoded lul
  // depth 3 brute force of the middle 4x4
  let bestMetric = Number.MAX_SAFE_INTEGER;
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
    const remainingLargeOpen1 = remainingWideOpen1 + remainingTallOpen1;
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
      const remainingLargeOpen2 = remainingWideOpen2 + remainingTallOpen2;
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
        const remainingLargeOpen3 = remainingWideOpen3 + remainingTallOpen3;
        const remainingMedOpen3 = getOpenCoordinates(2, 2, filledGrid3, openMedCoordSet).length;

        const metric = 3 * remainingMedOpen1 + (largeDepth >= 1 ? remainingLargeOpen1 : 0)
          + 3 * remainingMedOpen2 + (largeDepth >= 2 ? remainingLargeOpen2 : 0)
          + 3 * remainingMedOpen3 + (largeDepth >= 3 ? remainingLargeOpen3 : 0)

        if (metric < bestMetric) {
          bestMetric = metric;
          bestIndices = [i, j, k];
        }
      }
    }
  }

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
        bestRemaining = remainingOpen;
        bestIndex = i;
      }
    }

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
          bestRemaining = remaining;
          bestTiebreaker = tiebreaker;
          bestIndices = [i, j];
        }
      }
    }

    return convertToCoordinates(bestIndices[0], true);
  }
}

// depth must always be 1 or 2
const solveGridLargeFind = (grid: boolean[][], depth: number = 1) => {
  // Compute tiebreaker number of 2x3s and 3x2s covered as-is.
  const openWideCoordSet = getOpenCoordinates(3, 2, grid);
  const openTallCoordSet = getOpenCoordinates(2, 3, grid);

  // Branched based on depth.
  if (depth == 1) {
    let bestRemaining = openWideCoordSet.length + openTallCoordSet.length + 1;
    let bestIndex: number = 0;
    for (let i = 0; i < 16; i++) {
      const ci = convertToCoordinates(i, true);
      if (grid[ci.y][ci.x]) {
        continue;
      }
      // Create a grid copy with only the first square set
      let filledGrid1 = cloneDeep(grid);
      filledGrid1[ci.y][ci.x] = true;
      const remainingOpenWide = getOpenCoordinates(3, 2, filledGrid1, openWideCoordSet).length;
      const remainingOpenTall = getOpenCoordinates(2, 3, filledGrid1, openTallCoordSet).length;
      const remainingOpen = remainingOpenWide + remainingOpenTall;

      if (remainingOpen < bestRemaining) {
        bestRemaining = remainingOpen;
        bestIndex = i;
      }
    }

    return convertToCoordinates(bestIndex, true);
  } else {
    let bestRemaining = openWideCoordSet.length + openTallCoordSet.length + 1;
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
      const remainingOpenWide1 = getOpenCoordinates(3, 2, filledGrid1, openWideCoordSet).length;
      const remainingOpenTall1 = getOpenCoordinates(2, 3, filledGrid1, openTallCoordSet).length;
      const remainingOpen1 = remainingOpenWide1 + remainingOpenTall1;

      for (let j = 0; j < 16; j++) {
        if (j == i) { continue; }
        const cj = convertToCoordinates(j, true);
        if (grid[cj.y][cj.x]) {
          continue;
        }
        // Create a grid copy with the first and second squares set
        let filledGrid2 = cloneDeep(filledGrid1);
        filledGrid2[cj.y][cj.x] = true;
        const remainingOpenWide2 = getOpenCoordinates(3, 2, filledGrid2, openWideCoordSet).length;
        const remainingOpenTall2 = getOpenCoordinates(2, 3, filledGrid2, openTallCoordSet).length;
        const remainingOpen2 = remainingOpenWide2 + remainingOpenTall2;

        const remaining = remainingOpen1 + remainingOpen2;
        const tiebreaker = remainingOpen1;

        if ((remaining < bestRemaining) || (remaining == bestRemaining && tiebreaker < bestTiebreaker)) {
          bestRemaining = remaining;
          bestTiebreaker = tiebreaker;
          bestIndices = [i, j];
        }
      }
    }

    return convertToCoordinates(bestIndices[0], true);
  }
}

const solveGridSmallFind = (grid: boolean[][], medFound: boolean, largeFound: boolean) => {
  const openWideCoordSet = getOpenCoordinates(3, 2, grid);
  const openTallCoordSet = getOpenCoordinates(2, 3, grid);
  const openMedCoordSet = getOpenCoordinates(2, 2, grid);

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

    let remaining = 0;
    if (!medFound) {
      remaining += getOpenCoordinates(2, 2, filledGrid1, openMedCoordSet).length;
    }
    if (!largeFound) {
      remaining += getOpenCoordinates(3, 2, filledGrid1, openWideCoordSet).length;
      remaining += getOpenCoordinates(2, 3, filledGrid1, openTallCoordSet).length;
    }

    if (remaining > bestRemaining) {
      bestRemaining = remaining;
      bestIndex = i;
    }
  }

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
  <div style={{fontFamily: 'Roboto'}}>
    <h2>
      Instructions
    </h2>
    Left click to cycle between opened square types: unopened - empty (beige) - large (blue) - medium (green)
    <br />
    Right click to toggle whether a cell is blocked off.
    <br />
    Inputting the attempt number changes the solver behavior.  If you have not yet earned a retelling this week, select attempt 1.  Otherwise, select attempt 2.
    The solver will prioritize earning a retelling on the first attempt, but prioritize earning maximum leaves on the second attempt.
    <br />
    It's highly recommended that, on your first attempt, you fully open the large picture as soon as you see it.
    Marking the full large picture on the solver will improve its recommendations.
    <br />
    It's also recommended that, if you find a square corresponding to a picture but you don't have enough attempts to reveal the entire thing, that you block it off on the solver.
    This will also improve its recommendations.
    <br />
    In general, solver recommendations are not necessarily to be followed blindly.  Opening an entire picture often takes precedence over the solver recommendation.  Use best judgment.
    <hr />
    <Grid />
  </div>,
  document.getElementById("root"),
);
