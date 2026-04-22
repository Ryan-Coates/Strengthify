package com.strengthify.ui.logging

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.content.Context
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.data.model.Sex
import com.strengthify.data.model.SetEntry
import com.strengthify.data.model.WorkoutSession
import com.strengthify.data.repository.AchievementRepository
import com.strengthify.data.repository.UserRepository
import com.strengthify.data.repository.WorkoutRepository
import com.strengthify.domain.BenchmarkEngine
import com.strengthify.domain.XpEngine
import com.strengthify.ui.widget.WidgetCache
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class SetDraft(
    val weightKg: String = "",
    val reps: String = "",
)

enum class LoggingStep { SELECT_LIFTS, LOG_SETS }

data class RestTimerState(
    val isRunning: Boolean = false,
    val secondsRemaining: Int = 0,
    val durationSeconds: Int = 90,
)

data class LoggingUiState(
    val step: LoggingStep = LoggingStep.SELECT_LIFTS,
    val selectedLifts: List<Lift> = emptyList(),
    val sets: Map<Lift, List<SetDraft>> = emptyMap(),
    val suggestions: Map<Lift, SetDraft> = emptyMap(),
    val restTimer: RestTimerState = RestTimerState(),
    val plateCalcLift: Lift? = null,       // non-null = show plate calculator dialog
    val plateCalcWeight: String = "",
    val isSaving: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LoggingViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val userRepository: UserRepository,
    private val workoutRepository: WorkoutRepository,
    private val achievementRepository: AchievementRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LoggingUiState())
    val state = _state.asStateFlow()

    fun toggleLift(lift: Lift) {
        val current = _state.value.selectedLifts.toMutableList()
        if (lift in current) current.remove(lift) else current.add(lift)
        _state.value = _state.value.copy(selectedLifts = current)
    }

    fun confirmLifts() {
        val lifts = _state.value.selectedLifts
        if (lifts.isEmpty()) {
            _state.value = _state.value.copy(error = "Select at least one lift")
            return
        }
        // Initialise with one empty set row per lift
        val sets = lifts.associateWith { listOf(SetDraft()) }
        _state.value = _state.value.copy(step = LoggingStep.LOG_SETS, sets = sets, error = null)

        // Load suggestions asynchronously
        viewModelScope.launch {
            val suggestions = mutableMapOf<Lift, SetDraft>()
            lifts.forEach { lift ->
                val s = workoutRepository.getSuggestionsForLift(lift.name)
                if (s != null) {
                    suggestions[lift] = SetDraft("${"%.1f".format(s.first)}", "${s.second}")
                }
            }
            _state.value = _state.value.copy(suggestions = suggestions)
        }
    }

    fun addSet(lift: Lift) {
        val current = _state.value.sets.toMutableMap()
        current[lift] = (current[lift] ?: emptyList()) + SetDraft()
        _state.value = _state.value.copy(sets = current)
    }

    fun removeSet(lift: Lift, index: Int) {
        val current = _state.value.sets.toMutableMap()
        val liftSets = current[lift]?.toMutableList() ?: return
        if (liftSets.size > 1) {
            liftSets.removeAt(index)
            current[lift] = liftSets
            _state.value = _state.value.copy(sets = current)
        }
    }

    fun onWeightChange(lift: Lift, index: Int, value: String) {
        updateSet(lift, index) { it.copy(weightKg = value) }
    }

    fun onRepsChange(lift: Lift, index: Int, value: String) {
        updateSet(lift, index) { it.copy(reps = value) }
    }

    private fun updateSet(lift: Lift, index: Int, transform: (SetDraft) -> SetDraft) {
        val current = _state.value.sets.toMutableMap()
        val sets = current[lift]?.toMutableList() ?: return
        if (index in sets.indices) {
            sets[index] = transform(sets[index])
            current[lift] = sets
            _state.value = _state.value.copy(sets = current, error = null)
        }
    }

    // ── Rest timer ─────────────────────────────────────────────────────────────

    private var timerJob: Job? = null

    fun startRestTimer(durationSeconds: Int = 90) {
        timerJob?.cancel()
        _state.value = _state.value.copy(
            restTimer = RestTimerState(isRunning = true, secondsRemaining = durationSeconds, durationSeconds = durationSeconds)
        )
        timerJob = viewModelScope.launch {
            var remaining = durationSeconds
            while (remaining > 0) {
                delay(1_000)
                remaining--
                _state.value = _state.value.copy(
                    restTimer = _state.value.restTimer.copy(secondsRemaining = remaining)
                )
            }
            _state.value = _state.value.copy(restTimer = RestTimerState())
        }
    }

    fun cancelRestTimer() {
        timerJob?.cancel()
        _state.value = _state.value.copy(restTimer = RestTimerState())
    }

    // ── Plate calculator ───────────────────────────────────────────────────────

    fun showPlateCalculator(lift: Lift, weight: String) {
        _state.value = _state.value.copy(plateCalcLift = lift, plateCalcWeight = weight)
    }

    fun dismissPlateCalculator() {
        _state.value = _state.value.copy(plateCalcLift = null, plateCalcWeight = "")
    }

    fun saveSession(onSaved: (Long) -> Unit) {
        val s = _state.value
        val allSets = mutableListOf<SetEntry>()

        for (lift in s.selectedLifts) {
            val draftSets = s.sets[lift] ?: continue
            for (draft in draftSets) {
                val weight = draft.weightKg.toFloatOrNull()
                val reps   = draft.reps.toIntOrNull()
                if (weight == null || weight <= 0f || reps == null || reps <= 0) continue
                allSets += SetEntry(
                    sessionId = 0,  // filled by repository
                    lift      = lift.name,
                    weightKg  = weight,
                    reps      = reps,
                )
            }
        }

        if (allSets.isEmpty()) {
            _state.value = s.copy(error = "Log at least one valid set before finishing")
            return
        }

        _state.value = s.copy(isSaving = true)
        viewModelScope.launch {
            val profile = userRepository.getUserProfile().first()
            val today   = LocalDate.now().toString()

            // Update personal bests & get list of new PBs
            val newPbLifts = workoutRepository.updatePersonalBests(allSets, today)

            // Compute benchmark tier for XP bonus
            val pbs = workoutRepository.getAllPersonalBests()
            val topTier: BenchmarkTier = if (profile != null) {
                val sex = Sex.valueOf(profile.sex)
                s.selectedLifts.mapNotNull { lift ->
                    val oneRm    = pbs[lift.name] ?: 0f
                    val benchKg  = BenchmarkEngine.benchmarkKg(lift, sex, profile.ageYears, profile.bodyweightKg)
                    BenchmarkEngine.tier(oneRm, benchKg)
                }.maxByOrNull { it.ordinal } ?: BenchmarkTier.BEGINNER
            } else BenchmarkTier.BEGINNER

            val breakdown = XpEngine.calculate(
                sets        = allSets,
                existingPbs = pbs,
                topTier     = topTier,
                streakDays  = profile?.currentStreak ?: 0,
                date        = today,
            )

            val session = WorkoutSession(
                date         = today,
                totalXpEarned = breakdown.total,
            )
            val sessionId = workoutRepository.saveSession(session, allSets)

            userRepository.applyXp(breakdown.total)
            userRepository.updateStreak()

            // Check achievements
            val updatedProfile = userRepository.getUserProfile().first()
            if (updatedProfile != null) {
                achievementRepository.evaluateAndSave(updatedProfile, workoutRepository.getAllPersonalBests())
            }

            // Update widget cache
            WidgetCache.update(context, updatedProfile?.level ?: 1,
                updatedProfile?.totalXp ?: 0, updatedProfile?.currentStreak ?: 0)

            onSaved(sessionId)
        }
    }
}
