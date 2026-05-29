"""
Albion Online Toolkit - Windows App
Launches the Flask backend and displays it in a native Windows GUI window.
"""
import sys
import os
import threading
import webview

# Change to the project directory
project_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(project_dir)

# Import the Flask app
from app import app as flask_app


def start_server():
    """Run the Flask server in a background thread."""
    flask_app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)


if __name__ == '__main__':
    # Start Flask server in a daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Create the WebView window
    window = webview.create_window(
        title='Albion Online Toolkit',
        url='http://127.0.0.1:5000',
        width=1400,
        height=900,
        min_size=(1000, 700),
        text_select=True,
    )

    # Start the WebView event loop
    webview.start()
