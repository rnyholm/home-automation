from flask import Blueprint, jsonify
import sqlite3
import ipaddress
import os

# Create a specific blueprint for Shelly
# All URL:s will automatically start with /shelly
shelly_bp = Blueprint('shelly_manager', __name__, url_prefix='/shelly')

# Database file specific for the Shelly IP-addresses
DB_FILE = "shelly_registry.db"

# Start IP-address for the Shelly units
START_IP = "192.168.10.20"

def init_shelly_db():
    """Creating database for Shelly IP-address register if not existing."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shelly_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

# Initialise on start
if not os.path.exists(DB_FILE):
    init_shelly_db()

def get_last_shelly_entry():
    """Fetch the latest provided Shelly IP-address."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT ip_address, assigned_at FROM shelly_devices ORDER BY id DESC LIMIT 1')
        row = cursor.fetchone()
        return row if row else None

def save_shelly_ip(ip_str):
    """Register a new Shelly IP-address."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO shelly_devices (ip_address) VALUES (?)', (ip_str,))
        conn.commit()

# --- API Endpoints ---

@shelly_bp.route('/fetchLatestIpAddress', methods=['GET'])
def fetch_latest():
    """Fetches the latest taken Shelly IP-address."""
    last_entry = get_last_shelly_entry()
    if last_entry:
        return jsonify({
            "system": "Shelly",
            "latest_taken_ip": last_entry[0],
            "assigned_at": last_entry[1],
            "status": "success"
        })
    else:
        return jsonify({
            "system": "Shelly",
            "message": "No Shelly IP-addresses assigned yet.",
            "start_ip_will_be": START_IP,
            "status": "empty"
        })

@shelly_bp.route('/fetchNextIpAddress', methods=['GET'])
def fetch_next():
    """Providing the next free IP-address to a new Shelly device."""
    last_entry = get_last_shelly_entry()

    if last_entry:
        next_ip_obj = ipaddress.IPv4Address(last_entry[0]) + 1
        next_ip_str = str(next_ip_obj)
    else:
        next_ip_str = START_IP

    save_shelly_ip(next_ip_str)

    return jsonify({
        "system": "Shelly",
        "new_assigned_ip": next_ip_str,
        "message": "IP-address marked as taken for Shelly device",
        "status": "success"
    })
