# Pardur App

Web application for managing a D&D campaign — items, timeline, wiki.

**Production URL:** http://vio-private.dyndns.org:3000/

---

## Requirements (prod server)

- Java 21 — https://adoptium.net/
- Maven 3.x — https://maven.apache.org/download.cgi

Both must be on the system PATH. Verify with `java -version` and `mvn -version`.

---

## Deployment

1. Copy the full project folder to the prod server.
2. Stop the legacy Node.js app (port 3000 must be free).
3. Set your database credentials in `start-pardur.bat` (section at the top).
4. Double-click `start-pardur.bat`.

The script will:
- Build a fresh JAR from source (`mvn clean package -DskipTests`)
- Start the app on port 3000 with the production profile

Flyway runs automatically on startup and applies all pending database migrations.

---

## First login

- Username: `admin`
- Password: `4711`

You will be prompted to change the password immediately after login.

---

## Database

- MySQL database: `item_management` (same DB as the legacy app)
- Credentials: configured in `start-pardur.bat`
- Migrations: `backend/src/main/resources/db/migration/` — never edit existing files, only add new ones

### What migrations do to the existing data

All existing items and the admin user are preserved. The notable transformations:

| Migration | Effect |
|-----------|--------|
| V1 | No-op — tables already exist |
| V2 | Renames `items.attribute` → `rarity`; adds `url` column |
| V7 | Migrates rarity values to `item_tags` (e.g. `Rare` → tag `rare`); drops `rarity` column |
| V9 | Adds `role`, `color_hex`, `must_change_password` to `users`; resets admin password |

After the first startup, the legacy Node.js app can no longer be used — the `attribute` column it references no longer exists.

---

## Updating

1. Copy the updated project folder to the prod server (overwrite).
2. Run `start-pardur.bat`.

The script always builds from source. Any new migration scripts are applied automatically on startup.

---

## Architecture

```
pardur-app/
├── backend/                  # Spring Boot (Maven, Java 21)
│   └── src/main/
│       ├── java/com/pardur/ # Controllers, services, repositories, models
│       └── resources/
│           ├── db/migration/ # Flyway migration scripts (V1–V13+)
│           ├── static/       # Frontend (index.html, js/app.js, css/app.css)
│           ├── application.yml
│           ├── application-dev.yml   # H2 in-memory, no Flyway
│           └── application-prod.yml  # MySQL, Flyway enabled, port 3000
├── item-management-list/     # Legacy Node.js prototype — reference only, do not modify
├── start-pardur.bat          # Production startup script
└── README.md
```

---

## Development

Run locally with the dev profile (uses H2 in-memory database, no MySQL needed):

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

App available at http://localhost:8080
