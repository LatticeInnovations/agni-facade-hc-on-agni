const pendingPatients = new Set();

function addPendingPatient(patientId) {
  pendingPatients.add(patientId);
}

function getPendingPatients() {
  return Array.from(pendingPatients);
}

function clearPendingPatients() {
  pendingPatients.clear();
}

module.exports = {
  addPendingPatient,
  getPendingPatients,
  clearPendingPatients
};