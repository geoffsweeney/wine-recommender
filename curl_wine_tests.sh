#!/bin/bash

# Wine Recommender API - cURL Test Suite
# Base URL for the running application
BASE_URL="http://localhost:3001/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

# Function to print test header
print_test_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local payload="$2"
    local expected_keywords="$3"
    
    TEST_COUNT=$((TEST_COUNT + 1))
    echo -e "\n${YELLOW}Test $TEST_COUNT: $test_name${NC}"
    
    # Make the request
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BASE_URL/recommendations")
    
    # Extract HTTP status and body
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    echo "HTTP Status: $http_code"
    echo "Response: $response_body" | jq '.' 2>/dev/null || echo "$response_body"
    
    # Check status code
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Status: 200 OK${NC}"
        
        # Check for expected keywords if provided
        if [ -n "$expected_keywords" ]; then
            found_keyword=false
            IFS='|' read -ra KEYWORDS <<< "$expected_keywords"
            for keyword in "${KEYWORDS[@]}"; do
                if echo "$response_body" | grep -qi "$keyword"; then
                    echo -e "${GREEN}✓ Found expected keyword: $keyword${NC}"
                    found_keyword=true
                    break
                fi
            done
            
            if [ "$found_keyword" = true ]; then
                PASS_COUNT=$((PASS_COUNT + 1))
                echo -e "${GREEN}✓ TEST PASSED${NC}"
            else
                FAIL_COUNT=$((FAIL_COUNT + 1))
                echo -e "${RED}✗ TEST FAILED - No expected keywords found${NC}"
            fi
        else
            PASS_COUNT=$((PASS_COUNT + 1))
            echo -e "${GREEN}✓ TEST PASSED${NC}"
        fi
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "${RED}✗ TEST FAILED - HTTP $http_code${NC}"
    fi
}

# Function to run error test
run_error_test() {
    local test_name="$1"
    local payload="$2"
    local expected_status="$3"
    
    TEST_COUNT=$((TEST_COUNT + 1))
    echo -e "\n${YELLOW}Test $TEST_COUNT: $test_name${NC}"
    
    # Make the request
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BASE_URL/recommendations")
    
    # Extract HTTP status and body
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    echo "HTTP Status: $http_code"
    echo "Response: $response_body" | jq '.' 2>/dev/null || echo "$response_body"
    
    # Check expected status code
    if [ "$http_code" = "$expected_status" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "${GREEN}✓ TEST PASSED - Expected $expected_status${NC}"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "${RED}✗ TEST FAILED - Expected $expected_status, got $http_code${NC}"
    fi
}

# Start testing
echo -e "${GREEN}Starting Wine Recommender API Tests${NC}"
echo "Base URL: $BASE_URL"

# ==========================================
# Classic Food & Wine Pairings
# ==========================================
print_test_header "Classic Food & Wine Pairings"

run_test "Steak with red wine" \
'{
  "userId": "user-live-steak",
  "input": {"message": "I am having a juicy grilled ribeye steak tonight. What wine should I drink?"}
}' \
"cabernet|malbec|red wine|syrah|shiraz"

run_test "Fish with white wine" \
'{
  "userId": "user-live-fish",
  "input": {"message": "I am making grilled halibut with lemon herbs. What wine pairs well?"}
}' \
"pinot grigio|sauvignon blanc|white wine|albariño|crisp"

run_test "Chicken pairing" \
'{
  "userId": "user-live-chicken",
  "input": {"message": "What wine goes well with herb-roasted chicken with rosemary?"}
}' \
"pinot noir|chardonnay|chianti|beaujolais|medium-bodied"

run_test "Oysters with sparkling" \
'{
  "userId": "user-live-oysters",
  "input": {"message": "I have fresh Kumamoto oysters. What wine should I serve?"}
}' \
"champagne|prosecco|chablis|muscadet|sparkling|mineral"

run_test "Cheese platter" \
'{
  "userId": "user-live-cheese",
  "input": {"message": "What wine should I serve with a cheese platter?"}
}' \
"port|cabernet|sauvignon blanc|aged|bold"

# ==========================================
# Pasta & Italian Food Pairings
# ==========================================
print_test_header "Pasta & Italian Food Pairings"

run_test "Tomato pasta with Italian reds" \
'{
  "userId": "user-live-pasta-tomato",
  "input": {"message": "I am making spaghetti with marinara sauce and meatballs. Wine recommendation?"}
}' \
"chianti|sangiovese|barbera|italian|acidity|tomato"

