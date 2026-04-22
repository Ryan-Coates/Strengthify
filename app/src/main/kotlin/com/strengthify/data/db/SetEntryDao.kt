package com.strengthify.data.db

import androidx.room.*
import com.strengthify.data.model.SetEntry
import kotlinx.coroutines.flow.Flow

@Dao
interface SetEntryDao {

    @Insert
    suspend fun insertAll(sets: List<SetEntry>)

    @Query("SELECT * FROM set_entry WHERE sessionId = :sessionId")
    suspend fun getBySession(sessionId: Long): List<SetEntry>

    /** Returns all sets for a given lift, ordered oldest-first (for charting). */
    @Query("""
        SELECT se.* FROM set_entry se
        INNER JOIN workout_session ws ON se.sessionId = ws.id
        WHERE se.lift = :lift
        ORDER BY ws.date ASC
    """)
    fun observeByLift(lift: String): Flow<List<SetEntry>>

    /**
     * Latest sets per lift across all sessions — used to suggest weight/reps
     * for the next workout.
     */
    @Query("""
        SELECT se.* FROM set_entry se
        INNER JOIN workout_session ws ON se.sessionId = ws.id
        WHERE se.lift = :lift
        ORDER BY ws.date DESC
        LIMIT :limit
    """)
    suspend fun getRecentByLift(lift: String, limit: Int = 5): List<SetEntry>

    @Query("SELECT COUNT(*) FROM set_entry")
    suspend fun count(): Int

    @Query("SELECT COUNT(DISTINCT lift) FROM set_entry")
    suspend fun countDistinctLifts(): Int

    /**
     * Flat export query — returns set rows joined with their session date.
     * Used for CSV export.
     */
    @Query("""
        SELECT se.lift, se.weightKg, se.reps, ws.date
        FROM set_entry se
        INNER JOIN workout_session ws ON se.sessionId = ws.id
        ORDER BY ws.date ASC, se.lift ASC
    """)
    suspend fun getAllOrderedByDate(): List<SetWithDate>
}

data class SetWithDate(
    val lift: String,
    val weightKg: Float,
    val reps: Int,
    val date: String,
)
