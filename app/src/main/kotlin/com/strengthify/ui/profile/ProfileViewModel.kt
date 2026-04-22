package com.strengthify.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strengthify.data.model.Achievement
import com.strengthify.data.model.AchievementId
import com.strengthify.data.model.UserProfile
import com.strengthify.data.repository.AchievementRepository
import com.strengthify.data.repository.ExportRepository
import com.strengthify.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileEditState(
    val bodyweightInput: String = "",
    val ageInput: String = "",
    val isSaving: Boolean = false,
    val saved: Boolean = false,
    val isExporting: Boolean = false,
    val exportFileName: String? = null,
    val exportError: Boolean = false,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val achievementRepository: AchievementRepository,
    private val exportRepository: ExportRepository,
) : ViewModel() {

    val profile = userRepository.getUserProfile()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val achievements = achievementRepository.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _editState = MutableStateFlow(ProfileEditState())
    val editState = _editState.asStateFlow()

    fun onBodyweightChange(v: String) {
        _editState.value = _editState.value.copy(bodyweightInput = v, saved = false)
    }

    fun onAgeChange(v: String) {
        _editState.value = _editState.value.copy(ageInput = v, saved = false)
    }

    fun initFrom(profile: UserProfile) {
        if (_editState.value.bodyweightInput.isEmpty()) {
            _editState.value = _editState.value.copy(
                bodyweightInput = "${"%.1f".format(profile.bodyweightKg)}",
                ageInput        = "${profile.ageYears}",
            )
        }
    }

    fun saveChanges() {
        val s = _editState.value
        val bw  = s.bodyweightInput.toFloatOrNull() ?: return
        val age = s.ageInput.toIntOrNull() ?: return
        if (bw <= 0f || age < 10 || age > 100) return

        _editState.value = s.copy(isSaving = true)
        viewModelScope.launch {
            userRepository.updateBodyweight(bw)
            userRepository.updateAge(age)
            _editState.value = _editState.value.copy(isSaving = false, saved = true)
        }
    }

    fun exportWorkouts() {
        _editState.value = _editState.value.copy(isExporting = true, exportFileName = null, exportError = false)
        viewModelScope.launch {
            val fileName = exportRepository.exportToCsv()
            _editState.value = _editState.value.copy(
                isExporting    = false,
                exportFileName = fileName,
                exportError    = fileName == null,
            )
        }
    }

    fun dismissExportResult() {
        _editState.value = _editState.value.copy(exportFileName = null, exportError = false)
    }
}
