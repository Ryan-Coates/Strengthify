package com.strengthify.domain

import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.data.model.Sex

/**
 * Calculates benchmark 1RM targets based on bodyweight, sex and age.
 *
 * Ratios represent the "intermediate" 1RM as a multiple of bodyweight,
 * sourced from Strength Level standards.
 */
object BenchmarkEngine {

    private val maleRatios = mapOf(
        Lift.BACK_SQUAT       to 1.25f,
        Lift.DEADLIFT         to 1.50f,
        Lift.BENCH_PRESS      to 1.00f,
        Lift.OVERHEAD_PRESS   to 0.65f,
        Lift.BARBELL_ROW      to 0.90f,
        Lift.PULL_UP          to 0.75f,
        Lift.DIP              to 0.80f,
        Lift.ROMANIAN_DEADLIFT to 1.10f,
    )

    private val femaleRatios = mapOf(
        Lift.BACK_SQUAT       to 0.85f,
        Lift.DEADLIFT         to 1.00f,
        Lift.BENCH_PRESS      to 0.65f,
        Lift.OVERHEAD_PRESS   to 0.42f,
        Lift.BARBELL_ROW      to 0.60f,
        Lift.PULL_UP          to 0.50f,
        Lift.DIP              to 0.55f,
        Lift.ROMANIAN_DEADLIFT to 0.75f,
    )

    /** Age correction — strength peaks 25–35, declines on both sides. */
    fun ageFactor(age: Int): Float = when {
        age < 18   -> 0.80f
        age <= 24  -> 0.92f
        age <= 35  -> 1.00f
        age <= 45  -> 0.95f
        age <= 55  -> 0.88f
        age <= 65  -> 0.80f
        else       -> 0.72f
    }

    /** Returns the benchmark (intermediate) 1RM in kg. */
    fun benchmarkKg(lift: Lift, sex: Sex, age: Int, bodyweightKg: Float): Float {
        val ratios = if (sex == Sex.MALE) maleRatios else femaleRatios
        val base = (ratios[lift] ?: 1.00f) * bodyweightKg
        return base * ageFactor(age)
    }

    /** Returns which tier the lifter is in based on their estimated 1RM vs the benchmark. */
    fun tier(actualKg: Float, benchmarkKg: Float): BenchmarkTier {
        if (benchmarkKg <= 0f) return BenchmarkTier.BEGINNER
        val ratio = actualKg / benchmarkKg
        return when {
            ratio < 0.50f -> BenchmarkTier.BEGINNER
            ratio < 0.75f -> BenchmarkTier.NOVICE
            ratio < 1.00f -> BenchmarkTier.INTERMEDIATE
            ratio < 1.25f -> BenchmarkTier.ADVANCED
            else          -> BenchmarkTier.ELITE
        }
    }

    /** Percentage of the benchmark reached (capped display at 150%). */
    fun percentOfBenchmark(actualKg: Float, benchmarkKg: Float): Int {
        if (benchmarkKg <= 0f) return 0
        return ((actualKg / benchmarkKg) * 100).toInt()
    }
}
