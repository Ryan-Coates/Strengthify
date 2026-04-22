package com.strengthify

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strengthify.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    userRepository: UserRepository
) : ViewModel() {

    /** Null = still loading, true = profile exists, false = show onboarding */
    val hasProfile = userRepository.getUserProfile()
        .map { it != null }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}
