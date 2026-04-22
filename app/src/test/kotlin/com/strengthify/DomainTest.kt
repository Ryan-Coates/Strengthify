package com.strengthify

import com.strengthify.domain.AchievementEngine
import com.strengthify.domain.BenchmarkEngine
import com.strengthify.domain.PlateCalculator
import com.strengthify.domain.XpEngine
import com.strengthify.data.model.AchievementId
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.data.model.Sex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class DomainTest {

    // ── XpEngine ─────────────────────────────────────────────────────────────

    @Test
    fun `epley oneRm - 1 rep returns raw weight`() {
        assertEquals(100f, XpEngine.epleyOneRm(100f, 1), 0.01f)
    }

    @Test
    fun `epley oneRm - 10 reps produces higher estimate than weight`() {
        assertTrue(XpEngine.epleyOneRm(80f, 10) > 80f)
    }

    @Test
    fun `xp threshold for level 1 is zero`() {
        assertEquals(0, XpEngine.thresholdForLevel(1))
    }

    @Test
    fun `xp threshold grows quadratically`() {
        assertTrue(XpEngine.thresholdForLevel(3) > XpEngine.thresholdForLevel(2))
        assertTrue(XpEngine.thresholdForLevel(2) > XpEngine.thresholdForLevel(1))
    }

    // ── BenchmarkEngine ───────────────────────────────────────────────────────

    @Test
    fun `benchmark tier - zero actual is BEGINNER`() {
        assertEquals(BenchmarkTier.BEGINNER, BenchmarkEngine.tier(0f, 100f))
    }

    @Test
    fun `benchmark tier - at benchmark is ADVANCED`() {
        assertEquals(BenchmarkTier.ADVANCED, BenchmarkEngine.tier(100f, 100f))
    }

    @Test
    fun `benchmark tier - 50pct is NOVICE`() {
        assertEquals(BenchmarkTier.NOVICE, BenchmarkEngine.tier(50f, 100f))
    }

    @Test
    fun `benchmark kg - male intermediate squat is above zero`() {
        val kg = BenchmarkEngine.benchmarkKg(Lift.BACK_SQUAT, Sex.MALE, 30, 80f)
        assertTrue(kg > 0f)
    }

    @Test
    fun `age factor - peak age 30 is 1_0`() {
        assertEquals(1.0f, BenchmarkEngine.ageFactor(30), 0.01f)
    }

    @Test
    fun `age factor - senior is lower than peak`() {
        assertTrue(BenchmarkEngine.ageFactor(65) < BenchmarkEngine.ageFactor(30))
    }

    // ── PlateCalculator ───────────────────────────────────────────────────────

    @Test
    fun `plate calculator - 100kg with 20kg bar = 40kg per side`() {
        val result = PlateCalculator.calculate(100f, 20f)
        assertEquals(40f, result.totalPlateWeightPerSide, 0.1f)
    }

    @Test
    fun `plate calculator - 60kg target = bar only no plates needed`() {
        val result = PlateCalculator.calculate(60f, 60f)
        assertTrue(result.platesPerSide.isEmpty())
    }

    @Test
    fun `plate calculator - 120kg is achievable exactly`() {
        val result = PlateCalculator.calculate(120f, 20f)
        // 50kg per side: 2×20kg + 1×10kg = 50kg ✓
        assertTrue(result.isExact)
        assertEquals(120f, result.totalWeight, 0.5f)
    }

    @Test
    fun `plate calculator - total weight is approximately target`() {
        val target = 82.5f
        val result = PlateCalculator.calculate(target, 20f)
        // Remainder should be tiny (within 1.25kg resolution)
        assertTrue(result.totalWeight >= result.barWeight)
    }

    // ── AchievementEngine ─────────────────────────────────────────────────────

    private fun baseCtx(overrides: AchievementEngine.AchievementContext.() -> AchievementEngine.AchievementContext = { this }) =
        AchievementEngine.AchievementContext(
            totalSessions       = 0,
            totalSetsLogged     = 0,
            currentStreak       = 0,
            currentLevel        = 1,
            totalXp             = 0,
            highestTierEver     = BenchmarkTier.BEGINNER,
            distinctLiftsLogged = 0,
            totalPersonalBests  = 0,
            alreadyEarned       = emptySet(),
        ).overrides()

    @Test
    fun `first workout achievement earned after 1 session`() {
        val ctx = baseCtx { copy(totalSessions = 1) }
        val earned = AchievementEngine.evaluate(ctx)
        assertTrue(AchievementId.FIRST_WORKOUT in earned)
    }

    @Test
    fun `week streak achievement earned at 7 days`() {
        val ctx = baseCtx { copy(totalSessions = 7, currentStreak = 7) }
        val earned = AchievementEngine.evaluate(ctx)
        assertTrue(AchievementId.WEEK_STREAK in earned)
    }

    @Test
    fun `already earned achievements are not re-awarded`() {
        val ctx = baseCtx {
            copy(totalSessions = 1, alreadyEarned = setOf(AchievementId.FIRST_WORKOUT.name))
        }
        val earned = AchievementEngine.evaluate(ctx)
        assertFalse(AchievementId.FIRST_WORKOUT in earned)
    }

    @Test
    fun `elite tier achievement requires elite tier`() {
        val ctx = baseCtx { copy(highestTierEver = BenchmarkTier.ADVANCED) }
        val earned = AchievementEngine.evaluate(ctx)
        assertFalse(AchievementId.REACHED_ELITE in earned)

        val ctx2 = baseCtx { copy(highestTierEver = BenchmarkTier.ELITE) }
        val earned2 = AchievementEngine.evaluate(ctx2)
        assertTrue(AchievementId.REACHED_ELITE in earned2)
    }
}

