const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 5000;

// Path to the quotes JSON file
const quotesFilePath = path.join(__dirname, "filtered_quotes.json");

// Enable CORS for all origins
app.use(cors());

// Function to strip punctuation and convert to lowercase
const cleanText = (text) => {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
};

// Function to get quotes from the JSON file
const getQuotes = () => {
  const data = fs.readFileSync(quotesFilePath, "utf-8");
  return JSON.parse(data);
};

// Simple seeded random generator
const seededRandom = (seed) => {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Function to generate consistent tiles based on date
const generateTilesForQuotes = (quote1, quote2, seed) => {
  const words1 = quote1.split(/\s+/);
  const words2 = quote2.split(/\s+/);

  const maxTiles = Math.min(Math.min(words1.length, words2.length), 10);
  const minTiles = Math.min(maxTiles, 5);

  // Determine number of tiles using the seed
  const numberOfTiles = Math.floor(seededRandom(seed) * (maxTiles - minTiles + 1)) + minTiles;

  const tiles = Array.from({ length: numberOfTiles }, () => ({
    top: "",
    bottom: "",
    isFlipped: false, // 80% chance of flipping
  }));

  const distributeWords = (words, key) => {
    const wordsPerTile = Math.floor(words.length / numberOfTiles);
    const extraWords = words.length % numberOfTiles;

    let tileIndex = 0;
    while (tileIndex < numberOfTiles && words.length > 0) {
      let wordCount = wordsPerTile + (tileIndex < extraWords ? 1 : 0);
      let tileWords = words.splice(0, wordCount).join(" ") + " ";

      tiles[tileIndex][key] = tileWords;
      tileIndex++;
    }
  };

  distributeWords(words1, "top");
  distributeWords(words2, "bottom");

  // Shuffle the tiles using the Fisher-Yates algorithm with our seeded random
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed) * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  return tiles;
};

// Get two quotes and generate tiles based on the current date
app.get("/quotes", (req, res) => {
  const quotes = getQuotes();
  const dateSeed = parseInt(new Date().toISOString().split("T")[0].replace(/-/g, ""), 10);

  let index1 = Math.floor(seededRandom(dateSeed) * quotes.length);
  let index2;
  do {
    index2 = Math.floor(seededRandom(dateSeed + 100) * quotes.length);
  } while (index2 === index1);

  const selectedQuote1 = quotes[index1];
  const selectedQuote2 = quotes[index2];

  const cleanedQuote1 = cleanText(selectedQuote1.quoteText);
  const cleanedQuote2 = cleanText(selectedQuote2.quoteText);

  let quoteAuthor1 = selectedQuote1.quoteAuthor || "Unknown";
  let quoteAuthor2 = selectedQuote2.quoteAuthor || "Unknown";

  const tiles = generateTilesForQuotes(cleanedQuote1, cleanedQuote2, dateSeed);
  // console.log(tiles)
  res.json({
    quote1: cleanedQuote1,
    author1: quoteAuthor1,
    quote2: cleanedQuote2,
    author2: quoteAuthor2,
    tiles: tiles, // Send pre-generated tiles to the frontend
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