run_test "Seafood pasta with Italian whites" \
'{
  "userId": "user-live-pasta-seafood",
  "input": {"message": "Making linguine alle vongole (clam pasta) with white wine sauce. What wine pairs?"}
}' \
"pinot grigio|vermentino|soave|albariño|italian|seafood"

# ==========================================
# Cheese & Charcuterie Pairings
# ==========================================
print_test_header "Cheese & Charcuterie Pairings"

run_test "Aged cheddar with bold wines" \
'{
  "userId": "user-live-aged-cheddar",
  "input": {"message": "I have a 5-year aged Vermont cheddar. What wine complements it?"}
}' \
"port|cabernet|bordeaux|sherry|bold|aged|robust"

run_test "Goat cheese with crisp whites" \
'{
  "userId": "user-live-goat-cheese",
  "input": {"message": "Serving fresh goat cheese with herbs. Wine pairing suggestion?"}
}' \
"sauvignon blanc|sancerre|pouilly|albariño|crisp|acidity|citrus"

# ==========================================
# Dessert Pairings
# ==========================================
print_test_header "Dessert Pairings"

run_test "Fruit desserts with sweet wines" \
'{
  "userId": "user-live-fruit-dessert",
  "input": {"message": "I made a fresh peach tart with vanilla cream. Wine recommendation?"}
}' \
"moscato|riesling|gewürztraminer|ice wine|sweet|dessert|fruit"

run_test "Chocolate with fortified wines" \
'{
  "userId": "user-live-chocolate",
  "input": {"message": "Serving dark chocolate truffles and espresso. What wine pairs well?"}
}' \
"port|madeira|sherry|banyuls|fortified|chocolate|rich"

# ==========================================
# Spicy & Ethnic Cuisine Pairings
# ==========================================
print_test_header "Spicy & Ethnic Cuisine Pairings"

run_test "Thai spicy food" \
'{
  "userId": "user-live-thai-spicy",
  "input": {"message": "Making spicy Thai green curry with chicken. What wine can handle the heat?"}
}' \
"riesling|gewürztraminer|viognier|rosé|off-dry|spicy|aromatic|cooling"

run_test "Spanish paella" \
'{
  "userId": "user-live-paella",
  "input": {"message": "Cooking seafood paella with saffron. Spanish wine recommendation?"}
}' \
"tempranillo|rioja|albariño|verdejo|spanish|saffron|seafood"

# ==========================================
# Australian Wine Pairings
# ==========================================
print_test_header "Australian Wine Pairings"

run_test "Australian Shiraz for game meat" \
'{
  "userId": "user-live-aussie-game",
  "input": {"message": "Cooking venison steaks with native Australian herbs. What Australian wine pairs well?"}
}' \
"shiraz|barossa|mclaren vale|hunter valley|australian|bold|spicy"

run_test "Australian Riesling for Asian fusion" \
'{
  "userId": "user-live-aussie-asian",
  "input": {"message": "Making Vietnamese-style fish with lemongrass and chili. Prefer Australian wine."}
}' \
"riesling|eden valley|clare valley|australian|spicy|aromatic"

run_test "Australian Chardonnay for seafood" \
'{
  "userId": "user-live-aussie-seafood",
  "input": {"message": "Grilling barramundi with native pepper berry. Want an Australian white wine."}
}' \
"chardonnay|margaret river|adelaide hills|yarra valley|australian|crisp|citrus"

run_test "Australian Pinot Noir for duck" \
'{
  "userId": "user-live-aussie-duck",
  "input": {"message": "Roasting duck with wattleseed crust. Looking for Australian red wine pairing."}
}' \
"pinot noir|yarra valley|mornington peninsula|adelaide hills|australian|elegant|duck"

run_test "Australian Grenache for Mediterranean" \
'{
  "userId": "user-live-aussie-med",
  "input": {"message": "Making lamb souvlaki with Australian native herbs. Want a local wine match."}
}' \
"grenache|gsm|barossa|mclaren vale|australian|lamb|herbs"

run_test "Australian Semillon for oysters" \
'{
  "userId": "user-live-aussie-light",
  "input": {"message": "Having fresh oysters from Coffin Bay. Want an Australian white wine."}
}' \
"semillon|hunter valley|australian|oyster|mineral|crisp"

