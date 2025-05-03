import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { API_URL } from "./utils";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";

const MAX_GUESSES = 3;
const LOCAL_STORAGE_KEY = 'quotableUIState';

function App() {
  const isInitialLoad = useRef(true);
  // responsive columns logic
  const getCols = () => window.innerWidth <= 500 ? 2 : 3;
  const [cols, setCols] = useState(3);

  // Layout state
  const [layout, setLayout] = useState([]);
 
  // Tiles and game state
  const [tiles, setTiles] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);
  const [topQuote, setTopQuote] = useState("");
  const [bottomQuote, setBottomQuote] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const [correctTileOrder, setCorrectTileOrder] = useState([]);
  const [guessCount, setGuessCount] = useState(0);
  const [view, setView] = useState('game');
  const [stats, setStats] = useState({solvedIn1: 0, solvedIn2: 0, solvedIn3: 0, solvedCount:0, totalSessions: 0})


  const saveUIState = () => {
    try {
      const state = {tiles, isGameOver, isCorrect, validationStatus, layout, topQuote, bottomQuote, showQuote, correctTileOrder, guessCount, view}
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  const loadUIState = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch(e) {
      console.error('Failed to load from localStorage', e);
      return null;
    }
  };

  function applySavedState(saved) {
    setTiles(saved.tiles || []);
    setIsGameOver(saved.isGameOver || false);
    setIsCorrect(saved.isCorrect || false);
    setValidationStatus(saved.validationStatus || null);
    setLayout(saved.layout || []);
    setTopQuote(saved.topQuote || "");
    setBottomQuote(saved.bottomQuote || "");
    setShowQuote(saved.showQuote || false);
    setCorrectTileOrder(saved.correctTileOrder || []);
    setGuessCount(saved.guessCount || 0);
    setView(saved.view || 'game');
    if (saved.view === 'results') {
      fetchStats();
    }
  }

  // Handle window resize to update cols
  // useEffect(() => {
  //   const onResize = () => {
  //     setCols(getCols());
  //   }
  //   window.addEventListener('resize', onResize);
  //   return () => window.removeEventListener('resize', onResize);
  // }, []);

  // Recreate layout when tiles or cols change
  // useEffect(() => {
  //   if (tiles.length) {
  //     setLayout(createLayout(tiles.length, cols))
  //   }
  // }, [tiles.length, cols]);

  

  useEffect(() => {
    const saved = loadUIState();
    if (saved) {
      applySavedState(saved);
    } else {
      fetchTiles();
    }

    // In parallel, check the data to clear local storage
    (async () => {
      try {
        const res = await fetch(API_URL + 'version');

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        if (!data.version) {
          throw new Error("Response JSON missing 'version' field");
        }

        const newVersion = data.version.toString();

        const oldVersion = localStorage.getItem('quoteVersionSeed');
        if (oldVersion && oldVersion !== newVersion) {
          // console.log("reset")
          localStorage.removeItem('quotableUIState');
          localStorage.setItem('quoteVersionSeed', newVersion);
          fetchTiles();
        } else {
          // First run or same day
          // console.log("no rest")
          localStorage.setItem('quoteVersionSeed', newVersion);
        }
      } catch (e) {
        console.error('Version check failed', e);
      }
    })();
  }, []);

  // Persist UI state whenever key parts change,
  // but skip the very first render where we just loaded from storage.
  useEffect(() => { 
    
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    saveUIState();}
    , [ 
      tiles, 
      isGameOver, 
      isCorrect, 
      validationStatus, 
      layout, 
      topQuote, 
      bottomQuote, 
      showQuote, 
      correctTileOrder, 
      guessCount, 
      view
    ]
  );

  useEffect(() => {
    if (view === 'results') {
      fetchStats();
    }
  }, [view]);

  const getOrCreateSessionId = () => {
    let sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  const fetchTiles = async () => {
    try {
      let sessionId = getOrCreateSessionId();

      const response = await fetch(API_URL + "tiles", {
        headers: {
          'X-Session-Id': sessionId
        }
      });
      const data = await response.json(); 
      if (data.tiles) {
        const initialTiles = data.tiles.map(t => ({...t, isFlipped: false}));
        setTiles(initialTiles);
        const initialLayout = createLayout(initialTiles.length, cols);
        setLayout(initialLayout)
        setGuessCount(data.guessNumber || 0);
        setIsCorrect(data.solved || false);       
      } else {
        // stats only
        setGuessCount(data.guessNumber || 0);
        setIsCorrect(data.solved || false);
        setValidationStatus(data.result ? "correct": "finalIncorrect");
        setView('results');
        setTopQuote(data.completedTop || "");
        setBottomQuote(data.completedBottom || "");

      }
         
    } catch (error) {
      console.error("Error fetching tiles:", error);
    } 
  };

  const fetchStats = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(`${API_URL}stats`, {
        headers: { 'X-Session-Id': sessionId}
      });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const flipTile = (e, index) => {
    e.preventDefault();
    if (isGameOver) return;
    const newTiles = [...tiles];
    newTiles[index].isFlipped = !newTiles[index].isFlipped;
    setTiles(newTiles);
  };

  const validateSelection = async () => {
    try {
      if (validationStatus === "correct") return;
      
      const sessionId = getOrCreateSessionId();

      // Build the user state array using each tile's tileId and flip state.
      const userState = correctTileOrder.map((item) => {
        const tile = tiles[item];
        return {
          tileId: tile.tileId,
          isFlipped: tile.isFlipped
        };
      });

      const response = await fetch(API_URL + 'validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({
          userState: userState
        })
      });

      const data = await response.json();
      setGuessCount(data.guessNumber);
      if (data.result || (!data.result && data.guessNumber >= MAX_GUESSES)) {
        setIsGameOver(true);
        setIsCorrect(data.result);
        setValidationStatus(data.result ? "correct": "finalIncorrect");
        setView('results')
        setTopQuote(`${data.completedTop}`);
        setBottomQuote(`${data.completedBottom}`);
        fetchStats();
      }
      else {
        setValidationStatus("incorrect");
      }
    } catch (error) {
      console.error('Error validating selection:', error);
      setValidationStatus("incorrect");
    }
  };

  const createLayout = (tileCount, columns) => {
    return Array.from({ length: tileCount }, (_, index) => ({
      i: index.toString(),
      x: index % columns,
      y: Math.floor(index / columns),
      w: 1,
      h: 1
    }));
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    // Sort the new layout to determin the order
    const orderedLayout = [...newLayout].sort((a, b) => a.y - b.y || a.x - b.x);
    const newOrder = orderedLayout.map(item => parseInt(item.i, 10));
    setCorrectTileOrder(newOrder);
    // saveStateToLocalStorage(tiles, newLayout);
  }

  const updateCurrentQuotes = () => {
    if (validationStatus === "correct") return;
    
    const orderedTiles = correctTileOrder.map(index => tiles[index]);

    let topQuote = "";
    let bottomQuote = "";
    orderedTiles.forEach(tile => {
      if(tile.isFlipped) {
        topQuote += tile.bottom;
        bottomQuote += tile.top;
      } else {
        topQuote += tile.top;
        bottomQuote += tile.bottom;
      }
    });
    setTopQuote(topQuote);
    setBottomQuote(bottomQuote);
  }

  // RESULTS SCREEN
  if (view === 'results') {
    return (
      <div className='results-screen'>
        <h1>{isCorrect ? "🎉 You Solved It!":"😞 Out of Guesses"}</h1>
        <div className='completed-quotes'>
          <p><strong>Quote A:</strong> {topQuote} </p>
          <p><strong>Quote B:</strong> {bottomQuote} </p>
        </div>
        <div className='stats'>
          <p>Total players today: {stats.totalSessions}</p>
          <p>Players who solved: {stats.solvedCount}</p>
          <p>Success rate: {((stats.solvedCount / stats.totalSessions) * 100).toFixed(1)}%</p>
          <p>Players with one guess: {stats.solvedIn1}</p>
          <p>Players with two guess: {stats.solvedIn2}</p>
          <p>Players with three guess: {stats.solvedIn3}</p>
          <p>Guesses you used: {guessCount}</p>
        </div>
      </div>
    )
  } else {
    return (
      <div className="game-container">
        <h1>Quotable</h1>

        <div  style={{ margin: '0 auto', width: 600 }} >
          <GridLayout
            className="tiles"
            layout={layout}
            cols={cols}
            rowHeight={100}
            width={600}
            compactType={"horizontal"}
            isResizable={false}
            isDraggable={!isGameOver}
            margin={[30, 30]}
            draggableCancel='.flip-button'
            onLayoutChange={handleLayoutChange}
          >
            {tiles.map((tile, index) => (
              <div
                key={index}
                data-grid={layout.find(l => l.i === index.toString())}
                className={"tile"}
              >
                <div
                  className="flip-button" 
                  onClick={(e) => flipTile(e, index)}

                >
                  🔄 
                </div>

                <div className={`flip-content ${isGameOver && isCorrect ? "correct" : ""} ${tile.isFlipped ? 'flipped' : ""} `}>
                  <div className="tile-face tile-front">
                      <div>{tile.top}</div>
                      <div className="divider"></div>
                      <div>{tile.bottom}</div>
                    </div>
                    <div className="tile-face tile-back">
                      <div>{tile.bottom}</div>
                      <div className="divider"></div>
                      <div>{tile.top}</div>
                    </div>
                  </div>
                </div>
            ))}
          </GridLayout>
        </div>

        <div className='guess-dots'>
          {[0, 1, 2].map(i => (
            <span key={i} className={`dot ${i < guessCount ? 'filled' : ''}`}></span>
          ))}
        </div>

        <div className='button-container'>
          <button 
            className="button" 
            onClick={validateSelection}
            disabled={isGameOver}
          >
            {isCorrect ? "Solved" : "Check"}
          </button>
          <button 
            className="button" 
            onClick={() => {
              if (!showQuote) updateCurrentQuotes();
              setShowQuote(!showQuote);
            }}
          >
            {showQuote ? "Hide Selection" : "Show Selection"}
          </button>
        </div>
        {showQuote && (
          <div className='quote-popup'>
            <p className='topQuote'>{topQuote}</p>
            <p className='bottomQuote'>{bottomQuote}</p>
          </div>
        )}
      </div>
    );
  }
}

export default App;
