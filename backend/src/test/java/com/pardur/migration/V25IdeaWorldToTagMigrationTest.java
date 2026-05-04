package com.pardur.migration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates the world-name-to-tag backfill SQL from V25__ideas_remove_world_id.sql
 * using an in-memory H2 database with a minimal schema matching the pre-migration state.
 */
class V25IdeaWorldToTagMigrationTest {

    Connection conn;

    @BeforeEach
    void setUp() throws Exception {
        conn = DriverManager.getConnection("jdbc:h2:mem:migtest_v25;DB_CLOSE_DELAY=-1", "sa", "");
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE worlds (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL)");
            st.execute("""
                    CREATE TABLE ideas (
                        id       INT PRIMARY KEY,
                        world_id INT,
                        title    VARCHAR(255) NOT NULL
                    )""");
            st.execute("""
                    CREATE TABLE idea_tags (
                        idea_id  INT         NOT NULL,
                        tag_name VARCHAR(80) NOT NULL,
                        PRIMARY KEY (idea_id, tag_name)
                    )""");
        }
    }

    @AfterEach
    void tearDown() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("DROP TABLE IF EXISTS idea_tags");
            st.execute("DROP TABLE IF EXISTS ideas");
            st.execute("DROP TABLE IF EXISTS worlds");
        }
        conn.close();
    }

    @Test
    void addsWorldNameAsTag_whenIdeaHasNoExistingTags() throws Exception {
        insertWorld(1, "Pardur");
        insertIdea(10, 1);

        runBackfill();

        assertThat(tagsForIdea(10)).containsExactly("pardur");
    }

    @Test
    void doesNotDuplicateTag_whenWorldTagAlreadyExists() throws Exception {
        insertWorld(1, "Pardur");
        insertIdea(10, 1);
        insertTag(10, "pardur");

        runBackfill();

        assertThat(tagsForIdea(10)).containsExactly("pardur");
    }

    @Test
    void keepsExistingTags_whenAddingWorldTag() throws Exception {
        insertWorld(1, "Eldorheim");
        insertIdea(10, 1);
        insertTag(10, "dragons");

        runBackfill();

        assertThat(tagsForIdea(10)).containsExactlyInAnyOrder("eldorheim", "dragons");
    }

    @Test
    void lowercasesWorldName() throws Exception {
        insertWorld(1, "Calim Desert");
        insertIdea(10, 1);

        runBackfill();

        assertThat(tagsForIdea(10)).containsExactly("calim desert");
    }

    @Test
    void handlesMultipleIdeasInSameWorld() throws Exception {
        insertWorld(1, "Faerun");
        insertIdea(10, 1);
        insertIdea(11, 1);

        runBackfill();

        assertThat(tagsForIdea(10)).containsExactly("faerun");
        assertThat(tagsForIdea(11)).containsExactly("faerun");
    }

    @Test
    void handlesMultipleIdeasInDifferentWorlds() throws Exception {
        insertWorld(1, "Pardur");
        insertWorld(2, "Eldorheim");
        insertIdea(10, 1);
        insertIdea(11, 2);

        runBackfill();

        assertThat(tagsForIdea(10)).containsExactly("pardur");
        assertThat(tagsForIdea(11)).containsExactly("eldorheim");
    }

    @Test
    void isIdempotent_runningTwiceProducesNoExtras() throws Exception {
        insertWorld(1, "Draigval");
        insertIdea(10, 1);

        runBackfill();
        runBackfill();

        assertThat(tagsForIdea(10)).containsExactly("draigval");
    }

    // ── SQL under test ──────────────────────────────────────────────────────────

    /** Exact INSERT statement that will be used in V25__ideas_remove_world_id.sql. */
    private void runBackfill() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("""
                    INSERT INTO idea_tags (idea_id, tag_name)
                    SELECT i.id, LOWER(w.name)
                    FROM   ideas i
                    JOIN   worlds w ON w.id = i.world_id
                    WHERE  NOT EXISTS (
                               SELECT 1 FROM idea_tags it
                               WHERE  it.idea_id  = i.id
                               AND    it.tag_name = LOWER(w.name)
                           )
                    """);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private void insertWorld(int id, String name) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("INSERT INTO worlds VALUES (?, ?)")) {
            ps.setInt(1, id);
            ps.setString(2, name);
            ps.execute();
        }
    }

    private void insertIdea(int id, int worldId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("INSERT INTO ideas VALUES (?, ?, 'title')")) {
            ps.setInt(1, id);
            ps.setInt(2, worldId);
            ps.execute();
        }
    }

    private void insertTag(int ideaId, String tag) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("INSERT INTO idea_tags VALUES (?, ?)")) {
            ps.setInt(1, ideaId);
            ps.setString(2, tag);
            ps.execute();
        }
    }

    private List<String> tagsForIdea(int ideaId) throws Exception {
        List<String> tags = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT tag_name FROM idea_tags WHERE idea_id = ? ORDER BY tag_name")) {
            ps.setInt(1, ideaId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) tags.add(rs.getString(1));
            }
        }
        return tags;
    }
}
