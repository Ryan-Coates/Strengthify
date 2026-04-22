package com.strengthify.ui.results

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strengthify.data.model.AchievementId
import com.strengthify.data.model.WorkoutSessionWithSets
import com.strengthify.data.repository.AchievementRepository
import com.strengthify.data.repository.UserRepository
import com.strengthify.data.repository.WorkoutRepository
import com.strengthify.domain.XpEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ResultsUiState(
    val isLoading: Boolean = true,
    val sessionWithSets: WorkoutSessionWithSets? = null,
    val xpEarned: Int = 0,
    val newPbLifts: List<String> = emptyList(),
    val leveledUp: Boolean = false,
    val newLevel: Int = 1,
    val newAchievements: List<AchievementId> = emptyList(),
)

@HiltViewModel
class ResultsViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val workoutRepository: WorkoutRepository,
    private val userRepository: UserRepository,
    private val achievementRepository: AchievementRepository,
) : ViewModel() {

    private val sessionId: Long = savedState["sessionId"] ?: 0L

    private val _state = MutableStateFlow(ResultsUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val sessionWithSets = workoutRepository.getSessionWithSets(sessionId)
            val profile = userRepository.getUserProfile().first()

            if (sessionWithSets == null || profile == null) {
                _state.value = _state.value.copy(isLoading = false)
                return@launch
            }

            val xpEarned = sessionWithSets.session.totalXpEarned

            // Detect level-up: compute what level the user was before this session's XP
            val xpBeforeSession = profile.totalXp - xpEarned
            val levelBefore = computeLevelFromXp(xpBeforeSession.coerceAtLeast(0))
            val leveledUp = profile.level > levelBefore

            // Which lifts hit new PBs this session
            val pbs = workoutRepository.getAllPersonalBests()
            val newPbLifts = sessionWithSets.sets
                .groupBy { it.lift }
                .filter { (liftName, sets) ->
                    val bestInSession = sets.maxOf { XpEngine.epleyOneRm(it.weightKg, it.reps) }
                    val stored = pbs[liftName] ?: 0f
                    bestInSession >= stored - 0.1f
                }
                .keys.toList()

            // Achievements earned in this session (already saved by LoggingViewModel;
            // we compare what was just unlocked by reading the last N seconds of DB updates
            // — simplest approach: re-evaluate with current state against previously earned set)
            val allAchievements = achievementRepository.observeAll().first()
            val sessionDate = sessionWithSets.session.date
            val newlyEarnedThisSession = allAchievements.filter { it.earnedDate == sessionDate }
                .mapNotNull { a ->
                    AchievementId.entries.find { it.name == a.id }
                }

            _state.value = ResultsUiState(
                isLoading       = false,
                sessionWithSets = sessionWithSets,
                xpEarned        = xpEarned,
                newPbLifts      = newPbLifts,
                leveledUp       = leveledUp,
                newLevel        = profile.level,
                newAchievements = newlyEarnedThisSession,
            )
        }
    }

    private fun computeLevelFromXp(totalXp: Int): Int {
        var level = 1
        while (totalXp >= XpEngine.thresholdForLevel(level + 1)) {
            level++
        }
        return level
    }
}