run_test "Australian Cabernet for beef" \
'{
  "userId": "user-live-aussie-beef",
  "input": {"message": "Grilling wagyu beef with bush tomato relish. Need Australian red wine suggestion."}
}' \
"cabernet sauvignon|coonawarra|margaret river|australian|bold|beef|wagyu"

run_test "Australian sparkling for celebration" \
'{
  "userId": "user-live-aussie-sparkling",
  "input": {"message": "Celebrating with prawns and native finger lime. Want Australian sparkling wine."}
}' \
"sparkling|tasmanian|yarra valley|australian|celebration|prawns|citrus"

run_test "Cool-climate Australian wines" \
'{
  "userId": "user-live-aussie-delicate",
  "input": {"message": "Making pan-fried flathead with lemon myrtle. Want cool-climate Australian wine."}
}' \
"sauvignon blanc|chardonnay|adelaide hills|yarra valley|tasmanian|australian|cool climate|delicate"

run_test "Australian fortified for dessert" \
'{
  "userId": "user-live-aussie-dessert",
  "input": {"message": "Serving pavlova with native Davidson plum. Want Australian dessert wine."}
}' \
"port|fortified|muscat|tokay|rutherglen|australian|sweet|dessert|pavlova"

# ==========================================
# BBQ and Bold Flavors
# ==========================================
print_test_header "BBQ and Bold Flavors"

run_test "BBQ ribs with bold reds" \
'{
  "userId": "user-live-bbq-ribs",
  "input": {"message": "Having BBQ pork ribs with smoky sauce. What wine can stand up to this?"}
}' \
"zinfandel|syrah|shiraz|malbec|bold|smoky|barbecue"

run_test "Summer salad with light wines" \
'{
  "userId": "user-live-summer-salad",
  "input": {"message": "Making a fresh summer salad with strawberries and feta. Light wine suggestion?"}
}' \
"rosé|provence|sauvignon blanc|light|fresh|summer"

# ==========================================
# Validation and Error Cases
# ==========================================
print_test_header "Validation and Error Cases"

run_error_test "Missing userId" \
'{
  "input": {"message": "Any wine?"}
}' \
"400"

run_error_test "Missing input object" \
'{
  "userId": "user-live-missing-input"
}' \
"400"

run_error_test "Empty message" \
'{
  "userId": "user-live-empty-message",
  "input": {"message": ""}
}' \
"400"

run_error_test "Null message" \
'{
  "userId": "user-live-null-message",
  "input": {"message": null}
}' \
"400"

# ==========================================
# Edge Cases and Challenging Requests
# ==========================================
print_test_header "Edge Cases and Challenging Requests"

run_test "Vague request" \
'{
  "userId": "user-live-vague",
  "input": {"message": "Wine please"}
}' \
""

run_test "Conflicting preferences" \
'{
  "userId": "user-live-conflicting",
  "input": {"message": "I want a dry sweet wine that goes with both fish and steak"}
}' \
""

run_test "Unusual food combination" \
'{
  "userId": "user-live-unusual",
  "input": {"message": "I am eating sushi pizza with pineapple. Wine suggestion?"}
}' \
""

run_test "Budget constraints" \
'{
  "userId": "user-live-budget",
  "input": {"message": "I need a wine for beef wellington but my budget is only $15"}
}' \
"budget|affordable|value"

run_test "Dietary restrictions" \
'{
  "userId": "user-live-dietary",
  "input": {"message": "I am vegan and having stuffed portobello mushrooms. Need organic, sulfite-free wine."}
}' \
"vegan|organic|sulfite|mushroom|earthy"

run_test "Impossible wine request" \
'{
  "userId": "user-live-impossible",
  "input": {"message": "I need a wine that tastes exactly like Coca-Cola but is still wine"}
}' \
""

run_test "Anniversary occasion" \
'{
  "userId": "user-live-occasion",
  "input": {"message": "Anniversary dinner with lobster thermidor. Want something special and romantic."}
}' \
"special|elegant|anniversary|celebration|romantic|lobster"

run_test "Moroccan cuisine" \
'{
  "userId": "user-live-regional",
  "input": {"message": "Making authentic Moroccan tagine with lamb and apricots. Need traditional pairing."}
}' \
"moroccan|tagine|lamb|apricot|spice|fruit"

# ==========================================
# Test Summary
# ==========================================
print_test_header "Test Summary"

echo -e "\n${BLUE}Test Results:${NC}"
echo -e "Total Tests: $TEST_COUNT"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi