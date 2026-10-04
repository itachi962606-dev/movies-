import os
from pathlib import Path

import click
from dotenv import load_dotenv
from flask import Flask

from models import Admin, db
from routes.admin import bp as admin_bp
from routes.public import bp as public_bp

load_dotenv()
BASE = Path(__file__).parent


def create_app():
    secret = os.environ.get("FLASK_SECRET_KEY")
    if not secret:
        raise RuntimeError("FLASK_SECRET_KEY is missing. Copy .env.example to .env and set it.")
    app = Flask(__name__)
    (BASE / "database").mkdir(exist_ok=True)
    (BASE / "static" / "uploads").mkdir(parents=True, exist_ok=True)
    app.config.update(
        SECRET_KEY=secret,
        SQLALCHEMY_DATABASE_URI="sqlite:///" + (BASE / "database" / "movieshub.db").as_posix(),
        UPLOAD_FOLDER=str(BASE / "static" / "uploads"),
        MAX_CONTENT_LENGTH=3 * 1024 * 1024,  # 3 MB upload limit
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    db.init_app(app)
    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp)
    with app.app_context():
        db.create_all()

    @app.cli.command("create-admin")
    @click.option("--username", prompt=True)
    @click.password_option()
    def create_admin(username, password):
        """Create (or reset the password of) an admin account."""
        if len(password) < 8:
            raise click.ClickException("Password must be at least 8 characters.")
        admin = Admin.query.filter_by(username=username).first() or Admin(username=username)
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        click.echo(f"Admin '{username}' saved.")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
