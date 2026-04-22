package com.strengthify.data.db

import androidx.room.*
import com.strengthify.data.model.Achievement
import kotlinx.coroutines.flow.Flow

@Dao
interface AchievementDao {

    @Query("SELECT * FROM achievement ORDER BY earnedDate ASC")
    fun observeAll(): Flow<List<Achievement>>

    @Query("SELECT * FROM achievement")
    suspend fun getAll(): List<Achievement>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(achievement: Achievement)

    @Query("SELECT EXISTS(SELECT 1 FROM achievement WHERE id = :id)")
    suspend fun exists(id: String): Boolean
}
