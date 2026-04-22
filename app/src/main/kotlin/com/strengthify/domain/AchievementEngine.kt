package com.strengthify.domain

import com.strengthify.data.model.AchievementId
import com.strengthify.data.model.BenchmarkTier

/**
 * Pure logic — determines which achievements are newly earned.
 * Called from AchievementRepository after every session.
 */
object AchievementEngine {

    data class AchievementContext(
        val totalSessions: Int,
        val totalSetsLogged: Int,
        val currentStreak: Int,
        val currentLevel: Int,
        val totalXp: Int,
        val highestTierEver: BenchmarkTier,
        val distinctLiftsLogged: Int,     // count of distinct lifts the user has ever trained
        val totalPersonalBests: Int,      // count of PBs ever recorded
        val alreadyEarned: Set<String>,   // set of AchievementId.name already in DB
    )

    /** Returns the list of newly earned achievement IDs. */
    fun evaluate(ctx: AchievementContext): List<AchievementId> {
        val newly = mutableListOf<AchievementId>()

        fun check(id: AchievementId, condition: Boolean) {
            if (condition && id.name !in ctx.alreadyEarned) newly += id
        }

        check(AchievementId.FIRST_WORKOUT,        ctx.totalSessions >= 1)
        check(AchievementId.FIRST_PERSONAL_BEST,  ctx.totalPersonalBests >= 1)
        check(AchievementId.TRIPLE_STREAK,        ctx.currentStreak >= 3)
        check(AchievementId.WEEK_STREAK,          ctx.currentStreak >= 7)
        check(AchievementId.MONTH_STREAK,         ctx.currentStreak >= 30)
        check(AchievementId.REACHED_NOVICE,       ctx.highestTierEver >= BenchmarkTier.NOVICE)
        check(AchievementId.REACHED_INTERMEDIATE, ctx.highestTierEver >= BenchmarkTier.INTERMEDIATE)
        check(AchievementId.REACHED_ADVANCED,     ctx.highestTierEver >= BenchmarkTier.ADVANCED)
        check(AchievementId.REACHED_ELITE,        ctx.highestTierEver >= BenchmarkTier.ELITE)
        check(AchievementId.ALL_LIFTS_TRAINED,    ctx.distinctLiftsLogged >= 8)
        check(AchievementId.LEVEL_5,              ctx.currentLevel >= 5)
        check(AchievementId.LEVEL_10,             ctx.currentLevel >= 10)
        check(AchievementId.HUNDRED_SETS,         ctx.totalSetsLogged >= 100)
        check(AchievementId.THOUSAND_XP,          ctx.totalXp >= 1_000)

        return newly
    }
}
