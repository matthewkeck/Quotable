import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { API_URL } from "./utils";
import { Responsive, WidthProvider } from 'react-grid-layout';
import "react-grid-layout/css/styles.css";
const ResponsiveReactGridLayout = WidthProvider(Responsive);

const originalLayouts = getFromLS("layouts") || {};

export default class ResponsiveLocalStorageLayout extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      layouts: JSON.parse(JSON.stringify(originalLayouts));
    };
  }

  static get defaultProps() {
    return {
      className: "layout",
      cols: {lg: 12, md: 10, sm: 6, xs: 4, xxs: 2},
      rowHeight: 30
    };
  }

  resetLayout() {
    this.setState({layouts: {}});
  }

  onLayoutChange(layout, layous) {
    saveToLS("layouts", layouts);
    this.setState({ layouts })
  }

  render()
}

const breakpoints = { lg: 800, md: 500, sm: 0 };
const cols       = { lg: 4, md: 3, sm: 2 };

const MAX_GUESSES = 3;
const LOCAL_STORAGE_KEY = 'quotableUIState';

function App() {
  const isInitialLoad = useRef(true);
  // Layout state
  const [layouts, setLayouts] = useState({lg: [], md: [], sm: []});
 
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

  // Utility to turn a flat layout into all breakpoints
  const makeLayouts = base =>({
    lg: base,
    md: base, 
    sm: base
  });

  const saveUIState = () => {
    try {
      const state = {tiles, isGameOver, isCorrect, validationStatus, layouts, topQuote, bottomQuote, showQuote, correctTileOrder, guessCount, view}
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
    setLayouts(saved.layout || {sm: [], md: [], lg: []});
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

        if (!data.server_date) {
          throw new Error("Response JSON missing 'version' field");
        }

        const newVersion = data.server_date.toString();

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
      layouts, 
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
        const baseLayout = initialTiles.map((_, i) => ({
          i: i.toString(), x: i % cols.lg, y: Math.floor(i / cols.lg), w: 1, h:1
        }));
        setLayouts(makeLayouts(baseLayout));
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

  const handleLayoutChange = (newLayout, allLayouts) => {
    setLayouts(allLayouts);
    // determine correctTileOrder from the current breakpoint layout
    const current = newLayout.sort((a,b) => a.y - b.y || a.x - b.x);
    setCorrectTileOrder(current.map(item => parseInt(item.i, 10)));   
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

        <div  style={{ margin: '0 auto', width: 600}} >
          <ResponsiveGridLayout
            className="tiles"
            layouts={layouts}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={100}
            compactType={'horizontal'}
            isResizable={false}
            isDraggable={!isGameOver}
            margin={[20, 20]}
            draggableCancel=".hitbox-top, .hitbox-bottom"
            onLayoutChange={handleLayoutChange}
          >
            {tiles.map((tile, index) => (
              <div
                key={index}
                className={"tile"}
              >
                {/* Invisible drag hitboxes */}
                <div
                  className="hitbox-top"
                  onClick={e => {flipTile(e, index); }}
                />
                <div
                  className="hitbox-bottom"
                  onClick={e => {flipTile(e, index); }}
                />

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
          </ResponsiveGridLayout>
        </div>

        {/* <div className='guess-dots'>
          {[0, 1, 2].map(i => (
            <span key={i} className={`dot ${i < guessCount ? 'filled' : ''}`}></span>
          ))}
        </div> */}

        <div className='button-container'>
          <button 
            className="button" 
            onClick={validateSelection}
            disabled={isGameOver}
          >
            {isCorrect ? "Solved" : "Check"}
            {!isCorrect && (
              <span className="dots">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className={`dot ${i < guessCount ? 'filled' : ''}`}
                  />
                ))}
              </span>
            )}
          </button>
          <button 
            className="button" 
            onClick={() => {
              if (!showQuote) updateCurrentQuotes();
              setShowQuote(!showQuote);
            }}
          >
            {showQuote ? "Hide Sentance" : "Show Sentance"}
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
