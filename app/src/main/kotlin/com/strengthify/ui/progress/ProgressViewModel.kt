package com.strengthify.ui.progress

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.data.model.Sex
import com.strengthify.data.model.UserProfile
import com.strengthify.data.repository.UserRepository
import com.strengthify.data.repository.WorkoutRepository
import com.strengthify.domain.BenchmarkEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import javax.inject.Inject

data class ProgressUiState(
    val profile: UserProfile? = null,
    val selectedLift: Lift = Lift.BACK_SQUAT,
    val oneRmHistory: List<Pair<Int, Float>> = emptyList(),  // (session index, oneRm)
    val personalBestKg: Float = 0f,
    val benchmarkKg: Float = 0f,
    val tier: BenchmarkTier = BenchmarkTier.BEGINNER,
    val percentOfBenchmark: Int = 0,
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ProgressViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val workoutRepository: WorkoutRepository,
) : ViewModel() {

    private val _selectedLift = MutableStateFlow(Lift.BACK_SQUAT)

    val state: StateFlow<ProgressUiState> = combine(
        userRepository.getUserProfile(),
        _selectedLift,
        workoutRepository.observePersonalBests(),
    ) { profile, lift, pbs ->
        Triple(profile, lift, pbs)
    }.flatMapLatest { (profile, lift, pbs) ->
        workoutRepository.observeOneRmHistoryWithDates(lift.name).map { history ->
            val indexedHistory = history.mapIndexed { i, (_, oneRm) -> i + 1 to oneRm }
            val personalBest = pbs[lift.name] ?: 0f
            if (profile == null) {
                ProgressUiState(selectedLift = lift, oneRmHistory = indexedHistory, personalBestKg = personalBest)
            } else {
                val sex = Sex.valueOf(profile.sex)
                val benchKg = BenchmarkEngine.benchmarkKg(lift, sex, profile.ageYears, profile.bodyweightKg)
                ProgressUiState(
                    profile            = profile,
                    selectedLift       = lift,
                    oneRmHistory       = indexedHistory,
                    personalBestKg     = personalBest,
                    benchmarkKg        = benchKg,
                    tier               = BenchmarkEngine.tier(personalBest, benchKg),
                    percentOfBenchmark = BenchmarkEngine.percentOfBenchmark(personalBest, benchKg),
                )
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ProgressUiState())

    fun selectLift(lift: Lift) { _selectedLift.value = lift }
}
