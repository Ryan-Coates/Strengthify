package com.strengthify.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strengthify.data.model.Sex
import com.strengthify.data.model.UserProfile
import com.strengthify.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OnboardingState(
    val name: String = "",
    val sex: Sex = Sex.MALE,
    val ageYears: String = "",
    val bodyweightKg: String = "",
    val isSaving: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val userRepository: UserRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(OnboardingState())
    val state = _state.asStateFlow()

    fun onNameChange(v: String)         { _state.value = _state.value.copy(name = v, error = null) }
    fun onSexChange(v: Sex)             { _state.value = _state.value.copy(sex = v) }
    fun onAgeChange(v: String)          { _state.value = _state.value.copy(ageYears = v, error = null) }
    fun onBodyweightChange(v: String)   { _state.value = _state.value.copy(bodyweightKg = v, error = null) }

    fun save(onSuccess: () -> Unit) {
        val s = _state.value
        val age = s.ageYears.toIntOrNull()
        val bw  = s.bodyweightKg.toFloatOrNull()

        if (s.name.isBlank()) {
            _state.value = s.copy(error = "Please enter your name")
            return
        }
        if (age == null || age < 10 || age > 100) {
            _state.value = s.copy(error = "Enter a valid age (10–100)")
            return
        }
        if (bw == null || bw < 20f || bw > 300f) {
            _state.value = s.copy(error = "Enter a valid bodyweight in kg")
            return
        }

        _state.value = s.copy(isSaving = true)
        viewModelScope.launch {
            userRepository.saveProfile(
                UserProfile(
                    name          = s.name.trim(),
                    sex           = s.sex.name,
                    ageYears      = age,
                    bodyweightKg  = bw,
                )
            )
            onSuccess()
        }
    }
}
