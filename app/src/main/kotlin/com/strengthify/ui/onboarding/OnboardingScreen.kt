package com.strengthify.ui.onboarding

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.strengthify.data.model.Sex

@Composable
fun OnboardingScreen(
    onProfileSaved: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeContentPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))

        Text(
            text  = "💪 Strengthify",
            style = MaterialTheme.typography.displayLarge,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text      = "Let's set up your profile so benchmarks are tailored to you.",
            style     = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color     = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(40.dp))

        // Name
        OutlinedTextField(
            value         = state.name,
            onValueChange = viewModel::onNameChange,
            label         = { Text("Name") },
            singleLine    = true,
            modifier      = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(16.dp))

        // Sex toggle
        Text(
            "Sex",
            style    = MaterialTheme.typography.labelMedium,
            color    = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            listOf(Sex.MALE to "Male", Sex.FEMALE to "Female").forEach { (sex, label) ->
                val selected = state.sex == sex
                Button(
                    onClick  = { viewModel.onSexChange(sex) },
                    modifier = Modifier.weight(1f),
                    colors   = if (selected)
                        ButtonDefaults.buttonColors()
                    else
                        ButtonDefaults.outlinedButtonColors(),
                ) {
                    Text(label)
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Age
        OutlinedTextField(
            value         = state.ageYears,
            onValueChange = viewModel::onAgeChange,
            label         = { Text("Age (years)") },
            singleLine    = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier      = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(16.dp))

        // Bodyweight
        OutlinedTextField(
            value         = state.bodyweightKg,
            onValueChange = viewModel::onBodyweightChange,
            label         = { Text("Bodyweight (kg)") },
            singleLine    = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier      = Modifier.fillMaxWidth(),
        )

        // Error
        if (state.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(
                text  = state.error!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick  = { viewModel.save(onProfileSaved) },
            enabled  = !state.isSaving,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) {
            if (state.isSaving) {
                CircularProgressIndicator(
                    modifier  = Modifier.size(20.dp),
                    color     = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Text("Get Started", style = MaterialTheme.typography.titleMedium)
            }
        }

        Spacer(Modifier.height(32.dp))
    }
}
