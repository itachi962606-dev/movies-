import json
import os

from flask import Blueprint, current_app, jsonify, render_template

from models import Notification, TamilMovie, db

bp = Blueprint("public", __name__)


# ---------- Pages ----------
@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/movie")
def movie():
    return render_template("movie.html")


@bp.get("/notifications")
def notifications_page():
    return render_template("notifications.html")

@bp.get("/watchlist")
def watchlist_page():
    return render_template("watchlist.html")


# ---------- Public API ----------
@bp.get("/api/international-movies")
def international_movies():
    """Serves the catalogue written by scripts/update-movies.js (TMDB)."""
    path = os.path.join(current_app.root_path, "data", "movies.json")
    try:
        with open(path, encoding="utf-8") as f:
            catalogue = json.load(f)
        catalogue["movies"] = [
            movie for movie in catalogue.get("movies", [])
            if movie.get("originalLanguage") != "ta" and movie.get("language") != "Tamil"
        ]
        return jsonify(catalogue)
    except (OSError, ValueError):
        return jsonify(error="International catalogue unavailable. Run the TMDB update script."), 503


@bp.get("/api/tamil-movies")
def tamil_movies():
    items = TamilMovie.query.order_by(TamilMovie.created_at.desc()).all()
    path = os.path.join(current_app.root_path, "data", "movies.json")
    try:
        with open(path, encoding="utf-8") as f:
            catalogue = json.load(f)
    except (OSError, ValueError):
        return jsonify(error="Tamil catalogue unavailable. Run the TMDB update script."), 503
    tmdb_movies = [
        {**movie, "id": f"tmdb-{movie['id']}", "source": "tmdb"}
        for movie in catalogue.get("movies", [])
        if movie.get("originalLanguage") == "ta"
    ]
    return jsonify(movies=[m.to_dict() for m in items] + tmdb_movies)


@bp.get("/api/tamil-movies/<movie_id>")
def tamil_movie(movie_id):
    if movie_id.startswith("tmdb-"):
        tmdb_id = movie_id[len("tmdb-"):]
        path = os.path.join(current_app.root_path, "data", "movies.json")
        try:
            with open(path, encoding="utf-8") as f:
                catalogue = json.load(f)
        except (OSError, ValueError):
            return jsonify(error="Tamil catalogue unavailable. Run the TMDB update script."), 503
        movie = next(
            (
                {**item, "id": f"tmdb-{item['id']}", "source": "tmdb"}
                for item in catalogue.get("movies", [])
                if item.get("originalLanguage") == "ta" and str(item.get("id")) == tmdb_id
            ),
            None,
        )
        if movie is None:
            return jsonify(error="Movie not found."), 404
        return jsonify(movie)
    if not movie_id.isdecimal():
        return jsonify(error="Movie not found."), 404
    return jsonify(db.get_or_404(TamilMovie, int(movie_id)).to_dict())


@bp.get("/api/notifications")
def notifications():
    items = Notification.query.order_by(Notification.created_at.desc(), Notification.id.desc()).all()
    return jsonify(notifications=[n.to_dict() for n in items], latestId=items[0].id if items else 0)
