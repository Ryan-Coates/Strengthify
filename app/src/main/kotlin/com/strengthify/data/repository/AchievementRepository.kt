package com.strengthify.data.repository

import com.strengthify.data.db.AchievementDao
import com.strengthify.data.db.SetEntryDao
import com.strengthify.data.db.WorkoutSessionDao
import com.strengthify.data.model.Achievement
import com.strengthify.data.model.AchievementId
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.data.model.Sex
import com.strengthify.data.model.UserProfile
import com.strengthify.domain.AchievementEngine
import com.strengthify.domain.BenchmarkEngine
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AchievementRepository @Inject constructor(
    private val achievementDao: AchievementDao,
    private val sessionDao: WorkoutSessionDao,
    private val setDao: SetEntryDao,
) {
    fun observeAll(): Flow<List<Achievement>> = achievementDao.observeAll()

    /**
     * Evaluates and saves any newly earned achievements after a session completes.
     * Returns the list of newly earned AchievementIds so they can be shown in the Results screen.
     */
    suspend fun evaluateAndSave(
        profile: UserProfile,
        personalBests: Map<String, Float>,
    ): List<AchievementId> {
        val alreadyEarned = achievementDao.getAll().map { it.id }.toSet()
        val totalSessions = sessionDao.count()
        val totalSets     = setDao.count()

        val sex = Sex.valueOf(profile.sex)
        val highestTier = Lift.entries
            .mapNotNull { lift ->
                val oneRm    = personalBests[lift.name] ?: return@mapNotNull null
                val benchKg  = BenchmarkEngine.benchmarkKg(lift, sex, profile.ageYears, profile.bodyweightKg)
                BenchmarkEngine.tier(oneRm, benchKg)
            }
            .maxByOrNull { it.ordinal } ?: BenchmarkTier.BEGINNER

        val ctx = AchievementEngine.AchievementContext(
            totalSessions      = totalSessions,
            totalSetsLogged    = totalSets,
            currentStreak      = profile.currentStreak,
            currentLevel       = profile.level,
            totalXp            = profile.totalXp,
            highestTierEver    = highestTier,
            distinctLiftsLogged = setDao.countDistinctLifts(),
            totalPersonalBests  = personalBests.size,
            alreadyEarned       = alreadyEarned,
        )

        val newly = AchievementEngine.evaluate(ctx)
        val today = LocalDate.now().toString()
        newly.forEach { id ->
            achievementDao.insert(Achievement(id = id.name, earnedDate = today))
        }
        return newly
    }
}
