package com.strengthify.di

import android.content.Context
import androidx.room.Room
import com.strengthify.data.db.AchievementDao
import com.strengthify.data.db.PersonalBestDao
import com.strengthify.data.db.SetEntryDao
import com.strengthify.data.db.StrengthifyDatabase
import com.strengthify.data.db.UserProfileDao
import com.strengthify.data.db.WorkoutSessionDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): StrengthifyDatabase =
        Room.databaseBuilder(
            context,
            StrengthifyDatabase::class.java,
            "strengthify.db"
        )
        // During development: wipe and recreate on schema change.
        // Replace with proper Migration objects before shipping to users.
        .fallbackToDestructiveMigration()
        .build()

    @Provides fun provideUserProfileDao(db: StrengthifyDatabase): UserProfileDao =
        db.userProfileDao()

    @Provides fun provideWorkoutSessionDao(db: StrengthifyDatabase): WorkoutSessionDao =
        db.workoutSessionDao()

    @Provides fun provideSetEntryDao(db: StrengthifyDatabase): SetEntryDao =
        db.setEntryDao()

    @Provides fun providePersonalBestDao(db: StrengthifyDatabase): PersonalBestDao =
        db.personalBestDao()

    @Provides fun provideAchievementDao(db: StrengthifyDatabase): AchievementDao =
        db.achievementDao()
}
