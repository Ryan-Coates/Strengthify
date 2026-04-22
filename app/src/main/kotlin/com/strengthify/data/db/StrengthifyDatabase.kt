package com.strengthify.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.strengthify.data.model.Achievement
import com.strengthify.data.model.PersonalBest
import com.strengthify.data.model.SetEntry
import com.strengthify.data.model.UserProfile
import com.strengthify.data.model.WorkoutSession

@Database(
    entities = [
        UserProfile::class,
        WorkoutSession::class,
        SetEntry::class,
        PersonalBest::class,
        Achievement::class,
    ],
    version = 2,
    exportSchema = false,
)
abstract class StrengthifyDatabase : RoomDatabase() {
    abstract fun userProfileDao(): UserProfileDao
    abstract fun workoutSessionDao(): WorkoutSessionDao
    abstract fun setEntryDao(): SetEntryDao
    abstract fun personalBestDao(): PersonalBestDao
    abstract fun achievementDao(): AchievementDao
}
