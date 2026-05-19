const {upsertSnapshotPatient, upsertSnapshotAppointment} = require('./dashboardSnapshotService');
/**
 * savePatientDataAddition
 *
 * Unified database sync helper. Takes the raw input array and the server response array,
 * handles per-item validation, maps the matching IDs, and fires concurrent SQL updates.
 *
 * @param {Array|Object} inputData     - Raw demographics array (req.body or legacy JSON records)
 * @param {Array} [responseData]       - Optional. The raw array of server responses containing statuses and fhirIds
 */
/**
 * savePatientDataAddition
 *
 * Fully insulated database sync helper. Completely guarded against bubbling errors
 * to guarantee zero negative impacts on live API controller responses.
 */
const savePatientDataAddition = async (inputData, responseData = null) => {
    // GLOBAL CATCH BLOCK: Guarantees this function can NEVER throw an unhandled exception to the controller
    try {
        // 1. Normalize Input Demographics Array
        const incomingPatients = Array.isArray(inputData) ? inputData : [inputData];
        if (!incomingPatients.length) return;

        // 2. Build the Lookup Map
        const liveFhirIdMap = {};
        if (Array.isArray(responseData)) {
            responseData.forEach(resItem => {
                const itemStatus = String(resItem.status || '');
                if (itemStatus.includes('200') || itemStatus.includes('201')) {
                    const localId = resItem.id ? String(resItem.id).trim() : '';
                    if (localId && resItem.fhirId) {
                        liveFhirIdMap[localId] = String(resItem.fhirId);
                    }
                }
            });
        }

        // 3. Map items to high-concurrency database execution tasks
        const tasks = incomingPatients.map(async (patientData) => {
            const localId = patientData.id ? String(patientData.id).trim() : '';
            const targetFhirId = patientData.fhirId || liveFhirIdMap[localId];

            if (!targetFhirId) return;

            const normalizedPatientData = { ...patientData, fhirId: targetFhirId };

            try {
                console.log("Upserting snapshot for patient FHIR ID:", normalizedPatientData);
                await upsertSnapshotPatient(normalizedPatientData);
            } catch (err) {
                // Granular per-patient error catcher
                await SnapshotFailureLog.logFailure({
                    fhirId:  targetFhirId,
                    sourceType: 'facility', 
                    controller: 'savePatientDataAddition_ItemFail',
                    payload:    patientData,
                    error:      err
                });
            }
        });

        // 4. Resolve all tasks concurrently via the connection pool
        await Promise.allSettled(tasks);

    } catch (globalError) {
        // Global safety net catches system level faults (e.g., inputData undefined, memory limits)
        console.error("CRITICAL CRASH IN DASHBOARD SNAPSHOT PROCESSOR:", globalError);
        
        try {
            await SnapshotFailureLog.logFailure({
                patientId:  "GLOBAL_SYSTEM_FAILURE",
                sourceType: 'facility',
                controller: 'savePatientDataAddition_GlobalCrash',
                payload:    { inputData, responseData_Summary: Array.isArray(responseData) ? `${responseData.length} items` : 'none' },
                error:      globalError
            });
        } catch (loggingError) {
            console.error("Could not write global crash details to disk ledger:", loggingError);
        }
        
        return; 
    }
};


/**
 * addAppointmentData
 *
 * Unified processing bridge for appointment events. Fully insulated from bubbling 
 * system failures to guarantee zero negative impacts or delays on live API controller server responses.
 *
 * @param {Object|Array} inputData   - The incoming raw appointment demographics payload(s)
 * @param {Array|null} responseData  - Optional downstream API tracking response containing status/FHIR maps
 */
const addAppointmentData = async (inputData, isCampaignPath, responseData = null) => {
    try {
        const incomingAppointments = Array.isArray(inputData) ? inputData : [inputData];
        if (!incomingAppointments.length) return;
 
        // Map local uuid → resolved FHIR Appointment id
        // POST appointment body uses 'uuid' as the local identifier
        const fhirIdMap = buildFhirIdMap(responseData);
        console.log('[addAppointmentData] FHIR ID Map:', fhirIdMap);
        const tasks = incomingAppointments.map(async (apptData) => {
            const localId           = apptData.uuid ? String(apptData.uuid).trim() : '';
            const appointmentFhirId = apptData.fhirId || fhirIdMap[localId] || null;
 
            if (!appointmentFhirId) {
                console.warn('[addAppointmentData] no fhirId resolved for appointment uuid:', localId);
                return;
            }
 
            const normalizedAppointmentData = {
                patientId:     String(apptData.patientId),
                appointmentId: appointmentFhirId,
                sourceType:    isCampaignPath? 'campaign' : 'facility',
                status:        apptData?.status || null,
                slot:          { start: apptData.slot?.start || null },
                orgId:    isCampaignPath? null : apptData.orgId,
                campaignId:    apptData.campaignId || null
            };
 
            try {
                await upsertSnapshotAppointment(normalizedAppointmentData);
            } catch (err) {
                await logSnapshotFailure({
                    patientId:  String(apptData.patientId),
                    sourceType: source_type,
                    controller: 'addAppointmentData',
                    payload:    apptData,
                    error:      err
                });
            }
        });
 
        await Promise.allSettled(tasks);
 
    } catch (globalError) {
        console.error('[addAppointmentData] global error:', globalError);
    }
};

