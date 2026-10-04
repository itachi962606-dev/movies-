from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class TamilMovie(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    poster_url = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, default="")
    release_year = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50), default="Tamil")
    video_url = db.Column(db.String(1000), nullable=False, default="")
    download_url = db.Column(db.String(1000), nullable=False)
    source = db.Column(db.String(20), nullable=False, default="admin")
    created_at = db.Column(db.DateTime, default=now)
    updated_at = db.Column(db.DateTime, default=now, onupdate=now)

    def to_dict(self):
        """Same shape as the TMDB movies so the existing card design works unchanged."""
        return {
            "id": self.id, "title": self.name, "poster": self.poster_url, "backdrop": self.poster_url,
            "description": self.description or "No description available.",
            "year": str(self.release_year), "releaseDate": str(self.release_year),
            "language": "Tamil", "genres": [self.category or "Tamil"], "rating": 0,
            "watchUrl": self.video_url, "downloadUrl": self.download_url,
            "source": self.source, "createdAt": iso(self.created_at),
        }


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=now)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "message": self.message, "createdAt": iso(self.created_at)}
