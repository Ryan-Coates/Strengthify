package com.strengthify.data.repository

import com.strengthify.data.db.UserProfileDao
import com.strengthify.data.model.UserProfile
import com.strengthify.domain.XpEngine
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val dao: UserProfileDao,
) {
    fun getUserProfile(): Flow<UserProfile?> = dao.observe()

    suspend fun saveProfile(profile: UserProfile) = dao.upsert(profile)

    suspend fun applyXp(xpEarned: Int) {
        val profile = dao.get() ?: return
        val newTotalXp = profile.totalXp + xpEarned
        var newLevel = profile.level
        while (newTotalXp >= XpEngine.thresholdForLevel(newLevel + 1)) {
            newLevel++
        }
        dao.updateXpAndLevel(newTotalXp, newLevel)
    }

    suspend fun updateStreak() {
        val profile = dao.get() ?: return
        val today = LocalDate.now().toString()
        val yesterday = LocalDate.now().minusDays(1).toString()

        if (profile.lastWorkoutDate == today) return // already logged today

        val newStreak = if (profile.lastWorkoutDate == yesterday) {
            profile.currentStreak + 1
        } else {
            1
        }
        dao.updateStreak(newStreak, today)
    }

    suspend fun updateBodyweight(kg: Float) = dao.updateBodyweight(kg)

    suspend fun updateAge(age: Int) = dao.updateAge(age)
}
