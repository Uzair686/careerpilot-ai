"""
CareerPilot AI — Flask Backend
Serves the frontend and handles AI chat via /api/chat.
Author: Muhammad Uzair
"""

import os
from flask import Flask, request, jsonify, send_from_directory
from chatbot import chatbot_response

app = Flask(__name__, static_folder='frontend', static_url_path='/frontend')


# ── Serve frontend ─────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/assets/<path:path>')
def assets(path):
    return send_from_directory('assets', path)


# ── Chat API ───────────────────────────────────────────────────────────────

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Expects JSON:
    {
      "message":     "user message string",
      "history":     [{"role":"user","content":"..."}, ...],   // optional
      "resume_data": { score, skills, missing_skills, ... }    // optional
    }
    Returns JSON:
    {
      "response": "AI reply string"
    }
    """
    try:
        body        = request.get_json(force=True)
        user_msg    = (body.get('message') or '').strip()
        history     = body.get('history') or []
        resume_data = body.get('resume_data') or {}

        if not user_msg:
            return jsonify({'error': 'No message provided'}), 400

        reply = chatbot_response(user_msg, resume_data, history)
        return jsonify({'response': reply})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Health check ────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    import anthropic as _a
    key_ok = bool(os.getenv('ANTHROPIC_API_KEY'))
    return jsonify({'status': 'ok', 'anthropic_key_set': key_ok})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    print(f"\n🚀 CareerPilot AI running at http://localhost:{port}")
    print(f"   Anthropic API key: {'✅ Set' if os.getenv('ANTHROPIC_API_KEY') else '⚠️  Not set (using local fallback)'}\n")
    app.run(host='0.0.0.0', port=port, debug=debug)