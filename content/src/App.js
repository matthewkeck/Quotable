import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [sequence, setSequence] = useState([]);
  const [flipStates, setFlipStates] = useState([]);
  const [result, setResult] = useState("");
  const [topString, setTopString] = useState("");
  const [bottomString, setBottomString] = useState("");
  // Save the original assembled strings before authors are appended.
  const [originalTopString, setOriginalTopString] = useState("");
  const [originalBottomString, setOriginalBottomString] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [tiles, setTiles] = useState([]);
  // New state to track validation status: "correct", "incorrect", or null.
  const [validationStatus, setValidationStatus] = useState(null);

  useEffect(() => {
    const fetchTiles = async () => {
      try {
        const response = await fetch('http://localhost:5000/tiles');
        const data = await response.json();
        
        setTiles(data.tiles || []);
      } catch (error) {
        console.error('Error fetching tiles:', error);
      }
    };

    fetchTiles();
  }, []);

  const selectTile = (index) => {
    if (isGameOver || sequence.includes(index)) return;

    const tile = tiles[index];
    const isFlipped = tile.isFlipped;
    const newTopString = topString + (isFlipped ? tile.bottom : tile.top);
    const newBottomString = bottomString + (isFlipped ? tile.top : tile.bottom);

    setSequence([...sequence, index]);
    setFlipStates([...flipStates, isFlipped]);
    setTopString(newTopString);
    setBottomString(newBottomString);
    setResult("");
    setValidationStatus(null);
  };

  const clearSequence = () => {
    setSequence([]);
    setFlipStates([]);
    setTopString("");
    setBottomString("");
    setOriginalTopString("");
    setOriginalBottomString("");
    setResult("");
    setIsGameOver(false);
    setValidationStatus(null);
  };

  const undoLastSelection = () => {
    if (sequence.length === 0) return;

    if (validationStatus === "correct") {
      // If the game is complete, first revert to the original tile-built strings (without authors)
      setTopString(originalTopString);
      setBottomString(originalBottomString);
      setIsGameOver(false);
      setValidationStatus(null);
      return;
    }

    let currentTopString = topString;
    let currentBottomString = bottomString;
    const lastIndex = sequence[sequence.length - 1];
    const tile = tiles[lastIndex];
    const wasFlipped = flipStates[flipStates.length - 1];
    const textToRemoveTop = wasFlipped ? tile.bottom : tile.top;
    const textToRemoveBottom = wasFlipped ? tile.top : tile.bottom;

    const newTopString = currentTopString.slice(0, -textToRemoveTop.length);
    const newBottomString = currentBottomString.slice(0, -textToRemoveBottom.length);

    setSequence(sequence.slice(0, -1));
    setFlipStates(flipStates.slice(0, -1));
    setTopString(newTopString);
    setBottomString(newBottomString);
    setResult("");
    setValidationStatus(null);
  };

  useEffect(() => {
    const handleUndo = (event) => {
      if (event.ctrlKey && event.key === 'z') {
        undoLastSelection();
      }
    };

    window.addEventListener('keydown', handleUndo);
    return () => {
      window.removeEventListener('keydown', handleUndo);
    };
  }, [sequence, topString, bottomString, isGameOver]);

  const handleDrag = (e, index) => {
    e.preventDefault();
    if (isGameOver) return;
    const newTiles = [...tiles];
    newTiles[index].isFlipped = !newTiles[index].isFlipped;
    setTiles(newTiles);
  };

  const validateSelection = async () => {
    try {
      if (validationStatus === "correct") {return;}

      const response = await fetch('http://localhost:5000/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topString: topString.trim(),
          bottomString: bottomString.trim()
        })
      });
      const data = await response.json();
      if (data.result) {
        // Save original tile-built strings before appending authors.
        setOriginalTopString(topString);
        setOriginalBottomString(bottomString);
        // Update the boxes with the completed quotes including authors.
        setTopString(data.completedTop);
        setBottomString(data.completedBottom);
        setResult("");
        setIsGameOver(true);
        setValidationStatus("correct");
      } else {
        setResult("Incorrect selection. Please try again.");
        setValidationStatus("incorrect");
      }
    } catch (error) {
      console.error('Error validating selection:', error);
      setResult("Validation error.");
      setValidationStatus("incorrect");
    }
  };

  return (
    <div className="game-container">
      <h1>Quotable</h1>
      <p>Recreate the two quotes by selecting tiles in the correct order. Drag up or down on a tile to flip it.</p>

      <div className="tiles">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`tile ${sequence.includes(index) ? 'selected' : ''} ${tile.isFlipped ? 'flipped' : ''}`}
            onClick={() => selectTile(index)}
            draggable
            onDragStart={(e) => handleDrag(e, index)}
          >
            <div className="tile-front">
              <div>{tile.top}</div>
              <div className="divider"></div>
              <div>{tile.bottom}</div>
            </div>
            <div className="tile-back">
              <div>{tile.bottom}</div>
              <div className="divider"></div>
              <div>{tile.top}</div>
            </div>
          </div>
        ))}
      </div>

      <button className="button" onClick={undoLastSelection}>Undo</button>
      <button className="button" onClick={clearSequence}>Clear</button>
      <button className="button" onClick={validateSelection}>Validate</button>

      <div className="results">
        <div className={`string-box ${validationStatus === "correct" ? "correct" : validationStatus === "incorrect" ? "incorrect" : ""}`}>
          <p>{topString}</p>
        </div>
        <div className={`string-box ${validationStatus === "correct" ? "correct" : validationStatus === "incorrect" ? "incorrect" : ""}`}>
          <p>{bottomString}</p>
        </div>
        {result && <p className="matched">{result}</p>}
      </div>
    </div>
  );
}

export default App;