const patchAppointmentFlatData = async (inputData, isCampaignPath, responseData = null) => {
    try {
        const incomingAppointments = Array.isArray(inputData) ? inputData : [inputData];
        if (!incomingAppointments.length) return;
 
        const sourceType = isCampaignPath ? 'campaign' : 'facility';
 
        // PATCH response: fhirId = appointmentId, id = null
        // So fhirId map won't work here — appointmentId from body IS the FHIR id
        const tasks = incomingAppointments.map(async (apptData) => {
            const appointmentFhirId = apptData.appointmentId
                ? String(apptData.appointmentId)
                : null;
 
            if (!appointmentFhirId) {
                console.warn('[patchAppointmentData] missing appointmentId in patch body');
                return;
            }
 
            // patientId set by controller loop from resourceSavedData before this wrapper is called
            const patientId = apptData.patientId ? String(apptData.patientId) : null;
            console.log(`[patchAppointmentData] processing appointmentId: ${appointmentFhirId}, patientId: ${patientId}`, apptData);
            if (!patientId) {
                console.warn('[patchAppointmentData] missing patientId for appointmentId:', appointmentFhirId);
                return;
            }
 
            // status: { operation: 'replace', value: 'completed' } → extract value
            const status = apptData.status?.value || null;
 
            // slot: { operation: 'replace', value: { start: '...', end: '...' } } → extract start
            // status-only patch has no slot key at all → null → COALESCE keeps existing
            const slot = {start: apptData.slot?.value?.start || null};
 
            try {
                await upsertSnapshotAppointment({
                    patientId,
                    appointmentId:     appointmentFhirId,
                    sourceType,
                    orgId:        null,   // not in PATCH body — COALESCE keeps existing
                    campaignId:        null,   // not in PATCH body — COALESCE keeps existing
                    slot,             // null on status-only → keeps existing
                    status          // always updated — dashboard SQL does the filtering
                });
            } catch (err) {
                await logSnapshotFailure({
                    patientId,
                    sourceType,
                    controller: 'patchAppointmentData',
                    payload:    apptData,
                    error:      err
                });
            }
        });
 
        await Promise.allSettled(tasks);
 
    } catch (globalError) {
        console.error('[patchAppointmentData] global error:', globalError);
    }
};


const addCVDFlatData = async (inputData, isCampaignPath) => {
    try {
        const incomingCVDs = Array.isArray(inputData) ? inputData : [inputData];
        if (!incomingCVDs.length) return;
  
        const tasks = incomingCVDs.map(async (cvd) => {
            if (!cvd.patientId) {
                console.warn('[addCVDData] missing patientId in CVD body');
                return;
            }
 
            try {
                await upsertSnapshotCVD({
                    patientId:        String(cvd.patientId),
                    sourceType: isCampaignPath ? 'campaign' : 'facility', 
                    screeningDate:    cvd.screeningDate || null,
                    bpSystolic:       cvd.bpSystolic   ?? null,
                    bpDiastolic:      cvd.bpDiastolic   ?? null,
                    bmi:              cvd.bmi            ?? null,
                    smoker:           cvd.smoker != null ? parseInt(cvd.smoker) : null,
                    cholesterol:       cvd.cholesterol != null ? parseFloat(cvd.cholesterol) : null,
                    cholesterolUnit:  cvd.cholesterolUnit || null,
                    risk:          cvd.risk != null ? parseInt(cvd.risk) : null
                });
            } catch (err) {
                await logSnapshotFailure({
                    patientId:  String(cvd.patientId),
                    sourceType: isCampaignPath ? 'campaign' : 'facility',
                    controller: 'addCVDFlatData',
                    payload:    cvd,
                    error:      err
                });
            }
        });
 
        await Promise.allSettled(tasks);
 
    } catch (globalError) {
        console.error('[addCVDData] global error:', globalError);
    }
};

const buildFhirIdMap = (responseData) => {
    const map = {};
    if (!Array.isArray(responseData)) return map;
    responseData.forEach(resItem => {
        console.log(`[buildFhirIdMap] processing response item - id: ${resItem.id}, fhirId: ${resItem.fhirId}, status: ${resItem.status}`);
        const s = String(resItem.status || '');
        if (s.includes('200') || s.includes('201')) {
            const localId = resItem.id ? String(resItem.id).trim() : '';
            console.log(`[buildFhirIdMap] processing response item - localId: ${localId}, fhirId: ${resItem.fhirId}`);
            if (localId && resItem.fhirId) map[localId] = String(resItem.fhirId);
        }
    });
    return map;
};
module.exports = {
    savePatientDataAddition,
    addAppointmentData,
    patchAppointmentFlatData,
    addCVDFlatData
};