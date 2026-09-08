import api from '../../utils/api';

export const fetchRoutines = async (dayOfWeek, options = {}) => {
  try {
    const params = { ...(dayOfWeek != null ? { day: dayOfWeek } : {}), ...(options.date ? { date: options.date } : {}) };
    const { data } = await api.get('/api/routines', { params, signal: options.signal });
    return data.routines;
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error('Erreur lors de fetchRoutines:', error);
    throw error;
  }
};

export const fetchRoutinesCalendar = async (start, end) => {
  try {
    const { data } = await api.get('/api/routines/calendar', { params: { start, end } });
    return data.byDate || {};
  } catch (error) {
    console.error('Erreur lors de fetchRoutinesCalendar:', error);
    return {};
  }
};

export const toggleRoutine = async (id, done, date) => {
  try {
    const body = { ...(typeof done === 'boolean' ? { done } : {}), ...(date ? { date } : {}) };
    const { data } = await api.patch(`/api/routines/${id}/toggle`, body);
    return data.routine;
  } catch (error) {
    console.error('Erreur lors de toggleRoutine:', error);
    throw error;
  }
};

export const createRoutine = async (label, dayOfWeek) => {
  try {
    const { data } = await api.post('/api/routines', { label, day_of_week: dayOfWeek });
    return data.routine;
  } catch (error) {
    console.error('Erreur lors de createRoutine:', error);
    throw error;
  }
};

export const reorderRoutines = async (ids, dayOfWeek) => {
  try {
    const { data } = await api.put('/api/routines/reorder', { ids, day_of_week: dayOfWeek });
    return data.routines;
  } catch (error) {
    console.error('Erreur lors de reorderRoutines:', error);
    throw error;
  }
};

export const deleteRoutine = async (id) => {
  try {
    await api.delete(`/api/routines/${id}`);
  } catch (error) {
    console.error('Erreur lors de deleteRoutine:', error);
    throw error;
  }
};

export const fetchSimilarRoutines = async (label) => {
  try {
    const { data } = await api.get('/api/routines/similar', { params: { label } });
    return data.routines || [];
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') throw error;
    console.error('Erreur lors de fetchSimilarRoutines:', error);
    throw error;
  }
};

export const createRoutineForOtherDays = async (label, excludeDay) => {
  try {
    const { data } = await api.post('/api/routines/create-for-other-days', { label, exclude_day: excludeDay });
    return data.routines || [];
  } catch (error) {
    console.error('Erreur lors de createRoutineForOtherDays:', error);
    throw error;
  }
};

/** Rappels programmés sur toute la semaine (heure + message du jour). */
export const fetchRoutineReminders = async () => {
  try {
    const { data } = await api.get('/api/routines/reminders');
    return data.reminders || [];
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') throw error;
    console.error('Erreur lors de fetchRoutineReminders:', error);
    return [];
  }
};

/**
 * Programme le rappel d'une routine.
 * @param {number} id
 * @param {{ time: string|null, greeting: 'morning'|'night'|null, scope: 'day'|'week' }} options
 * @returns {{ routines: Array, conflicts: Array, greeting_applied: boolean }}
 */
export const setRoutineReminder = async (id, { time, greeting, scope = 'day' }) => {
  try {
    const { data } = await api.put(`/api/routines/${id}/reminder`, { time, greeting, scope });
    return data;
  } catch (error) {
    console.error('Erreur lors de setRoutineReminder:', error);
    throw error;
  }
};

export const deleteRoutinesByLabel = async (label) => {
  try {
    await api.delete('/api/routines/by-label', { params: { label } });
  } catch (error) {
    console.error('Erreur lors de deleteRoutinesByLabel:', error);
    throw error;
  }
};
