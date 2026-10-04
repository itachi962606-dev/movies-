# MoviesHub (Flask)
See the chat instructions. Quick start (Windows):
  python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
  copy .env.example .env   (then edit it)
  flask --app app create-admin
  python app.py            -> http://127.0.0.1:5000  (admin: /admin)
International catalogue: node --env-file=.env scripts/update-movies.js
