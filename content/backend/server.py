from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import math
import re
from datetime import datetime, timedelta
import uuid
import boto3
import hashlib

# QuoteableSessions

# import awsgi

# Initialize Flask and CORS
app = Flask(__name__)
CORS(app)

# Initialize DynamoDB resource

total_quotes = 1570
table_name = 'Quotes'
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
quotes_table = dynamodb.Table('Quotes')  # Replace with your table name
sessions_table = dynamodb.Table('QuoteableSessions')  # Replace with your table name
date_seed = int(datetime.today().strftime("%Y%m%d"))
SECRET_KEY = "your_secret_key_here"

MAX_GUESSES = 3

def get_session(session_id):
    response = sessions_table.get_item(Key={'sessionId' : session_id})
    return response.get('Item')

def get_stats():
    #Scan only the 'solved' attribute
    resp = sessions_table.scan(ProjectionExpression='solved, guessNumber')
    items = resp.get('Items', [])

    total = len(items)
    guess_buckets = {
        'solvedIn1': 0,
        'solvedIn2': 0,
        'solvedIn3': 0,
        'failed': 0
    }

    for item in items:
        solved = item.get('solved', False)
        guesses = item.get('guessNumber', 0)

        if solved:
            if guesses == 1:
                guess_buckets['solvedIn1'] += 1
            elif guesses == 2:
                guess_buckets['solvedIn2'] += 1
            else:
                guess_buckets['solvedIn3'] += 1
        else:
            if guesses >= MAX_GUESSES:
                guess_buckets['failed'] += 1

    solved_count = guess_buckets['solvedIn1'] + guess_buckets['solvedIn2'] + guess_buckets['solvedIn3']

    return total, solved_count, guess_buckets

def create_session(session_id):
    todays_date = datetime.utcnow().strftime("%Y-%m-%d")
    midnight_tomorrow = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    expires_at = int(midnight_tomorrow.timestamp())
    
    # Initialize the session with zero guesses; add TTL if desired.
    sessions_table.put_item(Item={
        'sessionId' : session_id, 
        'guessNumber' : 0,
        'lastUpdated' : todays_date,
        'expiresAt' : expires_at,
        'solved' : False
    })

    return {
        'sessionId': session_id, 
        'guessNumber': 0,
        'lastUpdated' : todays_date,
        'expiresAt' : expires_at,
        'solved' : False
    }

def update_guess_count(session_id, new_count):
    sessions_table.update_item(
        Key={'sessionId' : session_id},
        UpdateExpression="SET guessNumber = :c",
        ExpressionAttributeValues={":c": new_count}
    )

def clean_text(text):
    return re.sub(r'[^\w\s]', '', text.lower())

def compute_tile_id(correct_order, seed):
    # Create a base string using the seed, tile's correct order, and a secret key.       
    base_string = f"{seed}-{correct_order}-{SECRET_KEY}"
    # generate a SHA256 hash as the unique ID.
    return hashlib.sha256(base_string.encode('utf-8')).hexdigest()


# Retrieve a single quote by ID
def get_quote_by_id(quote_id):
    response = quotes_table.get_item(Key={'id': quote_id})
    return response.get('Item')

def generate_tiles_for_quotes(quote1, quote2, seed):
    
    random.seed(date_seed)  
    words1 = quote1.split()
    words2 = quote2.split()
    max_tiles = min(min(len(words1), len(words2)), 10)
    min_tiles = min(max_tiles, 5)
    number_of_tiles = random.randint(min_tiles, max_tiles)
    # Create tiles with deterministic flips based on the seed
    tiles = [
        {
            "top": "",
            "bottom": "",
            "isFlipped": False,
            "tileId": compute_tile_id(i, date_seed)
        }
        for i in range(number_of_tiles)
    ]


    def distribute_words(words):
        words_per_tile = len(words) // number_of_tiles
        extra_words = len(words) % number_of_tiles
        tile_index = 0
        while tile_index < number_of_tiles and words:
            count = words_per_tile + (1 if tile_index < extra_words else 0)
            tile_words = " ".join(words[:count]) + " " if count > 0 else ""
            random.seed(date_seed + tile_index)
            if random.random() > 0.5:
                key = "top"
            else:
                key = "bottom"
            
            if tiles[tile_index][key] == "":  
                tiles[tile_index][key] = tile_words
            else:
                if key == "top":
                    tiles[tile_index]["bottom"] = tile_words
                else:
                    tiles[tile_index]["top"] = tile_words

                
            words = words[count:]
            tile_index += 1

    distribute_words(words1)
    distribute_words(words2)
    random.shuffle(tiles)
    return tiles



