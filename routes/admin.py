import os
import secrets
from functools import wraps
from urllib.parse import urlparse

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, session, url_for

from models import Admin, Notification, TamilMovie, db

bp = Blueprint("admin", __name__)

GENRES = (
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
    "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance",
    "Science Fiction", "Thriller", "War", "Western", "Other",
)


# ---------- Auth helpers ----------
def admin_page(f):
    """No login required – admin panel is freely accessible."""
    @wraps(f)
    def wrapper(*a, **k):
        # Ensure a dummy admin session exists so API calls work too
        if not session.get("admin_id"):
            session["admin_id"] = 1
        return f(*a, **k)
    return wrapper


def admin_api(f):
    """No login required – admin panel is freely accessible."""
    @wraps(f)
    def wrapper(*a, **k):
        if not session.get("admin_id"):
            session["admin_id"] = 1
        if request.headers.get("X-Requested-With") != "fetch":
            return jsonify(error="Bad request"), 400
        return f(*a, **k)
    return wrapper


# ---------- Validation helpers ----------
def valid_url(u):
    p = urlparse(u)
    return p.scheme in ("http", "https") and bool(p.netloc) and len(u) <= 1000


def save_poster(file):
    """Accept only real PNG/JPG/WEBP images; store under a random filename."""
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    head = file.stream.read(12)
    file.stream.seek(0)
    ok = (
        (ext == "png" and head.startswith(b"\x89PNG"))
        or (ext in ("jpg", "jpeg") and head.startswith(b"\xff\xd8"))
        or (ext == "webp" and head[:4] == b"RIFF" and head[8:12] == b"WEBP")
    )
    if not ok:
        return None
    name = secrets.token_hex(12) + "." + ext
    file.save(os.path.join(current_app.config["UPLOAD_FOLDER"], name))
    return "/static/uploads/" + name


def read_movie_form(existing=None):
    f = request.form
    name = f.get("name", "").strip()
    desc = f.get("description", "").strip()
    year = f.get("release_year", "").strip()
    category = f.get("category", "").strip()
    video = f.get("video_url", "").strip()
    download = f.get("download_url", "").strip()
    poster = f.get("poster_url", "").strip()
    if not name or len(name) > 200:
        return None, "Movie name is required (max 200 characters)."
    if not year.isdigit() or not 1900 <= int(year) <= 2100:
        return None, "Enter a valid release year."
    if len(desc) > 3000 or len(category) > 50:
        return None, "Description or category is too long."
    if category not in GENRES and not (existing and category == existing.category):
        return None, "Select a valid movie genre."
    if not video and existing:
        video = existing.video_url or ""
    if not video and not existing:
        return None, "Video / watch URL is required."
    if video and not valid_url(video):
        return None, "Video / watch URL must be a valid http(s) link."
    if not valid_url(download):
        return None, "Download URL must be a valid http(s) link."
    if not f.get("rights"):
        return None, "Please confirm you are authorized to distribute this file."
    file = request.files.get("poster_file")
    if file and file.filename:
        poster = save_poster(file)
        if not poster:
            return None, "Poster must be a real PNG, JPG or WEBP image (max 3 MB)."
    elif poster.startswith("/static/uploads/") and ".." not in poster:
        pass  # keeping an existing uploaded poster
    elif poster and not valid_url(poster):
        return None, "Poster URL must be a valid http(s) link."
    if not poster and existing:
        poster = existing.poster_url
    if not poster:
        return None, "Upload a poster image or enter a poster URL."
    return dict(name=name, description=desc, release_year=int(year), category=category,
                video_url=video, download_url=download, poster_url=poster), None


# ---------- Pages ----------
@bp.route("/admin/login", methods=["GET", "POST"])
def login():
    # No login required – redirect straight to the dashboard
    session["admin_id"] = 1
    return redirect(url_for("admin.dashboard"))


@bp.post("/admin/logout")
def logout():
    session.clear()
    return redirect(url_for("admin.dashboard"))


@bp.get("/admin")
@admin_page
def dashboard():
    latest = TamilMovie.query.order_by(TamilMovie.created_at.desc()).limit(5).all()
    return render_template("admin/dashboard.html", movie_count=TamilMovie.query.count(),
                           notif_count=Notification.query.count(), latest=latest)


@bp.get("/admin/movies")
@admin_page
def movies():
    items = TamilMovie.query.order_by(TamilMovie.created_at.desc()).all()
    return render_template("admin/movies.html", movies=items)


@bp.get("/admin/movies/new")
@admin_page
def add_movie():
    return render_template("admin/add-movie.html", movie=None, genres=GENRES)


@bp.get("/admin/movies/<int:movie_id>/edit")
@admin_page
def edit_movie(movie_id):
    return render_template(
        "admin/add-movie.html", movie=db.get_or_404(TamilMovie, movie_id), genres=GENRES
    )


@bp.get("/admin/notifications")
@admin_page
def notifications():
    items = Notification.query.order_by(Notification.created_at.desc(), Notification.id.desc()).all()
    return render_template("admin/notifications.html", notifications=items)


# ---------- Admin API ----------
@bp.post("/api/admin/tamil-movies")
@admin_api
def create_movie():
    data, error = read_movie_form()
    if error:
        return jsonify(error=error), 400
    movie = TamilMovie(**data)
    db.session.add(movie)
    db.session.commit()
    return jsonify(movie.to_dict()), 201


@bp.put("/api/admin/tamil-movies/<int:movie_id>")
@admin_api
def update_movie(movie_id):
    movie = db.get_or_404(TamilMovie, movie_id)
    data, error = read_movie_form(existing=movie)
    if error:
        return jsonify(error=error), 400
    for key, value in data.items():
        setattr(movie, key, value)
    db.session.commit()
    return jsonify(movie.to_dict())


@bp.delete("/api/admin/tamil-movies/<int:movie_id>")
@admin_api
def delete_movie(movie_id):
    db.session.delete(db.get_or_404(TamilMovie, movie_id))
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/api/admin/notifications")
@admin_api
def create_notification():
    title = request.form.get("title", "").strip()
    message = request.form.get("message", "").strip()
    if not title or len(title) > 120 or not message or len(message) > 1000:
        return jsonify(error="Title (max 120) and message (max 1000) are required."), 400
    n = Notification(title=title, message=message)
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201


@bp.delete("/api/admin/notifications/<int:notif_id>")
@admin_api
def delete_notification(notif_id):
    db.session.delete(db.get_or_404(Notification, notif_id))
    db.session.commit()
    return jsonify(ok=True)
