"""
╔══════════════════════════════════════════════════════════════╗
║  LESSON 1 — Structuring the Interface                        ║
╚══════════════════════════════════════════════════════════════╝

GOAL: Set up Flask, create all routes, and make the UI render.
      No AI yet — just structure and navigation.

YOUR TASKS (app.py):
  1. Import Flask, render_template, load_dotenv
  2. Create the Flask app instance with a secret key
  3. Add route for /  → renders index.html
  4. Add route for /studio → renders studio.html (hcaptcha_site_key="")
  5. Add route for /history → renders history.html (designs=[])

YOUR TASKS (static/js/studio.js):
  6. Wire up chip selection — clicking a chip marks it active
     and updates the hidden input value
  7. Wire up color picker ↔ hex text field sync
  8. Wire up Generate button to show a placeholder message

Run:  python app.py  →  http://localhost:5000
"""

# ── TODO 1: Import Flask, render_template, load_dotenv ────────


# ── TODO 2: Create app instance and set secret key ────────────


# ── TODO 3: Home route — renders index.html ───────────────────


# ── TODO 4: Studio route — renders studio.html ────────────────


# ── TODO 5: History route — renders history.html ──────────────


if __name__ == "__main__":
    # app.run() will work once you complete TODOs 1 and 2 above
    app.run(debug=True, port=5000)
