function extractEmail(entries) {

  const patient = entries.find(
    e => e.resource.resourceType === "Patient"
  );

  const telecom = patient?.resource?.telecom || [];

  const email = telecom.find(t => t.system === "email");

  return email?.value || null;

}

module.exports = { extractEmail };