package com.strengthify.data.db

import androidx.room.*
import com.strengthify.data.model.UserProfile
import kotlinx.coroutines.flow.Flow

@Dao
interface UserProfileDao {

    @Query("SELECT * FROM user_profile WHERE id = 1 LIMIT 1")
    fun observe(): Flow<UserProfile?>

    @Query("SELECT * FROM user_profile WHERE id = 1 LIMIT 1")
    suspend fun get(): UserProfile?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(profile: UserProfile)

    @Query("UPDATE user_profile SET totalXp = :xp, level = :level WHERE id = 1")
    suspend fun updateXpAndLevel(xp: Int, level: Int)

    @Query("""
        UPDATE user_profile
        SET currentStreak = :streak, lastWorkoutDate = :date
        WHERE id = 1
    """)
    suspend fun updateStreak(streak: Int, date: String)

    @Query("UPDATE user_profile SET bodyweightKg = :kg WHERE id = 1")
    suspend fun updateBodyweight(kg: Float)

    @Query("UPDATE user_profile SET ageYears = :age WHERE id = 1")
    suspend fun updateAge(age: Int)
}
