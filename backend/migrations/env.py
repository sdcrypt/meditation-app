from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.models.favorite import UserFavorite  # noqa: F401
from app.models.meditation import Meditation  # noqa: F401
from app.models.preference import UserPreference  # noqa: F401
from app.models.program import Program, ProgramMeditation, UserProgram  # noqa: F401
from app.models.session import MeditationSession  # noqa: F401
from app.models.user import User  # noqa: F401


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Runtime configuration is authoritative. Escaping percent characters prevents
# ConfigParser from treating URL-encoded values as interpolation directives.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Prepare migration SQL without opening a live database connection."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the configured live database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