@app.route('/tiles', methods=['GET'])
def tiles_endpoint():
    # For tracking guesses, assume the sessionId is passed in headers ( or as part of the JSON payload)
    session_id = request.headers.get('X-Session-Id')
    session_data = None
    if not session_id:
        # Optionally, generate one and send it back to the client
        session_id = str(uuid.uuid4())
        create_session(session_id)
        session_data = get_session(session_id)
    else:
        session_data = get_session(session_id)
        if not session_data:
            create_session(session_id)
            session_data = get_session(session_id)

    random.seed(date_seed)  
    # Ensure there are at least two quotes
    if total_quotes < 2:
        return jsonify({"error": "Not enough quotes in the database."}), 500

    # Randomly select two different quotes
    index1 = random.randint(0, total_quotes)
    index2 = index1
    random.seed(date_seed + 100)  
    while index2 == index1:
        index2 = random.randint(0, total_quotes)

    selected_quote1 = get_quote_by_id(index1)
    selected_quote2 = get_quote_by_id(index2)

    if not selected_quote1 or not selected_quote2:
        return jsonify({"error": "Could not retrieve quotes."}), 500
    
    isSolved = session_data.get("solved", False)
    current_guess_count = session_data.get("guessNumber", 0)
    quote1_original, quote2_original = selected_quote1.get("quote_text",""), selected_quote2.get("quote_text","")
    author1, author2 = selected_quote1.get("quote_author",""), selected_quote2.get("quote_author","")
    

    if isSolved or (current_guess_count >= MAX_GUESSES):
        total, solved_count, guess_buckets = get_stats()   
        top_quote = quote1_original + " - " + author1 
        bottom_quote = quote2_original + " - " + author2
        return jsonify({
            "guessNumber": current_guess_count,
            "solved" : session_data.get('solved', False),
            "completedTop": top_quote,
            "completedBottom": bottom_quote,
            'totalSessions': total,
            'solvedCount': solved_count,
            'solvedIn1': guess_buckets['solvedIn1'],
            'solvedIn2': guess_buckets['solvedIn2'],
            'solvedIn3': guess_buckets['solvedIn3'],
            'failed': guess_buckets['failed']
        })
    
    # Clean and extract author info
    cleaned_quote1 = clean_text(quote1_original)
    cleaned_quote2 = clean_text(quote2_original)

    tiles = generate_tiles_for_quotes(cleaned_quote1, cleaned_quote2, date_seed)
    
    return jsonify({
        "tiles": tiles, 
        "guessNumber": session_data.get('guessNumber', 0),
        "solved" : session_data.get('solved', False)
    })

@app.route('/version', methods=['GET'])
def version():
    current_date = int(datetime.today().strftime("%Y%m%d"))
    return jsonify({"server_date": current_date})

