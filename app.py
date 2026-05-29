"""
Albion Online Toolkit - Backend Server
Market data powered by albion-online-data.com API
"""
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# --- Configuration ---
API_BASES = {
    "west": "https://west.albion-online-data.com",
    "east": "https://east.albion-online-data.com",
    "europe": "https://europe.albion-online-data.com",
}
DEFAULT_SERVER = "west"
CACHE_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(CACHE_DIR, exist_ok=True)

# Cache duration in seconds
ITEMS_CACHE_TTL = 3600  # 1 hour
LOCATIONS_CACHE_TTL = 86400  # 24 hours

# Load curated items database
ITEMS_DB_PATH = os.path.join(CACHE_DIR, "items_curated.json")
ITEMS_DATA = {"items": []}
if os.path.exists(ITEMS_DB_PATH):
    try:
        with open(ITEMS_DB_PATH, "r", encoding="utf-8") as f:
            ITEMS_DATA = json.load(f)
    except:
        pass

@app.route("/api/items-full")
def get_items_full():
    """Get all items with names and icons for the searchable market."""
    return jsonify(ITEMS_DATA)

@app.route("/api/item-search")
def item_search():
    """Search items by name or ID. Supports enchant syntax: bow .2, bow@2, bow enchant 2"""
    import re
    query = request.args.get("q", "").lower().strip()
    category = request.args.get("category", "")
    tier = request.args.get("tier", "")
    enchant = request.args.get("enchant", "")
    limit = int(request.args.get("limit", "50"))

    if not query and not category:
        return jsonify([])

    # Detect enchant from query: ".2" suffix, "@2", or "enchant 2"
    enchant_filter = enchant
    search_query = query
    if not enchant_filter:
        m = re.search(r'\.(\d+)\s*$', query)
        if m:
            enchant_filter = m.group(1)
            search_query = query[:m.start()].strip()
        else:
            m = re.search(r'@(\d+)', query)
            if m:
                enchant_filter = m.group(1)
                search_query = query[:m.start()].strip()
            else:
                m = re.search(r'\benchant\s*(\d+)\s*$', query)
                if m:
                    enchant_filter = m.group(1)
                    search_query = query[:m.start()].strip()

    results = []
    for item in ITEMS_DATA.get("items", []):
        if search_query:
            haystack = item.get("search", "")
            if not haystack:
                haystack = (item["id"].lower() + " " + item["name"].lower())
            if search_query not in haystack:
                continue
        if category and item.get("category") != category:
            continue
        if tier and str(item.get("tier", "")) != tier:
            continue
        if enchant_filter and str(item.get("enchant", 0)) != enchant_filter:
            continue
        results.append(item)
        if len(results) >= limit:
            break

    return jsonify(results)
