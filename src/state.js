
const states = new Map();

function setState(userId, step, data = {}) {
  states.set(userId, { step, data });
}

function getState(userId) {
  return states.get(userId) || null;
}

function updateData(userId, patch) {
  const current = states.get(userId);
  if (!current) return;
  current.data = { ...current.data, ...patch };
  states.set(userId, current);
}

function clearState(userId) {
  states.delete(userId);
}

module.exports = { setState, getState, updateData, clearState };
