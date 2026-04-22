package com.strengthify.data.db

import androidx.room.*
import com.strengthify.data.model.PersonalBest
import kotlinx.coroutines.flow.Flow

@Dao
interface PersonalBestDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(pb: PersonalBest)

    @Query("SELECT * FROM personal_best")
    fun observeAll(): Flow<List<PersonalBest>>

    @Query("SELECT * FROM personal_best")
    suspend fun getAll(): List<PersonalBest>

    @Query("SELECT * FROM personal_best WHERE lift = :lift LIMIT 1")
    suspend fun getByLift(lift: String): PersonalBest?
}