POPULAR_ITEMS = {
    "bags": {
        "name": "Bags",
        "items": {
            "T4_BAG": "Bag (T4)", "T5_BAG": "Bag (T5)", "T6_BAG": "Bag (T6)",
            "T7_BAG": "Bag (T7)", "T8_BAG": "Bag (T8)",
            "T4_BAG_INSIGHT": "Bag of Insight (T4)",
        },
    },
    "capes": {
        "name": "Capes",
        "items": {
            "T4_CAPE": "Cape (T4)", "T5_CAPE": "Cape (T5)", "T6_CAPE": "Cape (T6)",
            "T7_CAPE": "Cape (T7)", "T8_CAPE": "Cape (T8)",
            "T4_CAPEITEM_FW_BRIDGEWATCH": "Bridgewatch Cape (T4)",
            "T4_CAPEITEM_FW_FORTSTERLING": "Fort Sterling Cape (T4)",
            "T4_CAPEITEM_FW_LYMHURST": "Lymhurst Cape (T4)",
            "T4_CAPEITEM_FW_MARTLOCK": "Martlock Cape (T4)",
            "T4_CAPEITEM_FW_THETFORD": "Thetford Cape (T4)",
        },
    },
    "weapons_swords": {
        "name": "Swords",
        "items": {
            "T4_2H_CLAYMORE": "Claymore (T4)", "T5_2H_CLAYMORE": "Claymore (T5)",
            "T6_2H_CLAYMORE": "Claymore (T6)", "T7_2H_CLAYMORE": "Claymore (T7)",
            "T8_2H_CLAYMORE": "Claymore (T8)",
            "T4_2H_DUALSWORD": "Dual Swords (T4)", "T5_2H_DUALSWORD": "Dual Swords (T5)",
            "T4_MAIN_SWORD": "Sword (T4)", "T5_MAIN_SWORD": "Sword (T5)",
            "T6_MAIN_SWORD": "Sword (T6)", "T7_MAIN_SWORD": "Sword (T7)",
            "T8_MAIN_SWORD": "Sword (T8)",
        },
    },
    "weapons_axes": {
        "name": "Axes",
        "items": {
            "T4_2H_AXE": "Greataxe (T4)", "T5_2H_AXE": "Greataxe (T5)",
            "T6_2H_AXE": "Greataxe (T6)", "T7_2H_AXE": "Greataxe (T7)",
            "T8_2H_AXE": "Greataxe (T8)",
            "T4_MAIN_AXE": "Axe (T4)", "T5_MAIN_AXE": "Axe (T5)",
            "T4_2H_HALBERD": "Halberd (T4)", "T5_2H_HALBERD": "Halberd (T5)",
            "T6_2H_HALBERD": "Halberd (T6)", "T7_2H_HALBERD": "Halberd (T7)",
            "T8_2H_HALBERD": "Halberd (T8)",
        },
    },
    "weapons_bows": {
        "name": "Bows",
        "items": {
            "T4_2H_BOW": "Bow (T4)", "T5_2H_BOW": "Bow (T5)",
            "T6_2H_BOW": "Bow (T6)", "T7_2H_BOW": "Bow (T7)",
            "T8_2H_BOW": "Bow (T8)",
            "T4_2H_LONGBOW": "Longbow (T4)", "T5_2H_LONGBOW": "Longbow (T5)",
            "T4_2H_WARBOW": "Warbow (T4)", "T5_2H_WARBOW": "Warbow (T5)",
            "T6_2H_WARBOW": "Warbow (T6)", "T7_2H_WARBOW": "Warbow (T7)",
            "T8_2H_WARBOW": "Warbow (T8)",
        },
    },
    "weapons_staves": {
        "name": "Staves",
        "items": {
            "T4_2H_NATURESTAFF": "Nature Staff (T4)", "T5_2H_NATURESTAFF": "Nature Staff (T5)",
            "T6_2H_NATURESTAFF": "Nature Staff (T6)", "T7_2H_NATURESTAFF": "Nature Staff (T7)",
            "T8_2H_NATURESTAFF": "Nature Staff (T8)",
            "T4_MAIN_FIRESTAFF": "Fire Staff (T4)", "T5_MAIN_FIRESTAFF": "Fire Staff (T5)",
            "T6_MAIN_FIRESTAFF": "Fire Staff (T6)", "T7_MAIN_FIRESTAFF": "Fire Staff (T7)",
            "T8_MAIN_FIRESTAFF": "Fire Staff (T8)",
            "T4_2H_INFERNOSTAFF": "Infernal Staff (T4)", "T5_2H_INFERNOSTAFF": "Infernal Staff (T5)",
            "T4_MAIN_FROSTSTAFF": "Frost Staff (T4)", "T5_MAIN_FROSTSTAFF": "Frost Staff (T5)",
            "T6_MAIN_FROSTSTAFF": "Frost Staff (T6)", "T7_MAIN_FROSTSTAFF": "Frost Staff (T7)",
            "T8_MAIN_FROSTSTAFF": "Frost Staff (T8)",
        },
    },
    "weapons_hammers": {
        "name": "Hammers",
        "items": {
            "T4_2H_HAMMER": "Great Hammer (T4)", "T5_2H_HAMMER": "Great Hammer (T5)",
            "T6_2H_HAMMER": "Great Hammer (T6)", "T7_2H_HAMMER": "Great Hammer (T7)",
            "T8_2H_HAMMER": "Great Hammer (T8)",
            "T4_MAIN_HAMMER": "Hammer (T4)", "T5_MAIN_HAMMER": "Hammer (T5)",
        },
    },
    "weapons_maces": {
        "name": "Maces",
        "items": {
            "T4_2H_MACE": "Heavy Mace (T4)", "T5_2H_MACE": "Heavy Mace (T5)",
            "T6_2H_MACE": "Heavy Mace (T6)", "T7_2H_MACE": "Heavy Mace (T7)",
            "T8_2H_MACE": "Heavy Mace (T8)",
            "T4_MAIN_MACE": "Mace (T4)", "T5_MAIN_MACE": "Mace (T5)",
        },
    },
    "weapons_daggers": {
        "name": "Daggers",
        "items": {
            "T4_2H_DAGGERPAIR": "Dagger Pair (T4)", "T5_2H_DAGGERPAIR": "Dagger Pair (T5)",
            "T6_2H_DAGGERPAIR": "Dagger Pair (T6)", "T7_2H_DAGGERPAIR": "Dagger Pair (T7)",
            "T8_2H_DAGGERPAIR": "Dagger Pair (T8)",
            "T4_MAIN_DAGGER": "Dagger (T4)", "T5_MAIN_DAGGER": "Dagger (T5)",
            "T4_2H_CLAWPAIR": "Claw Pair (T4)", "T5_2H_CLAWPAIR": "Claw Pair (T5)",
        },
    },
    "weapons_spears": {
        "name": "Spears",
        "items": {
            "T4_2H_SPEAR": "Spear (T4)", "T5_2H_SPEAR": "Spear (T5)",
            "T6_2H_SPEAR": "Spear (T6)", "T7_2H_SPEAR": "Spear (T7)",
            "T8_2H_SPEAR": "Spear (T8)",
            "T4_2H_GLAIVE": "Glaive (T4)", "T5_2H_GLAIVE": "Glaive (T5)",
        },
    },
    "armor_cloth": {
        "name": "Cloth Armor",
        "items": {
            "T4_HEAD_CLOTH_SET1": "Cloth Helm (T4 A)", "T5_HEAD_CLOTH_SET1": "Cloth Helm (T5 A)",
            "T6_HEAD_CLOTH_SET1": "Cloth Helm (T6 A)", "T7_HEAD_CLOTH_SET1": "Cloth Helm (T7 A)",
            "T8_HEAD_CLOTH_SET1": "Cloth Helm (T8 A)",
            "T4_ARMOR_CLOTH_SET1": "Cloth Armor (T4 A)", "T5_ARMOR_CLOTH_SET1": "Cloth Armor (T5 A)",
            "T6_ARMOR_CLOTH_SET1": "Cloth Armor (T6 A)", "T7_ARMOR_CLOTH_SET1": "Cloth Armor (T7 A)",
            "T8_ARMOR_CLOTH_SET1": "Cloth Armor (T8 A)",
            "T4_SHOES_CLOTH_SET1": "Cloth Shoes (T4 A)", "T5_SHOES_CLOTH_SET1": "Cloth Shoes (T5 A)",
            "T6_SHOES_CLOTH_SET1": "Cloth Shoes (T6 A)", "T7_SHOES_CLOTH_SET1": "Cloth Shoes (T7 A)",
            "T8_SHOES_CLOTH_SET1": "Cloth Shoes (T8 A)",
        },
    },
    "armor_leather": {
        "name": "Leather Armor",
        "items": {
            "T4_HEAD_LEATHER_SET1": "Leather Helm (T4 A)", "T5_HEAD_LEATHER_SET1": "Leather Helm (T5 A)",
            "T6_HEAD_LEATHER_SET1": "Leather Helm (T6 A)", "T7_HEAD_LEATHER_SET1": "Leather Helm (T7 A)",
            "T8_HEAD_LEATHER_SET1": "Leather Helm (T8 A)",
            "T4_ARMOR_LEATHER_SET1": "Leather Armor (T4 A)", "T5_ARMOR_LEATHER_SET1": "Leather Armor (T5 A)",
            "T6_ARMOR_LEATHER_SET1": "Leather Armor (T6 A)", "T7_ARMOR_LEATHER_SET1": "Leather Armor (T7 A)",
            "T8_ARMOR_LEATHER_SET1": "Leather Armor (T8 A)",
            "T4_SHOES_LEATHER_SET1": "Leather Shoes (T4 A)", "T5_SHOES_LEATHER_SET1": "Leather Shoes (T5 A)",
            "T6_SHOES_LEATHER_SET1": "Leather Shoes (T6 A)", "T7_SHOES_LEATHER_SET1": "Leather Shoes (T7 A)",
            "T8_SHOES_LEATHER_SET1": "Leather Shoes (T8 A)",
        },
    },
    "armor_plate": {
        "name": "Plate Armor",
        "items": {
            "T4_HEAD_PLATE_SET1": "Plate Helm (T4 A)", "T5_HEAD_PLATE_SET1": "Plate Helm (T5 A)",
            "T6_HEAD_PLATE_SET1": "Plate Helm (T6 A)", "T7_HEAD_PLATE_SET1": "Plate Helm (T7 A)",
            "T8_HEAD_PLATE_SET1": "Plate Helm (T8 A)",
            "T4_ARMOR_PLATE_SET1": "Plate Armor (T4 A)", "T5_ARMOR_PLATE_SET1": "Plate Armor (T5 A)",
            "T6_ARMOR_PLATE_SET1": "Plate Armor (T6 A)", "T7_ARMOR_PLATE_SET1": "Plate Armor (T7 A)",
            "T8_ARMOR_PLATE_SET1": "Plate Armor (T8 A)",
            "T4_SHOES_PLATE_SET1": "Plate Shoes (T4 A)", "T5_SHOES_PLATE_SET1": "Plate Shoes (T5 A)",
            "T6_SHOES_PLATE_SET1": "Plate Shoes (T6 A)", "T7_SHOES_PLATE_SET1": "Plate Shoes (T7 A)",
            "T8_SHOES_PLATE_SET1": "Plate Shoes (T8 A)",
        },
    },
    "resources_wood": {
        "name": "Wood",
        "items": {
            "T4_WOOD": "Birch Logs (T4)", "T5_WOOD": "Chestnut Logs (T5)",
            "T6_WOOD": "Pine Logs (T6)", "T7_WOOD": "Blackbark Logs (T7)",
            "T8_WOOD": "Ashenbark Logs (T8)",
            "T4_WOOD_LEVEL1": "Birch Planks (T4@1)", "T5_WOOD_LEVEL1": "Chestnut Planks (T5@1)",
            "T4_WOOD_LEVEL2": "Birch Planks (T4@2)", "T5_WOOD_LEVEL2": "Chestnut Planks (T5@2)",
            "T4_WOOD_LEVEL3": "Birch Planks (T4@3)", "T5_WOOD_LEVEL3": "Chestnut Planks (T5@3)",
        },
    },
    "resources_rock": {
        "name": "Stone",
        "items": {
            "T4_ROCK": "Limestone (T4)", "T5_ROCK": "Sandstone (T5)",
            "T6_ROCK": "Travertine (T6)", "T7_ROCK": "Granite (T7)",
            "T8_ROCK": "Slate (T8)",
            "T4_ROCK_LEVEL1": "Limestone Block (T4@1)", "T5_ROCK_LEVEL1": "Sandstone Block (T5@1)",
            "T4_ROCK_LEVEL2": "Limestone Block (T4@2)", "T5_ROCK_LEVEL2": "Sandstone Block (T5@2)",
            "T4_ROCK_LEVEL3": "Limestone Block (T4@3)", "T5_ROCK_LEVEL3": "Sandstone Block (T5@3)",
        },
    },
    "resources_fiber": {
        "name": "Fiber",
        "items": {
            "T4_FIBER": "Cotton (T4)", "T5_FIBER": "Flax (T5)",
            "T6_FIBER": "Hemp (T6)", "T7_FIBER": "Skyflower (T7)",
            "T8_FIBER": "Redleaf Cotton (T8)",
            "T4_FIBER_LEVEL1": "Cotton Yarn (T4@1)", "T5_FIBER_LEVEL1": "Linen (T5@1)",
            "T4_FIBER_LEVEL2": "Cotton Yarn (T4@2)", "T5_FIBER_LEVEL2": "Linen (T5@2)",
            "T4_FIBER_LEVEL3": "Cotton Yarn (T4@3)", "T5_FIBER_LEVEL3": "Linen (T5@3)",
        },
    },
    "resources_hide": {
        "name": "Hide",
        "items": {
            "T4_HIDE": "Thin Hide (T4)", "T5_HIDE": "Medium Hide (T5)",
            "T6_HIDE": "Thick Hide (T6)", "T7_HIDE": "Robust Hide (T7)",
            "T8_HIDE": "Thick Hide (T8)",
            "T4_HIDE_LEVEL1": "Thin Leather (T4@1)", "T5_HIDE_LEVEL1": "Medium Leather (T5@1)",
            "T4_HIDE_LEVEL2": "Thin Leather (T4@2)", "T5_HIDE_LEVEL2": "Medium Leather (T5@2)",
            "T4_HIDE_LEVEL3": "Thin Leather (T4@3)", "T5_HIDE_LEVEL3": "Medium Leather (T5@3)",
        },
    },
    "resources_ore": {
        "name": "Ore",
        "items": {
            "T4_ORE": "Copper Ore (T4)", "T5_ORE": "Tin Ore (T5)",
            "T6_ORE": "Iron Ore (T6)", "T7_ORE": "Titanium Ore (T7)",
            "T8_ORE": "Runite Ore (T8)",
            "T4_ORE_LEVEL1": "Copper Bar (T4@1)", "T5_ORE_LEVEL1": "Steel Bar (T5@1)",
            "T4_ORE_LEVEL2": "Copper Bar (T4@2)", "T5_ORE_LEVEL2": "Steel Bar (T5@2)",
            "T4_ORE_LEVEL3": "Copper Bar (T4@3)", "T5_ORE_LEVEL3": "Steel Bar (T5@3)",
        },
    },
    "mounts": {
        "name": "Mounts",
        "items": {
            "T3_MOUNT_HORSE": "Riding Horse (T3)", "T4_MOUNT_HORSE": "Armored Horse (T4)",
            "T5_MOUNT_HORSE": "Armored Horse (T5)", "T6_MOUNT_HORSE": "Armored Horse (T6)",
            "T7_MOUNT_HORSE": "Armored Horse (T7)", "T8_MOUNT_HORSE": "Armored Horse (T8)",
            "T4_MOUNT_OX": "Transport Ox (T4)", "T5_MOUNT_OX": "Transport Ox (T5)",
            "T6_MOUNT_OX": "Transport Ox (T6)", "T7_MOUNT_OX": "Transport Ox (T7)",
            "T8_MOUNT_OX": "Transport Ox (T8)",
            "T4_MOUNT_DIREWOLF": "Direwolf (T4)", "T5_MOUNT_DIREWOLF": "Direwolf (T5)",
            "T6_MOUNT_DIREWOLF": "Direwolf (T6)", "T7_MOUNT_DIREWOLF": "Direwolf (T7)",
            "T8_MOUNT_DIREWOLF": "Direwolf (T8)",
            "T5_MOUNT_DIREBOAR": "Direboar (T5)", "T6_MOUNT_DIREBOAR": "Direboar (T6)",
            "T7_MOUNT_DIREBOAR": "Direboar (T7)", "T8_MOUNT_DIREBOAR": "Direboar (T8)",
            "T5_MOUNT_SWAMPDRAGON": "Swamp Dragon (T5)", "T6_MOUNT_SWAMPDRAGON": "Swamp Dragon (T6)",
            "T7_MOUNT_SWAMPDRAGON": "Swamp Dragon (T7)", "T8_MOUNT_SWAMPDRAGON": "Swamp Dragon (T8)",
        },
    },
    "consumables": {
        "name": "Consumables",
        "items": {
            "T4_POTION_HEAL": "Healing Potion (T4)", "T5_POTION_HEAL": "Healing Potion (T5)",
            "T6_POTION_HEAL": "Healing Potion (T6)", "T7_POTION_HEAL": "Healing Potion (T7)",
            "T8_POTION_HEAL": "Healing Potion (T8)",
            "T4_POTION_ENERGY": "Energy Potion (T4)", "T5_POTION_ENERGY": "Energy Potion (T5)",
            "T4_FOOK_STEW": "Stew (T4)", "T5_FOOK_STEW": "Stew (T5)",
            "T6_FOOD_STEW": "Stew (T6)", "T7_FOOD_STEW": "Stew (T7)",
            "T8_FOOD_STEW": "Stew (T8)",
            "T4_FOOD_SANDWICH": "Sandwich (T4)", "T5_FOOD_SANDWICH": "Sandwich (T5)",
            "T6_FOOD_SANDWICH": "Sandwich (T6)", "T7_FOOD_SANDWICH": "Sandwich (T7)",
            "T8_FOOD_SANDWICH": "Sandwich (T8)",
        },
    },
    "artifacts": {
        "name": "Artifacts",
        "items": {
            "T4_SOUL": "Soul (T4)", "T5_SOUL": "Soul (T5)",
            "T6_SOUL": "Soul (T6)", "T7_SOUL": "Soul (T7)",
            "T8_SOUL": "Soul (T8)",
            "T4_RELIC": "Relic (T4)", "T5_RELIC": "Relic (T5)",
            "T6_RELIC": "Relic (T6)", "T7_RELIC": "Relic (T7)",
            "T8_RELIC": "Relic (T8)",
            "T4_SHARD_AVALONIAN": "Avalonian Shard (T4)", "T5_SHARD_AVALONIAN": "Avalonian Shard (T5)",
        },
    },
}

