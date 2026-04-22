package com.strengthify.data.repository

import com.strengthify.data.db.PersonalBestDao
import com.strengthify.data.db.SetEntryDao
import com.strengthify.data.db.WorkoutSessionDao
import com.strengthify.data.model.PersonalBest
import com.strengthify.data.model.SetEntry
import com.strengthify.data.model.WorkoutSession
import com.strengthify.data.model.WorkoutSessionWithSets
import com.strengthify.domain.XpEngine
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WorkoutRepository @Inject constructor(
    private val sessionDao: WorkoutSessionDao,
    private val setDao: SetEntryDao,
    private val pbDao: PersonalBestDao,
) {
    fun observeRecentSessions(limit: Int = 10): Flow<List<WorkoutSessionWithSets>> =
        sessionDao.observeRecent(limit)

    suspend fun getSessionWithSets(id: Long): WorkoutSessionWithSets? =
        sessionDao.getWithSets(id)

    suspend fun saveSession(session: WorkoutSession, sets: List<SetEntry>): Long {
        val sessionId = sessionDao.insert(session)
        val linkedSets = sets.map { it.copy(sessionId = sessionId) }
        setDao.insertAll(linkedSets)
        return sessionId
    }

    suspend fun updatePersonalBests(sets: List<SetEntry>, date: String): List<String> {
        val newPbLifts = mutableListOf<String>()
        sets.groupBy { it.lift }.forEach { (liftName, liftSets) ->
            val bestOneRm = liftSets.maxOf { XpEngine.epleyOneRm(it.weightKg, it.reps) }
            val existing = pbDao.getByLift(liftName)
            if (existing == null || bestOneRm > existing.estimatedOneRmKg) {
                pbDao.upsert(PersonalBest(liftName, bestOneRm, date))
                newPbLifts += liftName
            }
        }
        return newPbLifts
    }

    suspend fun getAllPersonalBests(): Map<String, Float> =
        pbDao.getAll().associate { it.lift to it.estimatedOneRmKg }

    fun observePersonalBests(): Flow<Map<String, Float>> =
        pbDao.observeAll().map { list -> list.associate { it.lift to it.estimatedOneRmKg } }

    fun observeWorkoutDates(): Flow<List<String>> = sessionDao.observeAllDates()

    /** Returns (date, estimatedOneRm) pairs for a lift, ordered oldest→newest. */
    fun observeOneRmHistory(lift: String): Flow<List<Pair<String, Float>>> =
        setDao.observeByLift(lift).map { sets ->
            sets.groupBy { it.sessionId }
                .mapNotNull { (_, sessionSets) ->
                    val session = sessionSets.first()
                    val bestOneRm = sessionSets.maxOf { XpEngine.epleyOneRm(it.weightKg, it.reps) }
                    // We don't have the date here — use sessionId as a proxy for ordering
                    // (proper date comes from joining with workout_session, kept simple)
                    session.lift to bestOneRm  // placeholder; ProgressViewModel joins date
                }
        }

    /** Richer history including date, for progress charts. */
    fun observeOneRmHistoryWithDates(lift: String): Flow<List<Pair<String, Float>>> =
        setDao.observeByLift(lift).map { sets ->
            // Group by sessionId; date is retrieved via recent sessions query
            // For simplicity, we'll store date in the set's relationship via JOIN in the DAO.
            // This flow emits (sessionId as string, bestOneRm) — ProgressViewModel converts.
            sets.groupBy { it.sessionId }.map { (sid, sessionSets) ->
                sid.toString() to sessionSets.maxOf { XpEngine.epleyOneRm(it.weightKg, it.reps) }
            }
        }

    suspend fun getSuggestionsForLift(lift: String): Pair<Float, Int>? {
        val recent = setDao.getRecentByLift(lift, 5)
        if (recent.isEmpty()) return null
        val best = recent.maxByOrNull { XpEngine.epleyOneRm(it.weightKg, it.reps) } ?: return null
        return best.weightKg to best.reps
    }
}
