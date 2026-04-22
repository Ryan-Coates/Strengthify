package com.strengthify.domain

import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.SetEntry

object XpEngine {

    private const val BASE_XP_PER_SET = 10
    private const val PERSONAL_BEST_BONUS = 50
    private const val MAX_STREAK_MULTIPLIER = 2.0f
    private const val STREAK_MULTIPLIER_PER_DAY = 0.05f

    private val tierBonus = mapOf(
        BenchmarkTier.NOVICE       to 10,
        BenchmarkTier.INTERMEDIATE to 25,
        BenchmarkTier.ADVANCED     to 50,
        BenchmarkTier.ELITE        to 100,
    )

    /** Epley one-rep max estimate. */
    fun epleyOneRm(weightKg: Float, reps: Int): Float {
        if (reps <= 0) return 0f
        if (reps == 1) return weightKg
        return weightKg * (1f + reps / 30f)
    }

    /** XP threshold (cumulative) required to BE at the given level. */
    fun thresholdForLevel(level: Int): Int {
        if (level <= 1) return 0
        return 100 * (level - 1) * (level - 1)
    }

    data class XpBreakdown(
        val baseXp: Int,
        val pbBonus: Int,
        val tierBonus: Int,
        val total: Int,
        val streakMultiplier: Float,
        val newPersonalBestLifts: List<String>,
    )

    /**
     * Calculates XP for a completed session.
     *
     * @param sets           All sets logged in the session.
     * @param existingPbs    Map of lift name → current best estimated 1RM (before this session).
     * @param topTier        The highest benchmark tier achieved across all lifts in the session.
     * @param streakDays     Current streak (before this session).
     * @param date           Today's date string ("YYYY-MM-DD").
     */
    fun calculate(
        sets: List<SetEntry>,
        existingPbs: Map<String, Float>,
        topTier: BenchmarkTier,
        streakDays: Int,
        date: String,
    ): XpBreakdown {
        var base = 0
        var pbBonus = 0
        val newPbLifts = mutableListOf<String>()

        // Track best 1RM per lift seen so far in this session (to avoid double-counting)
        val sessionBest = mutableMapOf<String, Float>()

        for (set in sets) {
            base += BASE_XP_PER_SET
            val oneRm = epleyOneRm(set.weightKg, set.reps)
            val prevBest = maxOf(existingPbs[set.lift] ?: 0f, sessionBest[set.lift] ?: 0f)
            if (oneRm > prevBest) {
                if (sessionBest[set.lift] == null) {
                    // First time beating PB for this lift this session
                    pbBonus += PERSONAL_BEST_BONUS
                    newPbLifts += set.lift
                }
                sessionBest[set.lift] = oneRm
            } else {
                sessionBest[set.lift] = maxOf(sessionBest[set.lift] ?: 0f, oneRm)
            }
        }

        val tier = tierBonus[topTier] ?: 0
        val multiplier = minOf(
            MAX_STREAK_MULTIPLIER,
            1f + streakDays * STREAK_MULTIPLIER_PER_DAY
        )
        val total = ((base + pbBonus + tier) * multiplier).toInt()

        return XpBreakdown(base, pbBonus, tier, total, multiplier, newPbLifts)
    }
}
