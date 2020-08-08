import * as React from "react";
import { render } from "react-dom";

import cloneDeep from "lodash-es/cloneDeep";
import maxBy from "lodash-es/maxBy";
import range from "lodash-es/range";

interface GridState {
  grid: boolean[][];
}

interface GridProps {

}

class Grid extends React.Component<GridProps, GridState> {
  constructor(props: GridProps) {
    super(props);
    this.state = {
      grid: [
  [false, false, false, false, false, false],
  [false, false, true, false, false, false],
  [false, false, false, false, true, false],
  [false, false, false, false, false, true],
  [false, true, false, false, false, false],
  [false, false, false, true, false, false],
],
    };
  }

  toggleCell = (coords: Coordinates) => {
    this.setState((state) => {
      let newState = cloneDeep(state);
      newState.grid[coords.y][coords.x] = !newState.grid[coords.y][coords.x];
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
      border: '2px solid rgb(108, 103, 85)',
      backgroundColor: 'rgb(49, 32, 17)',
    }

    return (
      <div style={wrapperStyle}>{
        range(36).map(v => {
          const coords = convertToCoordinates(v, false);
          const gridSquareProps = {
            coordinates: coords,
            isSelected: this.state.grid[coords.y][coords.x],
            isTarget: targetCoordinates.x == coords.x && targetCoordinates.y == coords.y,
            clickHandler: () => {this.toggleCell(coords)},
          }
          return <GridSquare {...gridSquareProps} key={`grid-${coords.x}-${coords.y}`}/>
        })
      }</div>
    );
  }
}

interface GridSquareProps {
  coordinates: Coordinates;
  isSelected: boolean;
  isTarget: boolean;
  clickHandler: (e: React.MouseEvent) => void;
}

const GridSquare = (props: GridSquareProps) => {
  const style = {
    backgroundColor: props.isSelected? 'rgb(107, 93, 75)' : 'rgb(76, 53, 50)',
    border: props.isTarget? '2px dashed red' : '1px solid rgb(108, 103, 85)',
    gridColumn: props.coordinates.x + 1,
    gridRow: props.coordinates.y + 1,
    borderRadius: '5px',
  }

  return (
    <div style={style} onClick={props.clickHandler}>
    </div>
  );
}


interface Coordinates {
  x: number;
  y: number;
}

const SolveGrid = (grid: boolean[][]) => {
  // Compute the coordinates of all open 2x3 and 3x2 rectangles as-is.
  const openWideCoordSet = getOpenCoordinates(3, 2, grid);
  const openTallCoordSet = getOpenCoordinates(2, 3, grid);

  // Compute tiebreaker - number of 2x2s covered.
  const openMedCoordSet = getOpenCoordinates(2, 2, grid);

  // hardcoded lul
  // depth 3 brute force of the middle 4x4
  let bestRemaining = openWideCoordSet.length + openTallCoordSet.length + 1;
  let bestRemainingMed = openMedCoordSet.length;
  let bestIndices: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 14; i++) {
    for (let j = i+1; j < 15; j++) {
      for (let k = j+1; k < 16; k++) {
        let filledGrid = cloneDeep(grid);
        const ci = convertToCoordinates(i, true);
        if (filledGrid[ci.y][ci.x]) {
          continue;
        } else {
          filledGrid[ci.y][ci.x] = true;
        }

        const cj = convertToCoordinates(j, true);
        if (filledGrid[cj.y][cj.x]) {
          continue;
        } else {
          filledGrid[cj.y][cj.x] = true;
        }

        const ck = convertToCoordinates(k, true);
        if (filledGrid[ck.y][ck.x]) {
          continue;
        } else {
          filledGrid[ck.y][ck.x] = true;
        }

        const remainingWideOpen = getOpenCoordinates(3, 2, filledGrid, openWideCoordSet);
        const remainingTallOpen = getOpenCoordinates(2, 3, filledGrid, openTallCoordSet);
        const remainingMedOpen = getOpenCoordinates(2, 2, filledGrid, openMedCoordSet);
        const remaining = remainingWideOpen.length + remainingTallOpen.length;
        if ((remaining < bestRemaining) || (remaining == bestRemaining && remainingMedOpen.length < bestRemainingMed)) {
          bestRemaining = remaining;
          bestRemainingMed = remainingMedOpen.length;
          bestIndices = [i, j, k];
        }
      }
    }
  }

  return convertToCoordinates(maxBy(bestIndices, v => {
    let filledGrid = cloneDeep(grid);
    const cv = convertToCoordinates(v, true);
    filledGrid[cv.y][cv.x] = true;

    const remainingWideOpen = getOpenCoordinates(3, 2, filledGrid, openWideCoordSet);
    const remainingTallOpen = getOpenCoordinates(2, 3, filledGrid, openTallCoordSet);
    const remainingMedOpen = getOpenCoordinates(2, 2, filledGrid, openMedCoordSet);
    return -((remainingTallOpen.length + remainingWideOpen.length) * 5 + remainingMedOpen.length); // todo fix this
  }), true);
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

render(
  <Grid />,
  document.getElementById("root"),
);
