# Pardur App

A web application for managing a tabletop RPG campaign world — featuring a world timeline with events and a marketplace for items and artefacts.

## Features

- **Timeline (Chronik)** — per-world event timeline with drag-and-drop positioning, type filters, tag filters, and a sidebar for events with unknown dates
- **Marketplace (Marktplatz)** — item catalogue with tag-based filtering, price range search, and sort
- **Multiple worlds** — switch between worlds (e.g. Pardur, Eldorheim); admin can add/rename worlds
- **Creators** — events are attributed to named creators with colour coding
- **Admin mode** — session-based login unlocks add/edit/delete for events and items
- **Dark/light theme** — toggle persisted in localStorage

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.3, Spring Security |
| Persistence | Spring Data JPA (Hibernate), Flyway migrations |
| Database (prod) | MySQL 8 |
| Database (dev) | H2 in-memory |
| Frontend | Vanilla JS, HTML, CSS (no framework) |
| Build | Maven |

## Project Structure

```
pardur-app/
├── backend/
│   ├── src/main/java/com/pardur/
│   │   ├── controller/       # REST endpoints
│   │   ├── service/          # Business logic
│   │   ├── repository/       # JPA repositories
│   │   ├── model/            # JPA entities
│   │   ├── dto/              # Request / response DTOs
│   │   ├── security/         # Spring Security config
│   │   └── exception/        # Global error handling
│   └── src/main/resources/
│       ├── static/           # Frontend (index.html, app.js, app.css)
│       ├── db/migration/     # Flyway scripts (V1–V8)
│       ├── import.sql        # Dev seed data (H2 only)
│       ├── application.yml
│       ├── application-dev.yml
│       └── application-prod.yml
└── item-management-list/     # Legacy Node.js prototype (reference only)
```

## Getting Started

### Prerequisites

- Java 21+
- Maven 3.9+
- MySQL 8 (production) — not needed for local dev

### Local Development (H2, no database setup needed)

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

The app starts on [http://localhost:8080](http://localhost:8080). The H2 console is available at `/h2-console` (JDBC URL: `jdbc:h2:mem:pardurdb`, user: `sa`, no password).

Seed data is loaded automatically from `src/main/resources/import.sql` on every startup.

### Production (MySQL)

Set the following environment variables before starting:

| Variable | Description | Default |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `item_management` |
| `DB_USER` | Database user | `root` |
| `DB_PASSWORD` | Database password | *(required)* |
| `PORT` | HTTP port | `8080` |

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

Flyway runs migrations automatically on startup. Never run `ddl-auto: create` or `update` in production.

### Building a JAR

```bash
cd backend
mvn clean package -DskipTests
java -Dspring.profiles.active=prod -jar target/pardur-*.jar
```

## Database Migrations

Migrations live in `src/main/resources/db/migration/` and are applied by Flyway in version order.

| Version | Description |
|---|---|
| V1 | Baseline schema (items, users, worlds) |
| V2 | Evolve items table |
| V3 | Creators and timeline events |
| V4 | Seed admin user |
| V5 | Add date_label to timeline events |
| V6 | Add characters column to timeline events |
| V7 | Add item_tags table; migrate rarity to tags; drop rarity column |
| V8 | Seed Pardur world and timeline events |

To add a new migration: create `V{n+1}__description.sql`. Never edit existing migration files.

## API Overview

All write endpoints require an active admin session.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/login` | — | Start admin session |
| POST | `/api/logout` | — | End session |
| GET | `/api/auth/status` | — | Check login state |
| GET | `/api/worlds` | — | List worlds |
| POST | `/api/worlds` | admin | Create world |
| GET | `/api/timeline/events?worldId=` | — | List events for a world |
| POST | `/api/timeline/events` | admin | Create event |
| PUT | `/api/timeline/events/{id}` | admin | Update event |
| DELETE | `/api/timeline/events/{id}` | admin | Delete event |
| GET | `/api/items` | — | List all items |
| POST | `/api/items` | admin | Create item |
| PUT | `/api/items/{id}` | admin | Update item |
| DELETE | `/api/items/{id}` | admin | Delete item |
| GET | `/api/items/tags` | — | List all item tags with counts |
| GET | `/api/creators` | — | List creators |

## Running Tests

```bash
cd backend
mvn test
```

Unit tests cover the service layer (ItemService, TimelineService). Integration tests use `@SpringBootTest` with MockMvc.
