from flask import Flask, jsonify, request
from flask_cors import CORS
import json, math, re
from datetime import datetime
import random

app = Flask(__name__)
CORS(app)
# Global dictionary to store the puzzle data for validation.
puzzle_data = {}
def clean_text(text):
    return re.sub(r'[^\w\s]', '', text.lower())
def seeded_random(seed):
    x = math.sin(seed) * 10000
    return x - math.floor(x)
def get_quotes():
    with open("filtered_quotes.json", "r", encoding="utf-8") as f:
        return json.load(f)
def generate_tiles_for_quotes(quote1, quote2, seed):
    words1 = quote1.split()
    words2 = quote2.split()
    max_tiles = min(min(len(words1), len(words2)), 10)
    min_tiles = min(max_tiles, 5)
    number_of_tiles = int(seeded_random(seed) * (max_tiles - min_tiles + 1)) + min_tiles
    tiles = [{"top": "", "bottom": "", "isFlipped": random.choice([True, False])} for _ in range(number_of_tiles)]
    def distribute_words(words, key):
        words_per_tile = len(words) // number_of_tiles
        extra_words = len(words) % number_of_tiles
        tile_index = 0
        while tile_index < number_of_tiles and words:
            count = words_per_tile + (1 if tile_index < extra_words else 0)
            tile_words = " ".join(words[:count]) + " " if count > 0 else ""
            tiles[tile_index][key] = tile_words
            words = words[count:]
            tile_index += 1
    distribute_words(words1, "top")
    distribute_words(words2, "bottom")
    for i in range(len(tiles) - 1, 0, -1):
        j = int(seeded_random(seed) * (i + 1))
        tiles[i], tiles[j] = tiles[j], tiles[i]
    return tiles
@app.route('/tiles', methods=['GET'])
def tiles_endpoint():
    quotes_data = get_quotes()
    date_seed = int(datetime.today().strftime("%Y%m%d"))
    num_quotes = len(quotes_data)
    index1 = int(seeded_random(date_seed) * num_quotes)
    index2 = index1
    while index2 == index1:
        index2 = int(seeded_random(date_seed + 100) * num_quotes)
    selected_quote1 = quotes_data[index1]
    selected_quote2 = quotes_data[index2]
    cleaned_quote1 = clean_text(selected_quote1.get("quoteText", ""))
    cleaned_quote2 = clean_text(selected_quote2.get("quoteText", ""))
    quote_author1 = selected_quote1.get("quoteAuthor", "Unknown")
    quote_author2 = selected_quote2.get("quoteAuthor", "Unknown")
    # Store correct answers along with authors for later validation.
    puzzle_data["quote1"] = cleaned_quote1
    puzzle_data["quote2"] = cleaned_quote2
    puzzle_data["author1"] = quote_author1
    puzzle_data["author2"] = quote_author2
    tiles = generate_tiles_for_quotes(cleaned_quote1, cleaned_quote2, date_seed)
    return jsonify({"tiles": tiles})
@app.route('/validate', methods=['POST'])
def validate():
    data = request.get_json()
    user_top = data.get("topString", "").strip()
    user_bottom = data.get("bottomString", "").strip()
    correct_quote1 = puzzle_data.get("quote1", "")
    correct_quote2 = puzzle_data.get("quote2", "")
    author1 = puzzle_data.get("author1", "Unknown")
    author2 = puzzle_data.get("author2", "Unknown")
    if ((user_top == correct_quote1 or user_top == correct_quote2) and
        (user_bottom == correct_quote1 or user_bottom == correct_quote2)):
        # Append the proper author to each completed quote.
        completed_top = user_top + " - " + (author1 if user_top == correct_quote1 else author2)
        completed_bottom = user_bottom + " - " + (author1 if user_bottom == correct_quote1 else author2)
        return jsonify({
            "result": True,
            "completedTop": completed_top,
            "completedBottom": completed_bottom
        })
    else:
        return jsonify({"result": False})
if __name__ == '__main__':
    app.run(port=5000, debug=True)