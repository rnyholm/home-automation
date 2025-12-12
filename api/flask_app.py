from flask import Flask, jsonify
# import from shelly_manager
from shelly_ip_address_manager import shelly_bp

app = Flask(__name__)

# Register the Shelly module to the app
app.register_blueprint(shelly_bp)

@app.route('/')
def home():
    return jsonify({
        "status": "Running",
        "description": "A small utility API server for private usage.",
        "available_apis": [
            {
                "name": "Shelly IP-address manager",
                "base_url": "/shelly",
                "methods": ["/fetchLatestIpAddress", "/fetchNextIpAddress"]
            }
        ]
    })
