// 1. Force load the environment variables before triggering database configurations
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); 

const { sequelize } = require('../../models');
// Adjust this path context to match where your orchestration functions live
const { upsertSnapshotAppointment } = require('../../services/dashboardSnapshotService'); // Adjust this path to your worker service file


/**
 * runLegacyAppointmentBackfill
 * Processes and streams legacy JSON structural array blocks into the analytics engine.
 */
async function runLegacyAppointmentBackfill() {
    console.log('🚀 Initiating legacy appointment historical backfill process...');
    const startTime = Date.now();
    let totalProcessed = 0;

    try {
        await sequelize.authenticate();
        console.log('✅ Base relational database connection verified.');

        // =========================================================================
        // PLACEHOLDER: Load your legacy array data here.
        // If it's saved in a file, use: const legacyDataContainer = require('../data/legacy_appointments.json');
        // =========================================================================
        const legacyDataContainer = {
            "data": [
        {
            "appointmentId": "6022",
            "uuid": "f6a7b8c9-d0e1-4f2g-3h4i-j5k6l7m8n9o0",
            "slot": {
                "start": "2026-05-17T17:35:00.000Z",
                "end": "2026-05-17T17:40:00.000Z"
            },
            "patientId": "5922",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-17T11:40:00.000Z",
            "appointmentType": "routine",
            "slotId": "6021",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "in-progress",
            "scheduleId": "6000"
        },
        {
            "appointmentId": "5877",
            "uuid": "c02612fe-601f-493e-b97c-18ae58fa2600",
            "slot": {
                "start": "2026-11-11T07:30:00.000Z",
                "end": "2026-11-11T07:35:00.000Z"
            },
            "patientId": "5247",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-15T07:48:03.787Z",
            "appointmentType": "routine",
            "slotId": "5874",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "scheduled",
            "scheduleId": "5872",
            "generatedOn": null
        },
        {
            "appointmentId": "5875",
            "uuid": "12f43670-bfb2-4960-898d-9a6b427bf59f",
            "slot": {
                "start": "2026-05-15T07:48:00.000Z",
                "end": "2026-05-15T07:53:00.000Z"
            },
            "patientId": "5247",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-15T07:48:03.715Z",
            "appointmentType": "walkin",
            "slotId": "5873",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "completed",
            "scheduleId": "5842",
            "generatedOn": "2026-05-15T07:48:03.755Z"
        },
        {
            "appointmentId": "5848",
            "uuid": "dde3bd2e-8d36-4032-a3f8-a19e164a9442",
            "slot": {
                "start": "2027-05-15T07:30:00.000Z",
                "end": "2027-05-15T07:35:00.000Z"
            },
            "patientId": "5841",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-15T07:32:59.759Z",
            "appointmentType": "routine",
            "slotId": "5845",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "scheduled",
            "scheduleId": "5843",
            "generatedOn": null
        },
        {
            "appointmentId": "5846",
            "uuid": "fcef44bf-af36-423e-ae93-cda6940a7ef1",
            "slot": {
                "start": "2026-05-15T07:32:00.000Z",
                "end": "2026-05-15T07:37:00.000Z"
            },
            "patientId": "5841",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-15T07:32:59.700Z",
            "appointmentType": "walkin",
            "slotId": "5844",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "completed",
            "scheduleId": "5842",
            "generatedOn": "2026-05-15T07:32:59.721Z"
        },
        {
            "appointmentId": "5823",
            "uuid": "2bc9acf4-85ca-4463-af61-5af7de39e263",
            "slot": {
                "start": "2026-05-14T11:17:00.000Z",
                "end": "2026-05-14T11:22:00.000Z"
            },
            "patientId": "5444",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-14T11:17:32.379Z",
            "appointmentType": "walkin",
            "slotId": "5822",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "completed",
            "scheduleId": "5821",
            "generatedOn": "2026-05-14T11:17:37.603Z"
        },
        {
            "appointmentId": "5805",
            "uuid": "0fc98a85-283c-4ba9-ba71-8502fdcda0e4",
            "slot": {
                "start": "2027-05-14T09:00:00.000Z",
                "end": "2027-05-14T09:05:00.000Z"
            },
            "patientId": "4981",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T09:04:40.641Z",
            "appointmentType": "routine",
            "slotId": "5804",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5803",
            "generatedOn": null
        },
        {
            "appointmentId": "5791",
            "uuid": "54e17e46-4006-4138-920c-c5845852e89b",
            "slot": {
                "start": "2027-05-14T07:00:00.000Z",
                "end": "2027-05-14T07:05:00.000Z"
            },
            "patientId": "595",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-14T07:13:33.345Z",
            "appointmentType": "routine",
            "slotId": "5788",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "scheduled",
            "scheduleId": "5786",
            "generatedOn": null
        },
        {
            "appointmentId": "5789",
            "uuid": "3d2ee3dd-3cd8-40b0-9aac-eb29d60c018d",
            "slot": {
                "start": "2026-05-14T07:13:00.000Z",
                "end": "2026-05-14T07:18:00.000Z"
            },
            "patientId": "595",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-14T07:13:33.281Z",
            "appointmentType": "walkin",
            "slotId": "5787",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "completed",
            "scheduleId": "5785",
            "generatedOn": "2026-05-14T07:13:33.310Z"
        },
        {
            "appointmentId": "5586",
            "uuid": "256410f1-5c37-45fc-a9f2-36de63dea9d8",
            "slot": {
                "start": "2026-08-12T06:30:00.000Z",
                "end": "2026-08-12T06:35:00.000Z"
            },
            "patientId": "5564",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T06:39:34.001Z",
            "appointmentType": "routine",
            "slotId": "5575",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5569",
            "generatedOn": null
        },
        {
            "appointmentId": "5584",
            "uuid": "ff2b9e77-e2c2-44c6-bf90-dfcac3c57185",
            "slot": {
                "start": "2026-05-14T06:39:00.000Z",
                "end": "2026-05-14T06:44:00.000Z"
            },
            "patientId": "5564",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T06:39:33.877Z",
            "appointmentType": "walkin",
            "slotId": "5574",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "5567",
            "generatedOn": "2026-05-14T06:39:33.916Z"
        },
        {
            "appointmentId": "5582",
            "uuid": "a9b3509a-d4c7-45e4-a33f-2f00b5fb9cef",
            "slot": {
                "start": "2027-05-14T06:30:00.000Z",
                "end": "2027-05-14T06:35:00.000Z"
            },
            "patientId": "5563",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T06:33:38.170Z",
            "appointmentType": "routine",
            "slotId": "5573",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5568",
            "generatedOn": null
        },
        {
            "appointmentId": "5580",
            "uuid": "937058a9-403c-45d8-82af-4b4ddf5c73a3",
            "slot": {
                "start": "2026-05-14T06:33:00.000Z",
                "end": "2026-05-14T06:38:00.000Z"
            },
            "patientId": "5563",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T06:33:38.050Z",
            "appointmentType": "walkin",
            "slotId": "5572",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "5567",
            "generatedOn": "2026-05-14T06:33:38.088Z"
        },
        {
            "appointmentId": "5578",
            "uuid": "6f464f42-2769-4e51-88c7-8f1d24e6b962",
            "slot": {
                "start": "2026-11-10T06:00:00.000Z",
                "end": "2026-11-10T06:05:00.000Z"
            },
            "patientId": "5562",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T06:29:35.974Z",
            "appointmentType": "routine",
            "slotId": "5571",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5566",
            "generatedOn": null
        },
        {
            "appointmentId": "5576",
            "uuid": "540e8175-7144-48f7-a6f3-a74c9bae7eb8",
            "slot": {
                "start": "2026-05-14T06:29:00.000Z",
                "end": "2026-05-14T06:34:00.000Z"
            },
            "patientId": "5562",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-14T06:29:35.852Z",
            "appointmentType": "walkin",
            "slotId": "5570",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "5565",
            "generatedOn": "2026-05-14T06:29:35.892Z"
        },
        {
            "appointmentId": "5458",
            "uuid": "0c295c88-4f4b-4c04-92d2-a799aa61c866",
            "slot": {
                "start": "2026-11-09T10:30:00.000Z",
                "end": "2026-11-09T10:35:00.000Z"
            },
            "patientId": "5444",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-13T10:32:09.339Z",
            "appointmentType": "routine",
            "slotId": "5451",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "scheduled",
            "scheduleId": "5447",
            "generatedOn": null
        },
        {
            "appointmentId": "5456",
            "uuid": "74696832-4a31-4ea8-ad88-167abf73bce8",
            "slot": {
                "start": "2026-05-13T10:32:00.000Z",
                "end": "2026-05-13T10:37:00.000Z"
            },
            "patientId": "5444",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-13T10:32:09.287Z",
            "appointmentType": "walkin",
            "slotId": "5450",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "completed",
            "scheduleId": "5445",
            "generatedOn": "2026-05-13T10:32:09.305Z"
        },
        {
            "appointmentId": "5454",
            "uuid": "5ee202fe-633f-4854-b897-96143ccdda20",
            "slot": {
                "start": "2027-05-13T10:30:00.000Z",
                "end": "2027-05-13T10:35:00.000Z"
            },
            "patientId": "5443",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-13T10:30:16.210Z",
            "appointmentType": "routine",
            "slotId": "5449",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "scheduled",
            "scheduleId": "5446",
            "generatedOn": null
        },
        {
            "appointmentId": "5452",
            "uuid": "6cef65d6-2f68-4013-9689-f058712114f7",
            "slot": {
                "start": "2026-05-13T10:30:00.000Z",
                "end": "2026-05-13T10:35:00.000Z"
            },
            "patientId": "5443",
            "roleId": "4755",
            "campaignId": null,
            "createdOn": "2026-05-13T10:30:16.151Z",
            "appointmentType": "walkin",
            "slotId": "5448",
            "practitionerId": "4756",
            "hospitalFhirId": "4751",
            "hospitalId": null,
            "hospitalName": "Apollo Civil ward",
            "hospitalCode": "CIV01",
            "status": "completed",
            "scheduleId": "5445",
            "generatedOn": "2026-05-13T10:30:16.169Z"
        },
        {
            "appointmentId": "5312",
            "uuid": "4391ba25-2f44-4521-b3f2-ad63e3803bf2",
            "slot": {
                "start": "2026-08-11T09:00:00.000Z",
                "end": "2026-08-11T09:05:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-13T09:08:15.788Z",
            "appointmentType": "routine",
            "slotId": "5309",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5303",
            "generatedOn": null
        },
        {
            "appointmentId": "5310",
            "uuid": "6ed58d92-2934-4a8d-8a14-78cce5252054",
            "slot": {
                "start": "2026-05-13T09:08:00.000Z",
                "end": "2026-05-13T09:13:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-13T09:08:15.767Z",
            "appointmentType": "walkin",
            "slotId": "5308",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "5307",
            "generatedOn": "2026-05-13T09:08:15.778Z"
        },
        {
            "appointmentId": "5305",
            "uuid": "bd42953a-af7b-4c4e-8df6-6b0ca8159cce",
            "slot": {
                "start": "2026-08-11T09:00:00.000Z",
                "end": "2026-08-11T09:05:00.000Z"
            },
            "patientId": "4981",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-13T09:07:45.425Z",
            "appointmentType": "routine",
            "slotId": "5304",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5303",
            "generatedOn": null
        },
        {
            "appointmentId": "5254",
            "uuid": "7e2aee71-e5a5-4935-a96d-53aa59e38dc6",
            "slot": {
                "start": "2026-08-11T09:00:00.000Z",
                "end": "2026-08-11T09:05:00.000Z"
            },
            "patientId": "5247",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T09:02:08.171Z",
            "appointmentType": "routine",
            "slotId": "5251",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "scheduled",
            "scheduleId": "5249",
            "generatedOn": null
        },
        {
            "appointmentId": "5252",
            "uuid": "512a11a6-d5c5-493f-a03d-bfea0711c7e7",
            "slot": {
                "start": "2026-05-13T09:02:00.000Z",
                "end": "2026-05-13T09:07:00.000Z"
            },
            "patientId": "5247",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T09:02:08.121Z",
            "appointmentType": "walkin",
            "slotId": "5250",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "completed",
            "scheduleId": "5248",
            "generatedOn": "2026-05-13T09:02:08.137Z"
        },
        {
            "appointmentId": "5138",
            "uuid": "d03ebf1c-9dcd-41f7-a54d-4f0ef8f91651",
            "slot": {
                "start": "2027-05-13T08:30:00.000Z",
                "end": "2027-05-13T08:35:00.000Z"
            },
            "patientId": "5130",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T08:45:55.279Z",
            "appointmentType": "routine",
            "slotId": "5135",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "scheduled",
            "scheduleId": "5133",
            "generatedOn": null
        },
        {
            "appointmentId": "5136",
            "uuid": "d6bb3f05-c29a-459d-95e4-ceb4ff5783cd",
            "slot": {
                "start": "2026-05-13T08:45:00.000Z",
                "end": "2026-05-13T08:50:00.000Z"
            },
            "patientId": "5130",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T08:45:55.211Z",
            "appointmentType": "walkin",
            "slotId": "5134",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "completed",
            "scheduleId": "5132",
            "generatedOn": "2026-05-13T08:45:55.224Z"
        },
        {
            "appointmentId": "5059",
            "uuid": "cf8b83b7-e3ca-446f-a81c-a4fa1b25d17e",
            "slot": {
                "start": "2026-05-14T05:00:00.000Z",
                "end": "2026-05-14T05:05:00.000Z"
            },
            "patientId": "4981",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-13T08:39:57.023Z",
            "appointmentType": "routine",
            "slotId": "5054",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "noshow",
            "scheduleId": "5051",
            "generatedOn": "2026-05-14T09:04:40.279Z"
        },
        {
            "appointmentId": "5057",
            "uuid": "10f27fcb-e605-4d50-9877-3faae5277282",
            "slot": {
                "start": "2027-05-13T08:30:00.000Z",
                "end": "2027-05-13T08:35:00.000Z"
            },
            "patientId": "4981",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-13T08:38:10.568Z",
            "appointmentType": "routine",
            "slotId": "5053",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "5050",
            "generatedOn": null
        },
        {
            "appointmentId": "5055",
            "uuid": "5af2b62b-11dc-450d-900d-91f870b350cc",
            "slot": {
                "start": "2026-05-13T08:38:00.000Z",
                "end": "2026-05-13T08:43:00.000Z"
            },
            "patientId": "4981",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-13T08:38:10.432Z",
            "appointmentType": "walkin",
            "slotId": "5052",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "5049",
            "generatedOn": "2026-05-13T08:38:10.474Z"
        },
        {
            "appointmentId": "4923",
            "uuid": "d8bee7d2-b84e-49b7-a9d7-ec45426f1ccb",
            "slot": {
                "start": "2027-05-13T08:00:00.000Z",
                "end": "2027-05-13T08:05:00.000Z"
            },
            "patientId": "4788",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T08:00:16.005Z",
            "appointmentType": "routine",
            "slotId": "4922",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "scheduled",
            "scheduleId": "4920",
            "generatedOn": null
        },
        {
            "appointmentId": "4887",
            "uuid": "4797df92-5aef-4a93-b4ac-e67d028d2837",
            "slot": {
                "start": "2026-05-13T07:55:00.000Z",
                "end": "2026-05-13T08:00:00.000Z"
            },
            "patientId": "4788",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T07:55:22.519Z",
            "appointmentType": "walkin",
            "slotId": "4886",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "completed",
            "scheduleId": "4823",
            "generatedOn": "2026-05-13T07:55:28.662Z"
        },
        {
            "appointmentId": "4829",
            "uuid": "e052b7f2-f054-4517-b867-b599c30ea7fd",
            "slot": {
                "start": "2027-05-13T07:30:00.000Z",
                "end": "2027-05-13T07:35:00.000Z"
            },
            "patientId": "4822",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T07:44:45.181Z",
            "appointmentType": "routine",
            "slotId": "4826",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "scheduled",
            "scheduleId": "4824",
            "generatedOn": null
        },
        {
            "appointmentId": "4827",
            "uuid": "e3ac42be-4161-40c0-8ef7-9abdc8da5d31",
            "slot": {
                "start": "2026-05-13T07:44:00.000Z",
                "end": "2026-05-13T07:49:00.000Z"
            },
            "patientId": "4822",
            "roleId": "4753",
            "campaignId": null,
            "createdOn": "2026-05-13T07:44:45.131Z",
            "appointmentType": "walkin",
            "slotId": "4825",
            "practitionerId": "4754",
            "hospitalFhirId": "4746",
            "hospitalId": null,
            "hospitalName": "Aveksha",
            "hospitalCode": "VID001",
            "status": "completed",
            "scheduleId": "4823",
            "generatedOn": "2026-05-13T07:44:45.147Z"
        },
        {
            "appointmentId": "4286",
            "uuid": "5b67ee51-ec27-4cea-b465-63c136c988f0",
            "slot": {
                "start": "2026-05-11T12:31:00.000Z",
                "end": "2026-05-11T12:36:00.000Z"
            },
            "patientId": "4239",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T12:31:18.732Z",
            "appointmentType": "walkin",
            "slotId": "4285",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "walkin",
            "scheduleId": "4284",
            "generatedOn": null
        },
        {
            "appointmentId": "4270",
            "uuid": "39cd4cb0-539e-4865-a25a-e7c37cb602f5",
            "slot": {
                "start": "2026-05-11T11:05:00.000Z",
                "end": "2026-05-11T11:10:00.000Z"
            },
            "patientId": "4236",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T11:05:20.166Z",
            "appointmentType": "walkin",
            "slotId": "4269",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "walkin",
            "scheduleId": "4268",
            "generatedOn": null
        },
        {
            "appointmentId": "4219",
            "uuid": "93943faf-2e4c-4170-9236-aaa349eb5988",
            "slot": {
                "start": "2026-11-07T09:30:00.000Z",
                "end": "2026-11-07T09:35:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T09:34:51.958Z",
            "appointmentType": "routine",
            "slotId": "4218",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "4217",
            "generatedOn": null
        },
        {
            "appointmentId": "3931",
            "uuid": "j0e1f2g3-h4i5-4j6k-7l8m-n9o0p1q2r3s4",
            "slot": {
                "start": "2026-05-11T17:50:00.000Z",
                "end": "2026-05-11T17:55:00.000Z"
            },
            "patientId": "3900",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T17:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3922",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3917",
            "generatedOn": "2026-05-11T17:50:00.000Z"
        },
        {
            "appointmentId": "3929",
            "uuid": "i9d0e1f2-g3h4-4i5j-6k7l-m8n9o0p1q2r3",
            "slot": {
                "start": "2026-05-11T17:45:00.000Z",
                "end": "2026-05-11T17:50:00.000Z"
            },
            "patientId": "3899",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T17:45:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3921",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3917",
            "generatedOn": "2026-05-11T17:45:00.000Z"
        },
        {
            "appointmentId": "3927",
            "uuid": "h8c9d0e1-f2g3-4h4i-5j6k-l7m8n9o0p1q2",
            "slot": {
                "start": "2026-05-11T17:40:00.000Z",
                "end": "2026-05-11T17:45:00.000Z"
            },
            "patientId": "3898",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T17:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3920",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3917",
            "generatedOn": "2026-05-11T17:40:00.000Z"
        },
        {
            "appointmentId": "3925",
            "uuid": "g7b8c9d0-e1f2-4g3h-4i5j-k6l7m8n9o0p1",
            "slot": {
                "start": "2026-05-11T17:35:00.000Z",
                "end": "2026-05-11T17:40:00.000Z"
            },
            "patientId": "3897",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T17:35:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3919",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3917",
            "generatedOn": "2026-05-11T17:35:00.000Z"
        },
        {
            "appointmentId": "3923",
            "uuid": "f6a7b8c9-d0e1-4f2g-3h4i-j5k6l7m8n9o0",
            "slot": {
                "start": "2026-05-11T17:30:00.000Z",
                "end": "2026-05-11T17:35:00.000Z"
            },
            "patientId": "3896",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T17:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3918",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3917",
            "generatedOn": "2026-05-11T17:30:00.000Z"
        },
        {
            "appointmentId": "3915",
            "uuid": "e5f6a7b8-c9d0-4e1f-2g3h-i4j5k6l7m8n9",
            "slot": {
                "start": "2026-05-11T16:50:00.000Z",
                "end": "2026-05-11T16:55:00.000Z"
            },
            "patientId": "3895",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T16:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3906",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3901",
            "generatedOn": "2026-05-11T16:50:00.000Z"
        },
        {
            "appointmentId": "3913",
            "uuid": "d4e5f6a7-b8c9-4d0e-1f2g-h3i4j5k6l7m8",
            "slot": {
                "start": "2026-05-11T16:45:00.000Z",
                "end": "2026-05-11T16:50:00.000Z"
            },
            "patientId": "3894",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T16:45:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3905",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3901",
            "generatedOn": "2026-05-11T16:45:00.000Z"
        },
        {
            "appointmentId": "3911",
            "uuid": "c3d4e5f6-a7b8-4c9d-0e1f-g2h3i4j5k6l7",
            "slot": {
                "start": "2026-05-11T16:40:00.000Z",
                "end": "2026-05-11T16:45:00.000Z"
            },
            "patientId": "3893",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T16:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3904",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3901",
            "generatedOn": "2026-05-11T16:40:00.000Z"
        },
        {
            "appointmentId": "3909",
            "uuid": "b2c3d4e5-f6a7-4b8c-9d0e-f1g2h3i4j5k6",
            "slot": {
                "start": "2026-05-11T16:35:00.000Z",
                "end": "2026-05-11T16:40:00.000Z"
            },
            "patientId": "3892",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T16:35:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3903",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3901",
            "generatedOn": "2026-05-11T16:35:00.000Z"
        },
        {
            "appointmentId": "3907",
            "uuid": "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
            "slot": {
                "start": "2026-05-11T16:30:00.000Z",
                "end": "2026-05-11T16:35:00.000Z"
            },
            "patientId": "3891",
            "roleId": "1346",
            "campaignId": null,
            "createdOn": "2026-05-11T16:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3902",
            "practitionerId": "1347",
            "hospitalFhirId": "1344",
            "hospitalId": null,
            "hospitalName": "Okhla HF",
            "hospitalCode": "HF003",
            "status": "completed",
            "scheduleId": "3901",
            "generatedOn": "2026-05-11T16:30:00.000Z"
        },
        {
            "appointmentId": "3747",
            "uuid": "j7h0e1f2-g3h4-4i5j-f6g7-h8i9j0k1l2m3",
            "slot": {
                "start": "2026-05-11T15:50:00.000Z",
                "end": "2026-05-11T15:55:00.000Z"
            },
            "patientId": "2974",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T15:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3738",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3731",
            "generatedOn": "2026-05-11T15:50:00.000Z"
        },
        {
            "appointmentId": "3745",
            "uuid": "i6g9d0e1-f2g3-4h4i-e5f6-g7h8i9j0k1l2",
            "slot": {
                "start": "2026-05-11T15:45:00.000Z",
                "end": "2026-05-11T15:50:00.000Z"
            },
            "patientId": "2973",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T15:45:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3737",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3731",
            "generatedOn": "2026-05-11T15:45:00.000Z"
        },
        {
            "appointmentId": "3743",
            "uuid": "h5f8c9d0-e1f2-4g3h-d4e5-f6g7h8i9j0k1",
            "slot": {
                "start": "2026-05-11T15:40:00.000Z",
                "end": "2026-05-11T15:45:00.000Z"
            },
            "patientId": "2972",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T15:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3736",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3731",
            "generatedOn": "2026-05-11T15:40:00.000Z"
        },
        {
            "appointmentId": "3741",
            "uuid": "g4e7b8c9-d0e1-4f2g-c3d4-e5f6g7h8i9j0",
            "slot": {
                "start": "2026-05-11T15:35:00.000Z",
                "end": "2026-05-11T15:40:00.000Z"
            },
            "patientId": "2971",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T15:35:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3735",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3731",
            "generatedOn": "2026-05-11T15:35:00.000Z"
        },
        {
            "appointmentId": "3739",
            "uuid": "f3d6a7b8-c9d0-4e1f-b2c3-d4e5f6g7h8i9",
            "slot": {
                "start": "2026-05-11T15:30:00.000Z",
                "end": "2026-05-11T15:35:00.000Z"
            },
            "patientId": "2970",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T15:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3734",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3731",
            "generatedOn": "2026-05-11T15:30:00.000Z"
        },
        {
            "appointmentId": "3617",
            "uuid": "e2c5f6g7-h8i9-4j0k-2l3m-4n5o6p7q8r9s",
            "slot": {
                "start": "2026-05-11T14:50:00.000Z",
                "end": "2026-05-11T14:55:00.000Z"
            },
            "patientId": "2969",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T14:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3608",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3603",
            "generatedOn": "2026-05-11T14:50:00.000Z"
        },
        {
            "appointmentId": "3615",
            "uuid": "d1b4e5f6-g7h8-4i9j-1k2l-3m4n5o6p7q8r",
            "slot": {
                "start": "2026-05-11T14:45:00.000Z",
                "end": "2026-05-11T14:50:00.000Z"
            },
            "patientId": "2968",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T14:45:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3607",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3603",
            "generatedOn": "2026-05-11T14:45:00.000Z"
        },
        {
            "appointmentId": "3613",
            "uuid": "c0a3d4e5-f6g7-4h8i-0j1k-2l3m4n5o6p7q",
            "slot": {
                "start": "2026-05-11T14:40:00.000Z",
                "end": "2026-05-11T14:45:00.000Z"
            },
            "patientId": "2967",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T14:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3606",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3603",
            "generatedOn": "2026-05-11T14:40:00.000Z"
        },
        {
            "appointmentId": "3611",
            "uuid": "b9f2c3d4-e5f6-4g7h-9i0j-1k2l3m4n5o6p",
            "slot": {
                "start": "2026-05-11T14:35:00.000Z",
                "end": "2026-05-11T14:40:00.000Z"
            },
            "patientId": "2966",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T14:35:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3605",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3603",
            "generatedOn": "2026-05-11T14:35:00.000Z"
        },
        {
            "appointmentId": "3609",
            "uuid": "a8e1b2c3-d4e5-4f6g-8h9i-0j1k2l3m4n5o",
            "slot": {
                "start": "2026-05-11T14:30:00.000Z",
                "end": "2026-05-11T14:35:00.000Z"
            },
            "patientId": "2965",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T14:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3604",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3603",
            "generatedOn": "2026-05-11T14:30:00.000Z"
        },
        {
            "appointmentId": "3587",
            "uuid": "f2431c94-3062-47d2-af7a-fcedb5872dc7",
            "slot": {
                "start": "2026-05-11T04:31:00.000Z",
                "end": "2026-05-11T04:36:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-11T04:31:09.437Z",
            "appointmentType": "walkin",
            "slotId": "3586",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3585",
            "generatedOn": "2026-05-11T04:31:17.736Z"
        },
        {
            "appointmentId": "3561",
            "uuid": "50004c1d-247a-46c6-b613-b55b02618bfa",
            "slot": {
                "start": "2026-05-08T10:00:00.000Z",
                "end": "2026-05-08T10:05:00.000Z"
            },
            "patientId": "1022",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T10:00:03.857Z",
            "appointmentType": "walkin",
            "slotId": "3560",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "3559",
            "generatedOn": "2026-05-08T10:00:05.487Z"
        },
        {
            "appointmentId": "2995",
            "uuid": "06ff21b7-cc37-4f75-8540-53e98cd877ec",
            "slot": {
                "start": "2026-08-06T05:30:00.000Z",
                "end": "2026-08-06T05:35:00.000Z"
            },
            "patientId": "603",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T05:51:18.815Z",
            "appointmentType": "routine",
            "slotId": "2992",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2990",
            "generatedOn": null
        },
        {
            "appointmentId": "2993",
            "uuid": "762a0d33-a1cd-49f2-a15a-a694dafce165",
            "slot": {
                "start": "2026-05-08T05:51:00.000Z",
                "end": "2026-05-08T05:56:00.000Z"
            },
            "patientId": "603",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T05:51:18.488Z",
            "appointmentType": "walkin",
            "slotId": "2991",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2989",
            "generatedOn": "2026-05-08T05:51:18.567Z"
        },
        {
            "appointmentId": "2940",
            "uuid": "749920cd-a5b1-4608-93ac-d889866505af",
            "slot": {
                "start": "2026-08-06T05:00:00.000Z",
                "end": "2026-08-06T05:05:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T05:23:46.338Z",
            "appointmentType": "routine",
            "slotId": "2939",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2938",
            "generatedOn": null
        },
        {
            "appointmentId": "2936",
            "uuid": "18da5568-b253-4287-8af5-81d9aa741ae2",
            "slot": {
                "start": "2026-11-04T05:00:00.000Z",
                "end": "2026-11-04T05:05:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T05:23:19.052Z",
            "appointmentType": "routine",
            "slotId": "2935",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2934",
            "generatedOn": null
        },
        {
            "appointmentId": "2873",
            "uuid": "c178505e-f6cd-4ad8-9c37-da2081855eac",
            "slot": {
                "start": "2027-05-08T04:00:00.000Z",
                "end": "2027-05-08T04:05:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T04:03:39.555Z",
            "appointmentType": "routine",
            "slotId": "2870",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2868",
            "generatedOn": null
        },
        {
            "appointmentId": "2871",
            "uuid": "930fd737-0b06-4ee0-a0ce-f0cb97152c2d",
            "slot": {
                "start": "2026-05-08T04:03:00.000Z",
                "end": "2026-05-08T04:08:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-08T04:03:39.536Z",
            "appointmentType": "walkin",
            "slotId": "2869",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2867",
            "generatedOn": "2026-05-08T04:03:39.545Z"
        },
        {
            "appointmentId": "2807",
            "uuid": "e5e7ee9c-c3b4-439f-9f2d-d478b1791a49",
            "slot": {
                "start": "2026-11-03T11:00:00.000Z",
                "end": "2026-11-03T11:05:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-07T11:04:31.928Z",
            "appointmentType": "routine",
            "slotId": "2806",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2805",
            "generatedOn": null
        },
        {
            "appointmentId": "2751",
            "uuid": "e5c2679b-218c-484f-a087-cda299f05c31",
            "slot": {
                "start": "2027-05-07T09:00:00.000Z",
                "end": "2027-05-07T09:05:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-07T09:20:52.174Z",
            "appointmentType": "routine",
            "slotId": "2750",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2749",
            "generatedOn": null
        },
        {
            "appointmentId": "2728",
            "uuid": "320a5950-6c5d-4b33-bc20-d7d69195441d",
            "slot": {
                "start": "2026-08-05T05:30:00.000Z",
                "end": "2026-08-05T05:35:00.000Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-07T05:58:22.661Z",
            "appointmentType": "routine",
            "slotId": "2727",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2726",
            "generatedOn": null
        },
        {
            "appointmentId": "2674",
            "uuid": "5af6e213-a5f3-4a4c-a274-de7cb6fe638c",
            "slot": {
                "start": "2026-11-02T10:00:00.000Z",
                "end": "2026-11-02T10:05:00.000Z"
            },
            "patientId": "2667",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T10:05:44.877Z",
            "appointmentType": "routine",
            "slotId": "2671",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2669",
            "generatedOn": null
        },
        {
            "appointmentId": "2672",
            "uuid": "d35af75d-4855-47de-9227-a46ec80e1666",
            "slot": {
                "start": "2026-05-06T10:05:00.000Z",
                "end": "2026-05-06T10:10:00.000Z"
            },
            "patientId": "2667",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T10:05:44.753Z",
            "appointmentType": "walkin",
            "slotId": "2670",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2668",
            "generatedOn": "2026-05-06T10:05:44.792Z"
        },
        {
            "appointmentId": "2646",
            "uuid": "39d7e184-f6b2-4bc3-8c54-7267284f46fa",
            "slot": {
                "start": "2026-11-01T05:30:00.000Z",
                "end": "2026-11-01T05:35:00.000Z"
            },
            "patientId": "1374",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T05:40:42.328Z",
            "appointmentType": "routine",
            "slotId": "2643",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "scheduled",
            "scheduleId": "1375",
            "generatedOn": null
        },
        {
            "appointmentId": "2644",
            "uuid": "d423b895-21a5-476a-8962-5d55d96e3c0d",
            "slot": {
                "start": "2026-05-05T05:40:00.000Z",
                "end": "2026-05-05T05:45:00.000Z"
            },
            "patientId": "1374",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T05:40:42.310Z",
            "appointmentType": "walkin",
            "slotId": "2642",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "1358",
            "generatedOn": "2026-05-05T05:40:42.321Z"
        },
        {
            "appointmentId": "2590",
            "uuid": "cde1012c-b0d1-4c0a-9521-8385a5003b5e",
            "slot": {
                "start": "2026-08-04T06:00:00.000Z",
                "end": "2026-08-04T06:05:00.000Z"
            },
            "patientId": "603",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T06:04:05.789Z",
            "appointmentType": "routine",
            "slotId": "2587",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2585",
            "generatedOn": null
        },
        {
            "appointmentId": "2588",
            "uuid": "38223ac2-e2f1-4a9e-b77b-15999b491d1d",
            "slot": {
                "start": "2026-05-06T06:04:00.000Z",
                "end": "2026-05-06T06:09:00.000Z"
            },
            "patientId": "603",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T06:04:05.600Z",
            "appointmentType": "walkin",
            "slotId": "2586",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2584",
            "generatedOn": "2026-05-06T06:04:05.659Z"
        },
        {
            "appointmentId": "2572",
            "uuid": "c0f9149e-f8fb-4300-ab66-14cd6e0a452a",
            "slot": {
                "start": "2026-05-06T19:11:36.624Z",
                "end": "2026-05-06T19:16:36.624Z"
            },
            "patientId": "1126",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T05:38:19.567Z",
            "appointmentType": "routine",
            "slotId": "2571",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2570",
            "generatedOn": "2026-05-06T05:40:01.458Z"
        },
        {
            "appointmentId": "2468",
            "uuid": "4e7fdd14-d856-4196-9d9d-526c5caa0a94",
            "slot": {
                "start": "2027-05-06T04:30:00.000Z",
                "end": "2027-05-06T04:35:00.000Z"
            },
            "patientId": "2460",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-06T04:30:03.699Z",
            "appointmentType": "routine",
            "slotId": "2465",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "scheduled",
            "scheduleId": "2463",
            "generatedOn": null
        },
        {
            "appointmentId": "2466",
            "uuid": "9c34a7b3-98f5-423d-8387-1ffa4777545b",
            "slot": {
                "start": "2026-05-06T04:30:00.000Z",
                "end": "2026-05-06T04:35:00.000Z"
            },
            "patientId": "2460",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-06T04:30:03.553Z",
            "appointmentType": "walkin",
            "slotId": "2464",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "2462",
            "generatedOn": "2026-05-06T04:30:03.611Z"
        },
        {
            "appointmentId": "2430",
            "uuid": "18783de4-9a63-457b-ba50-b625d81bc886",
            "slot": {
                "start": "2027-05-06T03:30:00.000Z",
                "end": "2027-05-06T03:35:00.000Z"
            },
            "patientId": "1022",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T03:48:08.590Z",
            "appointmentType": "routine",
            "slotId": "2427",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2425",
            "generatedOn": null
        },
        {
            "appointmentId": "2428",
            "uuid": "1bedea5f-8ed2-4473-ab1e-d1db77884cb8",
            "slot": {
                "start": "2026-05-06T03:48:00.000Z",
                "end": "2026-05-06T03:53:00.000Z"
            },
            "patientId": "1022",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T03:48:08.417Z",
            "appointmentType": "walkin",
            "slotId": "2426",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2406",
            "generatedOn": "2026-05-06T03:48:08.475Z"
        },
        {
            "appointmentId": "2412",
            "uuid": "1fd4574b-c92a-4766-b64d-ad4e99c35862",
            "slot": {
                "start": "2026-08-04T03:30:00.000Z",
                "end": "2026-08-04T03:35:00.000Z"
            },
            "patientId": "1924",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T03:50:27.518Z",
            "appointmentType": "routine",
            "slotId": "2409",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2407",
            "generatedOn": null
        },
        {
            "appointmentId": "2410",
            "uuid": "3be75b11-b0bf-4730-9b2e-7e50ae461198",
            "slot": {
                "start": "2026-05-06T03:50:00.000Z",
                "end": "2026-05-06T03:55:00.000Z"
            },
            "patientId": "1924",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-06T03:50:27.505Z",
            "appointmentType": "walkin",
            "slotId": "2408",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2406",
            "generatedOn": "2026-05-06T03:50:27.509Z"
        },
        {
            "appointmentId": "2124",
            "uuid": "b1ef8b92-c151-4d24-aa6b-e7db4318a132",
            "slot": {
                "start": "2026-11-08T17:00:00.000Z",
                "end": "2026-11-08T17:05:00.000Z"
            },
            "patientId": "649",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-12T17:23:12.283Z",
            "appointmentType": "routine",
            "slotId": "2121",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "2119",
            "generatedOn": null
        },
        {
            "appointmentId": "2122",
            "uuid": "cad9ce1a-0400-41cb-9270-170a3ec8a0c0",
            "slot": {
                "start": "2026-05-12T17:23:00.000Z",
                "end": "2026-05-12T17:28:00.000Z"
            },
            "patientId": "649",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-12T17:23:12.163Z",
            "appointmentType": "walkin",
            "slotId": "2120",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "2118",
            "generatedOn": "2026-05-12T17:23:12.206Z"
        },
        {
            "appointmentId": "1937",
            "uuid": "6eb3777b-72f0-432d-80e2-8b4d1ce4db48",
            "slot": {
                "start": "2026-08-03T17:30:00.000Z",
                "end": "2026-08-03T17:35:00.000Z"
            },
            "patientId": "1924",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:41:27.192Z",
            "appointmentType": "routine",
            "slotId": "1930",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "1926",
            "generatedOn": null
        },
        {
            "appointmentId": "1935",
            "uuid": "a7127a75-e0f7-41b6-960c-6ae71c3b8ec7",
            "slot": {
                "start": "2026-05-05T17:41:00.000Z",
                "end": "2026-05-05T17:46:00.000Z"
            },
            "patientId": "1924",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:41:27.177Z",
            "appointmentType": "walkin",
            "slotId": "1929",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "1925",
            "generatedOn": "2026-05-05T17:41:27.185Z"
        },
        {
            "appointmentId": "1933",
            "uuid": "447758cd-7a46-42a2-92f2-26db4866d5f8",
            "slot": {
                "start": "2026-08-03T17:30:00.000Z",
                "end": "2026-08-03T17:35:00.000Z"
            },
            "patientId": "1923",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:40:05.650Z",
            "appointmentType": "routine",
            "slotId": "1928",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "1926",
            "generatedOn": null
        },
        {
            "appointmentId": "1931",
            "uuid": "4fa8c698-2d4e-45dd-a6e9-32cca0c78723",
            "slot": {
                "start": "2026-05-05T17:40:00.000Z",
                "end": "2026-05-05T17:45:00.000Z"
            },
            "patientId": "1923",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:40:05.631Z",
            "appointmentType": "walkin",
            "slotId": "1927",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "1925",
            "generatedOn": "2026-05-05T17:40:05.637Z"
        },
        {
            "appointmentId": "1871",
            "uuid": "f9de3feb-663c-4f7e-bc53-2431be5a258d",
            "slot": {
                "start": "2026-08-03T17:00:00.000Z",
                "end": "2026-08-03T17:05:00.000Z"
            },
            "patientId": "603",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:03:20.224Z",
            "appointmentType": "routine",
            "slotId": "1870",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "1869",
            "generatedOn": null
        },
        {
            "appointmentId": "1867",
            "uuid": "8c07bbf4-733a-4c7e-8400-18f538717420",
            "slot": {
                "start": "2026-05-05T17:02:00.000Z",
                "end": "2026-05-05T17:07:00.000Z"
            },
            "patientId": "603",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:02:23.253Z",
            "appointmentType": "walkin",
            "slotId": "1866",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "completed",
            "scheduleId": "1865",
            "generatedOn": "2026-05-05T17:03:19.980Z"
        },
        {
            "appointmentId": "1863",
            "uuid": "b1b90e04-6c6f-49d0-b034-3e780bb20944",
            "slot": {
                "start": "2026-05-07T03:00:00.000Z",
                "end": "2026-05-07T03:05:00.000Z"
            },
            "patientId": "598",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T17:00:58.319Z",
            "appointmentType": "routine",
            "slotId": "1862",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "noshow",
            "scheduleId": "1861",
            "generatedOn": null
        },
        {
            "appointmentId": "1789",
            "uuid": "5bf9f2cd-2c8b-47c5-acaf-bc6c3cf1e588",
            "slot": {
                "start": "2026-05-05T09:58:00.000Z",
                "end": "2026-05-05T10:03:00.000Z"
            },
            "patientId": "1374",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T09:58:37.721Z",
            "appointmentType": "walkin",
            "slotId": "1788",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "1787",
            "generatedOn": "2026-05-05T09:58:40.833Z"
        },
        {
            "appointmentId": "1696",
            "uuid": "05eb23fa-957c-42f6-b558-eeda7f5c2f98",
            "slot": {
                "start": "2026-11-01T11:00:00.000Z",
                "end": "2026-11-01T11:05:00.000Z"
            },
            "patientId": "1689",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T11:18:16.818Z",
            "appointmentType": "routine",
            "slotId": "1693",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "scheduled",
            "scheduleId": "1691",
            "generatedOn": null
        },
        {
            "appointmentId": "1694",
            "uuid": "2ae4d4e0-1369-4ea5-a22d-d7c6a2af3b86",
            "slot": {
                "start": "2026-05-05T11:18:00.000Z",
                "end": "2026-05-05T11:23:00.000Z"
            },
            "patientId": "1689",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T11:18:16.698Z",
            "appointmentType": "walkin",
            "slotId": "1692",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "1690",
            "generatedOn": "2026-05-05T11:18:16.757Z"
        },
        {
            "appointmentId": "1580",
            "uuid": "10753c04-da63-4785-803c-af2bb508adc9",
            "slot": {
                "start": "2027-05-05T09:30:00.000Z",
                "end": "2027-05-05T09:35:00.000Z"
            },
            "patientId": "598",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T09:58:09.010Z",
            "appointmentType": "routine",
            "slotId": "1579",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "1578",
            "generatedOn": null
        },
        {
            "appointmentId": "1536",
            "uuid": "d55d2a99-8c66-4666-ad26-b24a9d1d5c87",
            "slot": {
                "start": "2026-05-05T06:17:00.000Z",
                "end": "2026-05-05T06:22:00.000Z"
            },
            "patientId": "1382",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T06:17:58.073Z",
            "appointmentType": "routine",
            "slotId": "1533",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "1530",
            "generatedOn": "2026-05-05T06:17:58.120Z"
        },
        {
            "appointmentId": "1534",
            "uuid": "3af078a1-d153-4cc2-95d1-1f395133aee9",
            "slot": {
                "start": "2026-08-03T06:00:00.000Z",
                "end": "2026-08-03T06:05:00.000Z"
            },
            "patientId": "1382",
            "roleId": "1350",
            "campaignId": null,
            "createdOn": "2026-05-05T06:17:58.204Z",
            "appointmentType": "routine",
            "slotId": "1532",
            "practitionerId": "1351",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "scheduled",
            "scheduleId": "1531",
            "generatedOn": null
        },
        {
            "appointmentId": "1481",
            "uuid": "b7e33ba1-f5d2-47c0-9bb4-fd94aeeedb73",
            "slot": {
                "start": "2027-05-05T05:30:00.000Z",
                "end": "2027-05-05T05:35:00.000Z"
            },
            "patientId": "1357",
            "roleId": "1348",
            "campaignId": null,
            "createdOn": "2026-05-05T05:37:05.731Z",
            "appointmentType": "routine",
            "slotId": "1474",
            "practitionerId": "1349",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "scheduled",
            "scheduleId": "1359",
            "generatedOn": null
        },
        {
            "appointmentId": "1479",
            "uuid": "e4445fbe-9479-4138-8e33-ee0a886845fa",
            "slot": {
                "start": "2026-05-05T05:37:00.000Z",
                "end": "2026-05-05T05:42:00.000Z"
            },
            "patientId": "1357",
            "roleId": "1348",
            "campaignId": null,
            "createdOn": "2026-05-05T05:37:05.679Z",
            "appointmentType": "walkin",
            "slotId": "1473",
            "practitionerId": "1349",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "1358",
            "generatedOn": "2026-05-05T05:37:05.699Z"
        },
        {
            "appointmentId": "1477",
            "uuid": "36ae7696-c7db-4ffb-a351-8b71d375f8f8",
            "slot": {
                "start": "2027-05-05T05:30:00.000Z",
                "end": "2027-05-05T05:35:00.000Z"
            },
            "patientId": "1356",
            "roleId": "1348",
            "campaignId": null,
            "createdOn": "2026-05-05T05:35:23.066Z",
            "appointmentType": "routine",
            "slotId": "1472",
            "practitionerId": "1349",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "scheduled",
            "scheduleId": "1359",
            "generatedOn": null
        },
        {
            "appointmentId": "1475",
            "uuid": "4d7221c4-573e-4be8-b751-5d75818b1c2c",
            "slot": {
                "start": "2026-05-05T05:35:00.000Z",
                "end": "2026-05-05T05:40:00.000Z"
            },
            "patientId": "1356",
            "roleId": "1348",
            "campaignId": null,
            "createdOn": "2026-05-05T05:35:23.009Z",
            "appointmentType": "walkin",
            "slotId": "1471",
            "practitionerId": "1349",
            "hospitalFhirId": "1339",
            "hospitalId": null,
            "hospitalName": "Test health facility 2",
            "hospitalCode": "HF001",
            "status": "completed",
            "scheduleId": "1358",
            "generatedOn": "2026-05-05T05:35:23.030Z"
        },
        {
            "appointmentId": "1412",
            "uuid": "df44c58b-a338-472e-aff0-dbef1f89c950",
            "slot": {
                "start": "2026-11-01T07:30:00.000Z",
                "end": "2026-11-01T07:35:00.000Z"
            },
            "patientId": "1382",
            "roleId": "265",
            "campaignId": null,
            "createdOn": "2026-05-05T07:48:48.615Z",
            "appointmentType": "routine",
            "slotId": "1409",
            "practitionerId": "266",
            "hospitalFhirId": "263",
            "hospitalId": null,
            "hospitalName": "TestHF",
            "hospitalCode": "Test04",
            "status": "scheduled",
            "scheduleId": "1406",
            "generatedOn": null
        }
    ]
        };

        const appointmentsArray = legacyDataContainer.data || [];

        if (!appointmentsArray.length) {
            console.log('⚠️ No legacy records found to process.');
            return;
        }

        console.log(`📥 Processing ${appointmentsArray.length} entries sequentially...`);

        // FIX: Sequential loop executes one record at a time
        // Reuses the connection pool rather than flooding it with 100 requests at once
        for (const item of appointmentsArray) {
            try {
                const data = {
                    uuid:          item.uuid,
                    appointmentId: item.appointmentId, 
                    patientId:     item.patientId,
                    status:        item.status === 'Unknown' ? 'scheduled' : item.status, 
                    slot: {
                        start:     item.slot?.start || null
                    },
                    orgId:         item.hospitalFhirId || null,
                    campaignId:    null,
                    sourceType:    "facility"
                };
                
                // Wait for the current row transaction to complete before starting the next one
                await upsertSnapshotAppointment(data);
                totalProcessed++;
                
                if (totalProcessed % 20 === 0) {
                    console.log(`⏳ Synchronized ${totalProcessed}/${appointmentsArray.length} rows...`);
                }
            } catch (recordError) {
                console.error(`❌ Skip Error on Appointment ID [${item.appointmentId}]:`, recordError.message);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 Legacy backfill complete!`);
        console.log(`✨ Total rows processed successfully: ${totalProcessed}`);
        console.log(`⏱️ Execution runtime: ${duration} seconds`);

    } catch (globalError) {
        console.error('💥 Critical pipeline crash triggered:', globalError);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('🛑 Database connection links closed safely.');
        process.exit(0);
    }
}

runLegacyAppointmentBackfill();