# Flatten all item IDs for quick lookup
ALL_ITEMS_FLAT = {}
for cat_key, cat in POPULAR_ITEMS.items():
    for item_id, item_name in cat["items"].items():
        ALL_ITEMS_FLAT[item_id] = {"name": item_name, "category": cat_key, "category_name": cat["name"]}

# Major trade cities
TRADE_CITIES = [
    "Caerleon", "Bridgewatch", "Fort Sterling", "Lymhurst", "Martlock",
    "Thetford", "Brecilien"
]

# All qualities
QUALITIES = [
    {"id": 0, "name": "All Qualities"},
    {"id": 1, "name": "Normal"},
    {"id": 2, "name": "Good"},
    {"id": 3, "name": "Outstanding"},
    {"id": 4, "name": "Excellent"},
    {"id": 5, "name": "Masterpiece"},
]


# Simple in-memory cache for API responses
_api_cache = {}
_CACHE_TTL = 120  # seconds (2 min cache to reduce API calls)

def api_request(endpoint, server=DEFAULT_SERVER, params=None):
    """Make a request to the Albion Online Data API, with retry and caching."""
    base = API_BASES.get(server, API_BASES[DEFAULT_SERVER])
    url = base + endpoint
    if params:
        qs = urllib.parse.urlencode(params)
        url = url + '?' + qs
    
    # Check cache first
    cache_key = url
    now = datetime.now().timestamp()
    if cache_key in _api_cache:
        cached_time, cached_data = _api_cache[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_data
    
    # Retry with backoff on 429
    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'AlbionToolkit/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read().decode('utf-8')
                result = json.loads(data)
                _api_cache[cache_key] = (now, result)
                return result
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                import time
                time.sleep((attempt + 1) * 5)
                continue
            return {"error": "HTTP error: " + str(e.code)}
        except urllib.error.URLError as e:
            return {"error": "URL error: " + str(e.reason)}
        except Exception as e:
            return {"error": str(e)}
    
    return {"error": "Rate limited by API. Please wait and try again."}


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/items")
def get_items():
    """Get all popular items organized by category."""
    return jsonify(POPULAR_ITEMS)


@app.route("/api/item-lookup")
def item_lookup():
    """Look up a specific item by ID."""
    item_id = request.args.get("id", "").upper()
    if item_id in ALL_ITEMS_FLAT:
        return jsonify({"found": True, **ALL_ITEMS_FLAT[item_id]})
    # Return the ID itself if not in our catalog
    return jsonify({"found": False, "name": item_id, "category": "unknown", "category_name": "Unknown"})


@app.route("/api/cities")
def get_cities():
    """Get all trade cities."""
    return jsonify(TRADE_CITIES)


@app.route("/api/qualities")
def get_qualities():
    """Get quality levels."""
    return jsonify(QUALITIES)


@app.route("/api/prices")
def get_prices():
    """Get current prices for items."""
    items = request.args.get("items", "")
    cities = request.args.get("cities", ",".join(TRADE_CITIES))
    quality = request.args.get("quality", "1")
    server = request.args.get("server", DEFAULT_SERVER)

    params = {"locations": cities}
    if quality and quality != "0":
        params["qualities"] = quality

    result = api_request(f"/api/v2/stats/prices/{items}.json", server=server, params=params)
    return jsonify(result)


@app.route("/api/history")
def get_history():
    """Get historical prices for items."""
    items = request.args.get("items", "")
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")
    cities = request.args.get("cities", ",".join(TRADE_CITIES))
    quality = request.args.get("quality", "1")
    time_scale = request.args.get("time_scale", "24")
    server = request.args.get("server", DEFAULT_SERVER)

    params = {"locations": cities, "time-scale": time_scale}
    if quality and quality != "0":
        params["qualities"] = quality
    if start_date:
        params["date"] = start_date
    if end_date:
        params["end_date"] = end_date

    result = api_request(f"/api/v2/stats/history/{items}.json", server=server, params=params)
    return jsonify(result)


@app.route("/api/charts")
def get_charts():
    """Get chart data for items."""
    items = request.args.get("items", "")
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")
    cities = request.args.get("cities", ",".join(TRADE_CITIES))
    quality = request.args.get("quality", "1")
    time_scale = request.args.get("time_scale", "24")
    server = request.args.get("server", DEFAULT_SERVER)

    params = {"locations": cities, "time-scale": time_scale}
    if quality and quality != "0":
        params["qualities"] = quality
    if start_date:
        params["date"] = start_date
    if end_date:
        params["end_date"] = end_date

    result = api_request(f"/api/v2/stats/charts/{items}.json", server=server, params=params)
    return jsonify(result)


@app.route("/api/gold")
def get_gold():
    """Get gold prices."""
    count = request.args.get("count", "100")
    server = request.args.get("server", DEFAULT_SERVER)

    params = {"count": count}

    result = api_request("/api/v2/stats/gold.json", server=server, params=params)
    return jsonify(result)


@app.route("/api/profit-scan")
def profit_scan():
    """Scan for profitable item flips between cities."""
    items = request.args.get("items", "")
    quality = request.args.get("quality", "1")
    min_profit = int(request.args.get("min_profit", "1000"))
    server = request.args.get("server", DEFAULT_SERVER)

    params = {"locations": ",".join(TRADE_CITIES)}
    if quality and quality != "0":
        params["qualities"] = quality

    data = api_request(f"/api/v2/stats/prices/{items}.json", server=server, params=params)

    if isinstance(data, dict) and "error" in data:
        return jsonify(data)

    # Find profitable spreads
    opportunities = {}
    for entry in data:
        item_id = entry["item_id"]
        city = entry["city"]
        sell_min = entry.get("sell_price_min", 0)
        buy_max = entry.get("buy_price_max", 0)

        if item_id not in opportunities:
            opportunities[item_id] = {"name": ALL_ITEMS_FLAT.get(item_id, {}).get("name", item_id), "cities": {}}

        opportunities[item_id]["cities"][city] = {
            "sell_min": sell_min,
            "sell_min_date": entry.get("sell_price_min_date", ""),
            "buy_max": buy_max,
            "buy_max_date": entry.get("buy_price_max_date", ""),
        }

    # Aggregate: for each item, find best sell_min and buy_max per city
    aggregated = {}
    for item_id, item_data in opportunities.items():
        for city, city_data in item_data["cities"].items():
            if city_data["sell_min"] > 0 or city_data["buy_max"] > 0:
                key = (item_id, city)
                if key not in aggregated:
                    aggregated[key] = {"sell_min": float('inf'), "buy_max": 0}
                if city_data["sell_min"] > 0:
                    aggregated[key]["sell_min"] = min(aggregated[key]["sell_min"], city_data["sell_min"])
                if city_data["buy_max"] > 0:
                    aggregated[key]["buy_max"] = max(aggregated[key]["buy_max"], city_data["buy_max"])

    # Calculate best flips using aggregated data
    flips = []
    for (item_id, buy_city), buy_agg in aggregated.items():
        for (item_id2, sell_city), sell_agg in aggregated.items():
            if item_id != item_id2 or buy_city == sell_city:
                continue
            buy_price = buy_agg["sell_min"]
            sell_price = sell_agg["buy_max"]
            if buy_price != float('inf') and sell_price > 0:
                profit = sell_price - buy_price
                margin = (profit / buy_price * 100) if buy_price > 0 else 0
                if profit >= min_profit:
                    flips.append({
                        "item_id": item_id,
                        "item_name": opportunities[item_id]["name"],
                        "buy_city": buy_city,
                        "buy_price": buy_price,
                        "sell_city": sell_city,
                        "sell_price": sell_price,
                        "profit": profit,
                        "margin": round(margin, 1),
                    })

    flips.sort(key=lambda x: x["profit"], reverse=True)
    return jsonify(flips)


if __name__ == "__main__":
    import os, socket
    from werkzeug.serving import make_server
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(5)
    
    srv = make_server(host, port, app, fd=sock.fileno())
    print(f"Server running on http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}")
    srv.serve_forever()