@app.route('/validate', methods=['POST'])
def validate():
    data = request.get_json()
    user_state = data.get("userState", []) # Expected: list of {"tileId: ..., "isFlipped": ...} 

    # For tracking guesses, assume the sessionId is passed in headers ( or as part of the JSON payload)
    session_id = request.headers.get('X-Session-Id')
    if not session_id:
        # Optionally, generate one and send it back to the client
        session_id = str(uuid.uuid4())
        create_session(session_id)

    #Retrive or create the session data from DynamoDB
    session_data = get_session(session_id)
    if not session_data:
        session_data = create_session(session_id)
    
    current_guess_count = session_data.get("guessNumber", 0)

    random.seed(date_seed)  

    # Ensure there are at least two quotes
    if total_quotes < 2:
        
        return jsonify({"error": "Not enough quotes in the database."}), 500

    # Randomly select two different quotes
    index1 = random.randint(0, total_quotes)
    index2 = index1
    random.seed(date_seed + 100)  
    while index2 == index1:
        index2 = random.randint(0, total_quotes)

    selected_quote1 = get_quote_by_id(index1)
    selected_quote2 = get_quote_by_id(index2)

    quote1_original = selected_quote1.get("quote_text", "")
    quote2_original = selected_quote2.get("quote_text", "")

    quote_author1 = selected_quote1.get("quote_author", "Unknown")
    quote_author2 = selected_quote2.get("quote_author", "Unknown")

    author1 = quote_author1
    author2 = quote_author2

    order_check= []
    correct_flips = []
    for i, state in enumerate(user_state):
        random.seed(date_seed + i)
        correct_flips.append(state["isFlipped"] == (random.random() > .5))

        if state["tileId"] == compute_tile_id(i, date_seed):
            order_check.append(True)
        else:
            order_check.append(False)


    flip_check = not any(correct_flips)
    inverse_flip_check = all(correct_flips) 
  
    is_correct = False not in order_check and (flip_check or inverse_flip_check)

    def assign_quotes_to_authors():
        nonlocal author1, author2, quote1_original, quote2_original
        # Append the proper author to each completed quote
        if author1 == "":
            author1 = "Unknown"
        if author2 == "":
            author2 = "Unknown"

        if (flip_check):
            top_quote = quote1_original + " - " + author1 
            bottom_quote = quote2_original + " - " + author2
        else:
            top_quote = quote2_original + " - " + author2 
            bottom_quote = quote1_original + " - " + author1 

        return top_quote, bottom_quote
    
    completed_top, completed_bottom = assign_quotes_to_authors()
   
    if current_guess_count >= MAX_GUESSES:
        return jsonify({
            "result": False,
            "completedTop": completed_top,
            "completedBottom": completed_bottom,
            "guessNumber": current_guess_count
        })


    # Increment guess count whether correct or not
    new_guess_count = current_guess_count + 1
    update_guess_count(session_id, new_guess_count)

    
    if (is_correct):
        # Mark this session as solved
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression="SET solved = :s",
            ExpressionAttributeValues={":s": True}
        ) 
        return jsonify({
            "result": True,
            "completedTop": completed_top,
            "completedBottom": completed_bottom,
            "guessNumber": new_guess_count
        })
    # handles final incorrect guess
    elif not is_correct and new_guess_count >= MAX_GUESSES:
        completed_top, completed_bottom = assign_quotes_to_authors()
        return jsonify({
            "result": False,
            "completedTop": completed_top,
            "completedBottom": completed_bottom,
            "guessNumber": new_guess_count 
        })
    else:
        return jsonify({
            "result": False,
            "orderCheck": order_check,
            "guessNumber": new_guess_count
        })
    
@app.route('/stats', methods=['GET'])
def stats():
    total, solved_count, guess_buckets = get_stats()    
    
    return jsonify({
        'totalSessions': total,
        'solvedCount': solved_count,
        'solvedIn1': guess_buckets['solvedIn1'],
        'solvedIn2': guess_buckets['solvedIn2'],
        'solvedIn3': guess_buckets['solvedIn3'],
        'failed': guess_buckets['failed']
    })

# Lambda handler for AWS Lambda
# def lambda_handler(event, context):
#     return awsgi.response(app, event, context, base64_content_types={"image/png"})

if __name__ == '__main__':
    app.run(port=5000, debug=True)
