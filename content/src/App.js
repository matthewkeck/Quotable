import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import { API_URL } from "./utils";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";


import SimplePieChart from './SimplePieChart';

const ResponsiveReactGridLayout = WidthProvider(Responsive);
const MAX_GUESSES = 3;
const LOCAL_STORAGE_KEY = 'quotableUIState';

function App() {

  const isInitialLoad = useRef(true);
  const tileRefs = useRef([]);

  const defaultCols = useMemo(() => ({lg: 5, md: 3, sm: 3, xs: 2, xxs: 2}),[]);
  const defaultBp   = useMemo(() => ({lg: 1200, md: 996, sm: 768, xs:280, xxs: 0}), []);
  // Layout state
  const [layouts, setLayouts] = useState({ 
    lg: [], // large screens
    md: [], // medium
    sm: [], // small
    xs: [], // extra-small
    xxs: [] // extra-extra-small
  }); 



  // Tiles and game state
  const [tiles, setTiles] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);
  const [topQuote, setTopQuote] = useState("");
  const [bottomQuote, setBottomQuote] = useState("");
  const [completedTopQuote, setCompletedTopQuote] = useState("");
  const [completedBottomQuote, setCompletedBottomQuote] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [correctTileOrder, setCorrectTileOrder] = useState([]);
  const [guessCount, setGuessCount] = useState(0);
  const [view, setView] = useState('game');
  const [stats, setStats] = useState({solvedIn1: 0, solvedIn2: 0, solvedIn3: 0, solvedCount:0, totalSessions: 0})

  const flipTile = (e, index) => {
    e.preventDefault();
    if (isGameOver) return;
    const newTiles = [...tiles];
    newTiles[index].isFlipped = !newTiles[index].isFlipped;
    setTiles(newTiles);
  };

  const saveUIState = useCallback(() => {
    try {
      const state = {tiles, isGameOver, isCorrect, validationStatus, layouts, topQuote, bottomQuote, completedTopQuote, completedBottomQuote, showQuote, showInstructions, showStats, correctTileOrder, guessCount, view}
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [tiles, isGameOver, isCorrect, validationStatus, layouts, topQuote, bottomQuote, showQuote, completedTopQuote, completedBottomQuote, showInstructions, showStats, correctTileOrder, guessCount, view]);

  const loadUIState = useCallback(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch(e) {
      console.error('Failed to load from localStorage', e);
      return null;
    }

  }, []);

  const getOrCreateSessionId = useCallback(() => {
    let sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }, []);


  const createLayout = useCallback((tileCount, tiles = []) => {
    const layouts = {};

    Object.keys(defaultCols).forEach(breakpoint => {
      const columns = defaultCols[breakpoint];

      layouts[breakpoint] = Array.from({ length: tileCount }, (_, index) => {
      let height = 1; let width = 1;
      if (tiles.length && (
        tiles[index].top && tiles[index].bottom
      )) {
        // Calculate width based on content length
        const topLength = tiles[index].top.length;
        const bottomLength = tiles[index].bottom.length;  
        const numberOfTopLines = Math.ceil(topLength / 14);
        const numberOfBottomLines = Math.ceil(bottomLength / 14);
        const totalLines = numberOfTopLines + numberOfBottomLines;  
        height += Math.ceil((totalLines - 5) / 7);
      }

      return {
        i: index.toString(),
        x: index % columns,
        y: Math.floor(index / columns),
        w: width,
        h: height
      };
      });
    });
    
    return layouts 
  }, [defaultCols]);


  const fetchStats = useCallback(async () => {
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
  }, [getOrCreateSessionId]);



  
  const fetchTiles = useCallback(async () => {
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
        const allLayouts = createLayout(initialTiles.length, initialTiles);
        setLayouts(allLayouts);
        setGuessCount(data.guessNumber || 0);
        setIsCorrect(data.solved || false);
        setIsGameOver(false)
        setValidationStatus(null);
        setView('game');       
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
  },[getOrCreateSessionId, createLayout]);

  const applySavedState = useCallback((saved) => {
    setTiles(saved.tiles || []);
    setIsGameOver(saved.isGameOver || false);
    setIsCorrect(saved.isCorrect || false);
    setValidationStatus(saved.validationStatus || null);
    setLayouts(saved.layouts || {});
    setTopQuote(saved.topQuote || "");
    setBottomQuote(saved.bottomQuote || "");
    setCompletedTopQuote(saved.completedTopQuote || "");
    setCompletedBottomQuote(saved.completedBottomQuote || "");
    setShowQuote(saved.showQuote || false);
    setShowInstructions(saved.showInstructions || false);
    setShowStats(saved.showStats || false);
    setCorrectTileOrder(saved.correctTileOrder || []);
    setGuessCount(saved.guessCount || 0);
    setView(saved.view || 'game');
    if (saved.view === 'results') {
      fetchStats();
    }
  }, [fetchStats]); 



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
        setView('results');
        setShowStats(true);
        setCompletedTopQuote(`${data.completedTop}`);
        setCompletedBottomQuote(`${data.completedBottom}`);
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

  function handleLayoutChange(currentLayout, allLayouts) {
    // 1. Sort currentLayout by row (y) then column (x), to compute `correctTileOrder`.
    const sorted = [...currentLayout].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    const newOrder = sorted.map(item => parseInt(item.i, 10));
    setCorrectTileOrder(newOrder);

    // 2. Build a brand‐new object that pushes the same layout array into all breakpoints:
    //    e.g. { lg: [...], md: [...], sm: [...], xs: [...], xxs: [...] }
    const unifiedLayouts = Object.keys(allLayouts).reduce((acc, breakpoint) => {
      // assign the exact same `currentLayout` array (or sorted, if you prefer)
      acc[breakpoint] = currentLayout;
      return acc;
    }, {});

    // 3. Overwrite your state with that “unified” object:
    setLayouts(unifiedLayouts);
  }


  const updateCurrentQuotes = () => {
    
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

  useEffect(() => {
    const saved = loadUIState();
    if (saved) {
      applySavedState(saved);
      if (saved.showStats) {
        fetchStats();
      }
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
          localStorage.removeItem('quotableUIState');
          localStorage.setItem('quoteVersionSeed', newVersion);
          fetchTiles();
        } else {
          // First run or same day
          localStorage.setItem('quoteVersionSeed', newVersion);
        }
      } catch (e) {
        console.error('Version check failed', e);
      }
    })();
  }, [loadUIState, applySavedState, fetchTiles, fetchStats]);

  // Persist UI state whenever key parts change,
  // but skip the very first render where we just loaded from storage.
  useEffect(() => { 
    
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    saveUIState();}
    , [
      saveUIState, 
      tiles, 
      isGameOver, 
      isCorrect, 
      validationStatus, 
      layouts, 
      topQuote, 
      bottomQuote, 
      completedTopQuote,
      completedBottomQuote,
      showQuote,
      showInstructions,
      showStats,
      correctTileOrder, 
      guessCount, 
      view
    ]
  );

  useEffect(() => {
    if (view === 'results') {
      fetchStats();
    }
  }, [view, fetchStats]);

  

  return (
    <div>
      <div 
        className="game-container"
      >
        <header className='app-header'>
          <h1>Quotable</h1>
          <div className='button-container'>
            <button 
              className="button" 
              onClick={validateSelection}
              disabled={isGameOver}
            >
              {isCorrect ? "✅" : "✔️"}
              
            </button>

            <button 
              className="button" 
              onClick={() => {
                if (!showQuote) updateCurrentQuotes();
                setShowQuote(!showQuote);
              }}
            >
              {showQuote ?  "🙈" : "👁️"}
            </button>
            <button 
              className="button"
              onClick={() => {
                fetchStats();
                setShowStats(!showStats);
              }}
            >
              {"📊"}
            </button>
            <button 
              className="button" 
              onClick={() => {
                setShowInstructions(!showInstructions);
              }}
            >
              {"❓"}  
            </button>
              
            <div className='guess-row'>
              <span className='guess-label'>
                Guesses:
              </span>
              <div className="dots">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className={`dot ${i < guessCount ? 'filled' : ''}`}
                    />
                  ))}
              </div>
            </div>
          </div>
          
        </header>

        <div  style={{ width: '100%', margin: '0 auto' }} >
          <ResponsiveReactGridLayout
            className="tiles"
            layouts={layouts}
            breakpoints={defaultBp}
            cols={defaultCols}
            rowHeight={100}
            compactType={"horizontal"}
            isResizable={false}
            isDraggable={!isGameOver}
            margin={[30, 30]}
            draggableCancel=".hitbox-top, .hitbox-bottom"
            onLayoutChange={handleLayoutChange}
            
          >
            {tiles.map((tile, i) => (
              <div
                key={i.toString()}
                className={"tile"}
              >
                {/* Invisible drag hitboxes */}
                <div
                    className="hitbox-top"
                    onClick={e => {flipTile(e, i); }}
                  />
                  <div
                    className="hitbox-bottom"
                    onClick={e => {flipTile(e, i); }}
                />

                <div 
                  ref={el => tileRefs.current[i] = el}
                  className={`flip-content ${isGameOver && isCorrect ? "correct" : ""} ${tile.isFlipped ? 'flipped' : ""} `}
                >
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
          </ResponsiveReactGridLayout>
        </div>
        
        
      </div>
      
        

      {showQuote && (
        <div
          className='popup-overlay'
          onClick={() => setShowQuote(false)}
        >
          <div 
            className='popup-content'
          >
            <h2>
              Current Selection
            </h2>
            <p 
              className='topQuote'
              onClick={(e) => e.stopPropagation()}
            >
              Top Selection: {topQuote}
            </p>
            <p 
              className='bottomQuote'
              onClick={(e) => e.stopPropagation()}
            >
              Bottom Selection: {bottomQuote}
            </p>
          </div>
        </div>
        
      )}

      
      {showInstructions && (
        <div 
          className="popup-overlay" 
          onClick={() => setShowInstructions(false)}
        >
          <div className="popup-content">
            <h2
            >
              How to Play
            </h2>
            <h3
            >
              Objective
            </h3>
            <p
            >
              Reconstruct two original quotes by arranging and flipping the tiles so that the top and bottom halves form complete, correct quotes. 
              The words from the two quotes have been divided into the top and bottom of each tile and randomly flipped and arranged. 
              Your job is to flip them and arrange them in the correct order.
            </p>
            <h3
            >
              Instructions
            </h3>
            <ul 
            >
              <li>Each tile contains a top and bottom half from different quotes.</li>
              <li>
                <strong>Flip tiles</strong> by clicking the <strong>top or bottom section</strong> of a tile.
              </li>
              <li>Drag tiles to rearrange their order.</li>
              <li>Click the check button <span role="img" aria-label="Check">✔️</span> to submit your guess.</li>
              <li>You have 3 guesses to get both quotes correct.</li>
              <li>Click <span role="img" aria-label="Show">👁️</span> to preview your current selection.</li>
              <li>Click the <span role="img" aria-label="Stats">📊</span> button to view the stats of players who played today.</li>
            </ul>
          </div>
        </div>
      )}

      {showStats && (
        <div className="popup-overlay" onClick={() => setShowStats(false)}>
          <div className="popup-content">
            {isGameOver && (
              <div className="completed-quotes">
                <h2>{isCorrect ? "🎉 You Solved It!" : "😞 Out of Guesses"}</h2>
                <p>
                  <strong>Quote A:</strong> {completedTopQuote}
                </p>
                <p>
                  <strong>Quote B:</strong> {completedBottomQuote}
                </p>
              </div>
            )}
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <h2>Game Stats</h2>
              <div
                style={{
                  width: "100vw",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <div style={{ width: "300px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                  <SimplePieChart 
                    data={[
                      { name: "1 Guess", value: stats.solvedIn1, color: "#4CAF50" },
                      { name: "2 Guesses", value: stats.solvedIn2, color: "#2196F3" },
                      { name: "3 Guesses", value: stats.solvedIn3, color: "#FFC107" },
                    ]}
                  />
                </div>
                <div style={{ width: "300px", display: "flex", justifyContent: "center", alignItems: "center"}}>
                  <SimplePieChart 
                    data={[
                      { name: "Solved", value: stats.solvedCount, color: "#4CAF50" },
                      { name: "Unsolved", value: stats.totalSessions - stats.solvedCount, color: "#F44336" },
                    ]}  
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
     
 </div>

  );

}

export default App;
