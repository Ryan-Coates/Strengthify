package com.strengthify.data.db

import androidx.room.*
import com.strengthify.data.model.WorkoutSession
import com.strengthify.data.model.WorkoutSessionWithSets
import kotlinx.coroutines.flow.Flow

@Dao
interface WorkoutSessionDao {

    @Insert
    suspend fun insert(session: WorkoutSession): Long

    @Transaction
    @Query("SELECT * FROM workout_session ORDER BY date DESC LIMIT :limit")
    fun observeRecent(limit: Int = 10): Flow<List<WorkoutSessionWithSets>>

    @Transaction
    @Query("SELECT * FROM workout_session WHERE id = :id LIMIT 1")
    suspend fun getWithSets(id: Long): WorkoutSessionWithSets?

    @Query("SELECT COUNT(*) FROM workout_session")
    suspend fun count(): Int

    /** Returns all distinct workout dates ("YYYY-MM-DD") since the given date, newest first. */
    @Query("SELECT DISTINCT date FROM workout_session WHERE date >= :since ORDER BY date DESC")
    suspend fun getDatesSince(since: String): List<String>

    @Query("SELECT DISTINCT date FROM workout_session ORDER BY date DESC")
    fun observeAllDates(): Flow<List<String>>
}
