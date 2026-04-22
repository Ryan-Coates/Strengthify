package com.strengthify.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.data.model.Sex
import com.strengthify.data.model.UserProfile
import com.strengthify.data.model.WorkoutSessionWithSets
import com.strengthify.data.repository.UserRepository
import com.strengthify.data.repository.WorkoutRepository
import com.strengthify.domain.BenchmarkEngine
import com.strengthify.domain.XpEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

data class LiftBenchmarkCard(
    val lift: Lift,
    val tier: BenchmarkTier,
    val percentOfBenchmark: Int,
    val estimatedOneRmKg: Float,
    val benchmarkKg: Float,
)

data class HomeUiState(
    val profile: UserProfile? = null,
    val level: Int = 1,
    val xpProgress: Float = 0f,         // 0.0–1.0 within current level
    val xpToNextLevel: Int = 0,
    val xpCurrentInLevel: Int = 0,
    val streak: Int = 0,
    val benchmarkCards: List<LiftBenchmarkCard> = emptyList(),
    val recentSessions: List<WorkoutSessionWithSets> = emptyList(),
    val workoutDates: Set<String> = emptySet(),  // for the streak calendar
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    userRepository: UserRepository,
    workoutRepository: WorkoutRepository,
) : ViewModel() {

    val state = combine(
        userRepository.getUserProfile(),
        workoutRepository.observePersonalBests(),
        workoutRepository.observeRecentSessions(5),
        workoutRepository.observeWorkoutDates(),
    ) { profile, pbs, sessions, dates ->
        if (profile == null) return@combine HomeUiState()

        val sex = Sex.valueOf(profile.sex)
        val cards = Lift.entries.map { lift ->
            val actualOneRm = pbs[lift.name] ?: 0f
            val benchKg = BenchmarkEngine.benchmarkKg(lift, sex, profile.ageYears, profile.bodyweightKg)
            LiftBenchmarkCard(
                lift               = lift,
                tier               = BenchmarkEngine.tier(actualOneRm, benchKg),
                percentOfBenchmark = BenchmarkEngine.percentOfBenchmark(actualOneRm, benchKg),
                estimatedOneRmKg   = actualOneRm,
                benchmarkKg        = benchKg,
            )
        }

        val level               = profile.level
        val prevThreshold       = XpEngine.thresholdForLevel(level)
        val nextThreshold       = XpEngine.thresholdForLevel(level + 1)
        val xpInLevel           = profile.totalXp - prevThreshold
        val xpRangeForLevel     = nextThreshold - prevThreshold
        val progress            = if (xpRangeForLevel > 0) xpInLevel.toFloat() / xpRangeForLevel else 1f

        HomeUiState(
            profile            = profile,
            level              = level,
            xpProgress         = progress.coerceIn(0f, 1f),
            xpToNextLevel      = xpRangeForLevel - xpInLevel,
            xpCurrentInLevel   = xpInLevel,
            streak             = profile.currentStreak,
            benchmarkCards     = cards,
            recentSessions     = sessions,
            workoutDates       = dates.toSet(),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState())
}
