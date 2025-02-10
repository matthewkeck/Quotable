import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [quote1, setQuote1] = useState('');
  const [quote2, setQuote2] = useState('');
  const [author1, setAuthor1] = useState('');
  const [author2, setAuthor2] = useState('');
  const [sequence, setSequence] = useState([]);
  const [flipStates, setFlipStates] = useState([]); // Track the flip state history
  const [result, setResult] = useState("");
  const [topString, setTopString] = useState("");
  const [bottomString, setBottomString] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);

  // Declare the tiles state here
  const [tiles, setTiles] = useState([]);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const response = await fetch('http://localhost:5000/quotes');
        const data = await response.json();
        
        setQuote1(data.quote1);
        setQuote2(data.quote2);
        setAuthor1(data.author1); // Store the first quote's author
        setAuthor2(data.author2); // Store the second quote's author
        setTiles(randomizeTiles(data.tiles || []));
  
      } catch (error) {
        console.error('Error fetching quotes:', error);
      }
    };
  
    fetchQuotes();
  }, []); // Runs only on component mount

  const randomizeTiles = (tiles) => {
    // Shuffle the tiles using the Fisher-Yates algorithm with our seeded random
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    // Randomly set the flip state for each tile (80% chance to be flipped)
    const updatedTiles = tiles.map(tile => ({
      ...tile,
      isFlipped: Math.random() < 0.5,
    }));
    return updatedTiles;
  };

  const selectTile = (index) => {
    if (isGameOver || sequence.includes(index)) return;
  
    const tile = tiles[index];
    const isFlipped = tile.isFlipped;
    const newTopString = topString + (tile.isFlipped ? tile.bottom : tile.top);
    const newBottomString = bottomString + (tile.isFlipped ? tile.top : tile.bottom);
  
    setSequence([...sequence, index]);
    setFlipStates([...flipStates, isFlipped]);
    setTopString(newTopString);
    setBottomString(newBottomString);
  
    const trimmedTopString = newTopString.trim();
    const trimmedBottomString = newBottomString.trim();

    console.log(trimmedTopString);
    console.log(quote1)
    // console.log(trimmedBottomString);
    // console.log(quote2)
  
    if ((trimmedTopString === quote1 || trimmedTopString === quote2) && 
        (trimmedBottomString === quote1 || trimmedBottomString === quote2)) {
      // Append author to the final quote
      let completedTopString = trimmedTopString;
      let completedBottomString = trimmedBottomString;
  
      if (trimmedTopString === quote1) {
        completedTopString += ` - ${author1}`;
      } else if (trimmedTopString === quote2) {
        completedTopString += ` - ${author2}`;
      }
  
      if (trimmedBottomString === quote1) {
        completedBottomString += ` - ${author1}`;
      } else if (trimmedBottomString === quote2) {
        completedBottomString += ` - ${author2}`;
      }
  
      setTopString(completedTopString);
      setBottomString(completedBottomString);
      setResult("Congratulations! You've successfully recreated both quotes!");
      setIsGameOver(true);
    } else {
      setResult("");
    }
  };

  const clearSequence = () => {
    setSequence([]);
    setFlipStates([]);
    setResult("");
    setTopString("");
    setBottomString("");
    setIsGameOver(false);
  };

  const undoLastSelection = () => {
    if (sequence.length === 0) return;
  
    // Start from the current strings.
    let currentTopString = topString;
    let currentBottomString = bottomString;
  
    // Remove any appended author text if present.
    const authorSuffix1 = ` - ${author1}`;
    const authorSuffix2 = ` - ${author2}`;
    
    if (currentTopString.endsWith(authorSuffix1)) {
      currentTopString = currentTopString.slice(0, -authorSuffix1.length);
    } else if (currentTopString.endsWith(authorSuffix2)) {
      currentTopString = currentTopString.slice(0, -authorSuffix2.length);
    }
    
    if (currentBottomString.endsWith(authorSuffix1)) {
      currentBottomString = currentBottomString.slice(0, -authorSuffix1.length);
    } else if (currentBottomString.endsWith(authorSuffix2)) {
      currentBottomString = currentBottomString.slice(0, -authorSuffix2.length);
    }
  
    // Get the last tile selection and determine its text based on flip state.
    const lastIndex = sequence[sequence.length - 1];
    const tile = tiles[lastIndex];
    const wasFlipped = flipStates[flipStates.length - 1];
  
    // Determine which text was appended for each string.
    const textToRemoveTop = wasFlipped ? tile.bottom : tile.top;
    const textToRemoveBottom = wasFlipped ? tile.top : tile.bottom;
  
    // Remove the tile's text from the current strings.
    const newTopString = currentTopString.slice(0, -textToRemoveTop.length);
    const newBottomString = currentBottomString.slice(0, -textToRemoveBottom.length);
  
    // Update states.
    setSequence(sequence.slice(0, -1));
    setFlipStates(flipStates.slice(0, -1));
    setTopString(newTopString);
    setBottomString(newBottomString);
    setResult("");
    
    if (isGameOver) {
      setIsGameOver(false);
    }
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
  
    // Copy tiles state
    const newTiles = [...tiles];
    const tile = newTiles[index];
  
    // Temporarily add the flipping class
    tile.isFlipped = !tile.isFlipped; // Flip the tile
    setTiles(newTiles);

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
            <div className='tile-front'>
              <div>{tile.top}</div>
              <div className="divider"></div>
              <div>{tile.bottom}</div>
            </div>   
            <div className='tile-back'>
              <div>{tile.bottom}</div>
              <div className="divider"></div>
              <div>{tile.top}</div>           
            </div>
          </div>
        ))}
      </div>

      <button className='button' onClick={undoLastSelection}>Undo</button>
      <button className='button' onClick={clearSequence}>Clear</button>

      <div className="results">
        <div className="string-box">
          <p>{topString}</p>
        </div>
        <div className="string-box">
          <p>{bottomString}</p>
        </div>
        {result && <p className="matched">{result}</p>}
      </div>
    </div>
  );
}

export default App;
