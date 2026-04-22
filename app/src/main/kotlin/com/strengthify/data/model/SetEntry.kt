package com.strengthify.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "set_entry")
data class SetEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sessionId: Long,
    val lift: String,          // Lift.name
    val weightKg: Float,
    val reps: Int,
    val rpe: Int = 0,          // 0 = not recorded
)
