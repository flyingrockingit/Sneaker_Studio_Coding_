from flask import Flask, jsonify,render_template, request, redirect, url_for, session
from dotenv import load_dotenv
from groq import Groq
import os,json


load_dotenv()
app=Flask(__name__)
app.secret_key="sneaker-studio-dev-key"
import time 
def _next_id():
    session.setdefault ("history_counter",0)
    session["history_counter"] += 1
    return session ["history_counter"]


GROQ_API_KEY=os.environ.get("GROQ_API_KEY","")
HCAPTCHA_SITE_KEY   = os.environ.get("HCAPTCHA_SITE_KEY",
                      "10000000-ffff-ffff-ffff-000000000001")
HCAPTCHA_SECRET_KEY     = os.environ.get("HCAPTCHA_SECRET_KEY",
                      "0x0000000000000000000000000000000000000000")
HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify"

groq_client=Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

DESIGN_PROMPT = """You are an expert sneaker designer. Generate a detailed concept based on:
Style: {style}, Primary Color: {primary_color}, Accent Color: {accent_color},
Material: {material}, Occasion: {occasion}, Inspiration: {inspiration}

Respond with raw JSON only — no markdown, no explanation.
{{"name":"2-4 word creative name","tagline":"punchy tagline max 10 words","description":"2-3 sentence design description","materials":["mat1","mat2","mat3"],"colorways":[{{"name":"colorway name","sole":"#hex","upper":"#hex","accent":"#hex","lace":"#hex","tongue":"#hex"}}],"features":["feat1","feat2","feat3","feat4"],"sole_type":"sole tech description","target_audience":"who this is for","retail_price":"$XXX","style_tags":["tag1","tag2","tag3"]}}
Generate exactly 3 colorways: user colors first, then 2 creative variations. All hex codes must be valid #RRGGBB."""

def get_pref(data):
    fields=[("style","casual"),("primary_color","white"),("accent_color","black"),("material","leather"),("occasion","everyday"),("inspiration","")]
    return{k:data.get(k,d)for k,d in fields}

def generate_concept(prefs):
    if not groq_client:
        raise RuntimeError("GROQ_API_KEY not set.")
    chat = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "Sneaker design expert. Pure JSON only."},
            {"role": "user",   "content": DESIGN_PROMPT.format(**prefs)},
        ],
        temperature=0.85, max_tokens=1200,
    )
    raw = chat.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    return json.loads(raw.strip().rstrip("```").strip())

import requests 
import base64

def generate_image_for_concept(concept, prefs):
    # Generate a sneaker image from the concept and preferences using
    # the Hugging Face inference API.
    # Returns a tuple: (data_url_or_None, error_message_or_None)
    hf_token = os.environ.get("HF_TOKEN", "")
    if not hf_token:
        return None, "HF_TOKEN is not set in environment."

    prompt = (
        f"Product photography of a {prefs.get('material','leather')} sneaker "
        f"for {prefs.get('occasion','everyday')} wear with a {prefs.get('primary_color','white')} "
        f"upper and {prefs.get('accent_color','black')} accents, inspired by {prefs.get('inspiration','modern streetwear')}. "
        "High detail, studio lighting, clean white background, realistic shoe product shot."
    )

    api_url = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell"
    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Accept": "image/jpeg",
    }
    payload = {
        "inputs": prompt,
        "parameters": {
            "width": 512,
            "height": 512,
        },
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        if response.status_code != 200:
            # Capture the real error: HTTP status + whatever the API returned
            try:
                api_msg = response.json()
            except Exception:
                api_msg = response.text[:500]
            return None, f"HF API error {response.status_code}: {api_msg}"
        content_type = response.headers.get("content-type", "image/png")
        image_b64 = base64.b64encode(response.content).decode("utf-8")
        return f"data:{content_type};base64,{image_b64}", None
    except Exception as e:
        return None, f"Request exception: {e}"

def verify_hcaptcha(token):
    try: 
        response = requests.post(HCAPTCHA_VERIFY_URL,data = {
            'secret': HCAPTCHA_SECRET_KEY,
            'response': token 
        }
        ,timeout = 5)
        result = response.json()
        return result.get("success", False)
    except Exception as e:
        return False

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/studio")
def studio():
    # Pass the real site key from the environment into the template.
    # The previous hard-coded string prevented the page from receiving a valid key.
    return render_template("studio.html", hcaptcha_site_key=HCAPTCHA_SITE_KEY)

@app.route("/history")
def history():
    return render_template("history.html", designs=session.get('history', []))

@app.route("/clear_history", methods=["POST"])
def clear_history():
    session.pop('history', None)
    session.pop('history_counter', None)
    return redirect(url_for('history'))

@app.route("/delete/<int:entry_id>", methods=["POST"])
def delete_entry(entry_id):
    history = session.get('history', [])
    session['history'] = [e for e in history if e.get('id') != entry_id]
    session.modified = True
    return redirect(url_for('history'))

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or request.form
    token = data.get("hcaptcha_token", "")

    # Require a valid hCaptcha token before any AI concept generation.
    # Earlier this endpoint accepted requests without captcha validation,
    # which meant bots could call /generate directly and bypass protection.
    if not token:
        return jsonify({"error": "hCaptcha token required."}), 400

    if not verify_hcaptcha(token):
        return jsonify({"error": "hCaptcha verification failed."}), 400

    prefs = get_pref(data)
    try:
        concept = generate_concept(prefs)
        image_url, image_error = generate_image_for_concept(concept, prefs)
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Malformed AI response: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"Concept generation failed: {e}"}), 500
    entry = {
        "id":        _next_id(),
        "timestamp": time.strftime("%b %d, %Y · %H:%M"),
        "concept":   concept,
        "image_url": image_url,
        "prefs":     prefs,
    }
    session.setdefault('history', [])
    session['history'].insert(0, entry)
    session.modified = True
    return jsonify({
        "success": True,
        "concept": concept,
        "image_url": image_url,
        "image_error": image_error,
        "prefs": prefs,
    })

if (__name__)=='__main__':
    app.run(debug=True,port=5000)