package com.strengthify.ui.logging

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.strengthify.data.model.Lift

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoggingScreen(
    onSessionSaved: (Long) -> Unit,
    onBack: () -> Unit,
    viewModel: LoggingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (state.step == LoggingStep.SELECT_LIFTS) "Choose Lifts" else "Log Sets")
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (state.step == LoggingStep.LOG_SETS) {
                            // go back to lift selection — reset step
                            viewModel.confirmLifts()  // noop-ish; user navigates back
                        }
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { padding ->
        // Plate calculator dialog (shown when user clicks the plate icon)
        state.plateCalcLift?.let { lift ->
            PlateCalculatorDialog(
                lift          = lift,
                initialWeight = state.plateCalcWeight,
                onDismiss     = viewModel::dismissPlateCalculator,
            )
        }

        when (state.step) {
            LoggingStep.SELECT_LIFTS -> LiftSelectionContent(
                selected  = state.selectedLifts,
                onToggle  = viewModel::toggleLift,
                onConfirm = viewModel::confirmLifts,
                error     = state.error,
                modifier  = Modifier.padding(padding),
            )
            LoggingStep.LOG_SETS -> SetLoggingContent(
                state           = state,
                onAddSet        = viewModel::addSet,
                onRemoveSet     = viewModel::removeSet,
                onWeightChange  = viewModel::onWeightChange,
                onRepsChange    = viewModel::onRepsChange,
                onFinish        = { viewModel.saveSession(onSessionSaved) },
                onStartTimer    = viewModel::startRestTimer,
                onCancelTimer   = viewModel::cancelRestTimer,
                onShowPlateCalc = viewModel::showPlateCalculator,
                modifier        = Modifier.padding(padding),
            )
        }
    }
}

@Composable
private fun LiftSelectionContent(
    selected: List<Lift>,
    onToggle: (Lift) -> Unit,
    onConfirm: () -> Unit,
    error: String?,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Text(
            "Pick 1–4 lifts for today",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))

        Lift.entries.forEach { lift ->
            val isSelected = lift in selected
            FilterChip(
                selected = isSelected,
                onClick  = { onToggle(lift) },
                label    = {
                    Column(modifier = Modifier.padding(vertical = 4.dp)) {
                        Text(lift.displayName, style = MaterialTheme.typography.bodyMedium)
                        Text(lift.muscleGroup, style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            )
        }

        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick  = onConfirm,
            enabled  = selected.isNotEmpty(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text("Next →")
        }
    }
}

@Composable
private fun SetLoggingContent(
    state: LoggingUiState,
    onAddSet: (Lift) -> Unit,
    onRemoveSet: (Lift, Int) -> Unit,
    onWeightChange: (Lift, Int, String) -> Unit,
    onRepsChange: (Lift, Int, String) -> Unit,
    onFinish: () -> Unit,
    onStartTimer: (Int) -> Unit,
    onCancelTimer: () -> Unit,
    onShowPlateCalc: (Lift, String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // Rest timer banner — pinned at top
        item {
            RestTimerBanner(state = state.restTimer, onCancel = onCancelTimer)
        }
        state.selectedLifts.forEach { lift ->
            item(key = lift.name) {
                LiftSection(
                    lift            = lift,
                    sets            = state.sets[lift] ?: emptyList(),
                    suggestion      = state.suggestions[lift],
                    onAddSet        = { onAddSet(lift) },
                    onRemoveSet     = { i -> onRemoveSet(lift, i) },
                    onWeightChange  = { i, v -> onWeightChange(lift, i, v) },
                    onRepsChange    = { i, v -> onRepsChange(lift, i, v) },
                    onStartTimer    = onStartTimer,
                    onShowPlateCalc = { weight -> onShowPlateCalc(lift, weight) },
                )
            }
        }

        item {
            if (state.error != null) {
                Text(state.error, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(8.dp))
            }
            Button(
                onClick  = onFinish,
                enabled  = !state.isSaving,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (state.isSaving) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text("Finish Workout ✓")
                }
            }
        }
    }
}

@Composable
private fun LiftSection(
    lift: Lift,
    sets: List<SetDraft>,
    suggestion: SetDraft?,
    onAddSet: () -> Unit,
    onRemoveSet: (Int) -> Unit,
    onWeightChange: (Int, String) -> Unit,
    onRepsChange: (Int, String) -> Unit,
    onStartTimer: (Int) -> Unit,
    onShowPlateCalc: (String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(lift.displayName, style = MaterialTheme.typography.titleMedium)
                    Text(lift.muscleGroup, style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                // Plate calculator shortcut
                val firstWeight = sets.firstOrNull()?.weightKg ?: ""
                IconButton(onClick = { onShowPlateCalc(firstWeight) }) {
                    Icon(Icons.Default.Calculate, "Plate calculator",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp))
                }
            }

            if (suggestion != null) {
                Text(
                    "Last best: ${suggestion.weightKg} kg × ${suggestion.reps} reps",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            Spacer(Modifier.height(8.dp))

            // Header row
            Row(modifier = Modifier.fillMaxWidth()) {
                Text("Set",    modifier = Modifier.weight(0.5f), style = MaterialTheme.typography.labelMedium)
                Text("kg",     modifier = Modifier.weight(1f),   style = MaterialTheme.typography.labelMedium)
                Text("Reps",   modifier = Modifier.weight(1f),   style = MaterialTheme.typography.labelMedium)
                Spacer(modifier = Modifier.size(32.dp))
            }

            sets.forEachIndexed { i, set ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("${i + 1}", modifier = Modifier.weight(0.5f))
                    OutlinedTextField(
                        value         = set.weightKg,
                        onValueChange = { onWeightChange(i, it) },
                        modifier      = Modifier.weight(1f).padding(end = 4.dp),
                        singleLine    = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        textStyle     = MaterialTheme.typography.bodyMedium,
                    )
                    OutlinedTextField(
                        value         = set.reps,
                        onValueChange = { onRepsChange(i, it) },
                        modifier      = Modifier.weight(1f).padding(end = 4.dp),
                        singleLine    = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        textStyle     = MaterialTheme.typography.bodyMedium,
                    )
                    IconButton(onClick = { onRemoveSet(i) }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Close, "Remove set",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            TextButton(onClick = onAddSet, modifier = Modifier.align(Alignment.End)) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text("Add Set")
            }

            // Rest timer quick-start
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            RestTimerButtons(onStart = onStartTimer)
        }
    }
}
