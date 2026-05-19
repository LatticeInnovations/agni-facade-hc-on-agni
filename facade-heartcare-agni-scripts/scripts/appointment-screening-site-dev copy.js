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
            "data":  [
        {
            "appointmentId": "5604",
            "uuid": "c9c87e27-18fb-4212-8bd5-4e7a53429fae",
            "slot": {
                "start": "2026-05-14T06:40:00.000Z",
                "end": "2026-05-14T06:45:00.000Z"
            },
            "patientId": "5564",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-14T06:40:08.312Z",
            "appointmentType": "walkin",
            "slotId": "5593",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "5602",
            "uuid": "a90a74bb-6533-4109-9367-fa100a77cc52",
            "slot": {
                "start": "2026-05-14T06:29:00.000Z",
                "end": "2026-05-14T06:34:00.000Z"
            },
            "patientId": "5562",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-14T06:29:55.743Z",
            "appointmentType": "walkin",
            "slotId": "5592",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "5600",
            "uuid": "defddda9-38b2-4c0b-84a2-641fc985f837",
            "slot": {
                "start": "2026-05-14T06:40:00.000Z",
                "end": "2026-05-14T06:45:00.000Z"
            },
            "patientId": "5564",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-14T06:40:39.695Z",
            "appointmentType": "walkin",
            "slotId": "5591",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "5598",
            "uuid": "46a97fe3-d480-486d-9ea8-cacc6ea5dff5",
            "slot": {
                "start": "2026-05-14T06:33:00.000Z",
                "end": "2026-05-14T06:38:00.000Z"
            },
            "patientId": "5563",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-14T06:33:59.543Z",
            "appointmentType": "walkin",
            "slotId": "5590",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "5596",
            "uuid": "af6c9a2e-017d-4b53-a07b-6d915e294b29",
            "slot": {
                "start": "2026-05-14T06:34:00.000Z",
                "end": "2026-05-14T06:39:00.000Z"
            },
            "patientId": "5563",
            "roleId": null,
            "campaignId": "4542",
            "createdOn": "2026-05-14T06:34:48.548Z",
            "appointmentType": "walkin",
            "slotId": "5589",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "5187",
            "generatedOn": null
        },
        {
            "appointmentId": "5594",
            "uuid": "4d43d4d7-cc1e-4bcc-998b-283686697121",
            "slot": {
                "start": "2026-05-14T06:40:00.000Z",
                "end": "2026-05-14T06:45:00.000Z"
            },
            "patientId": "5564",
            "roleId": null,
            "campaignId": "4542",
            "createdOn": "2026-05-14T06:40:56.519Z",
            "appointmentType": "walkin",
            "slotId": "5588",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "5187",
            "generatedOn": null
        },
        {
            "appointmentId": "5520",
            "uuid": "5aa270fb-c8ee-4324-b39b-08a18aca00a2",
            "slot": {
                "start": "2026-05-14T03:48:00.000Z",
                "end": "2026-05-14T03:53:00.000Z"
            },
            "patientId": "5515",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-14T03:48:17.431Z",
            "appointmentType": "walkin",
            "slotId": "5519",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "5391",
            "uuid": "25ef6c84-d7e0-4571-9330-c8cb1a5f69c7",
            "slot": {
                "start": "2026-05-13T10:24:00.000Z",
                "end": "2026-05-13T10:29:00.000Z"
            },
            "patientId": "5386",
            "roleId": null,
            "campaignId": "4766",
            "createdOn": "2026-05-13T10:24:35.511Z",
            "appointmentType": "walkin",
            "slotId": "5388",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "5383",
            "generatedOn": null
        },
        {
            "appointmentId": "5389",
            "uuid": "c99f5261-4521-4d31-9a6d-1b9fad2ae58b",
            "slot": {
                "start": "2026-05-13T10:21:00.000Z",
                "end": "2026-05-13T10:26:00.000Z"
            },
            "patientId": "5382",
            "roleId": null,
            "campaignId": "4766",
            "createdOn": "2026-05-13T10:21:31.064Z",
            "appointmentType": "walkin",
            "slotId": "5387",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "5383",
            "generatedOn": null
        },
        {
            "appointmentId": "5329",
            "uuid": "61d6c0fc-9983-40bb-a83d-663677c34da5",
            "slot": {
                "start": "2026-05-13T09:14:00.000Z",
                "end": "2026-05-13T09:19:00.000Z"
            },
            "patientId": "5327",
            "roleId": null,
            "campaignId": "4760",
            "createdOn": "2026-05-13T09:14:14.955Z",
            "appointmentType": "walkin",
            "slotId": "5328",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4789",
            "generatedOn": null
        },
        {
            "appointmentId": "5257",
            "uuid": "9766f706-1675-4dd9-a754-70e130d54ee9",
            "slot": {
                "start": "2026-05-13T09:01:00.000Z",
                "end": "2026-05-13T09:06:00.000Z"
            },
            "patientId": "5247",
            "roleId": null,
            "campaignId": "4760",
            "createdOn": "2026-05-13T09:01:24.208Z",
            "appointmentType": "walkin",
            "slotId": "5256",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4789",
            "generatedOn": null
        },
        {
            "appointmentId": "5192",
            "uuid": "8a84f170-f5fa-4f8c-a21d-2eaa5ebe787b",
            "slot": {
                "start": "2026-05-13T08:53:00.000Z",
                "end": "2026-05-13T08:58:00.000Z"
            },
            "patientId": "4981",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-13T08:53:04.624Z",
            "appointmentType": "walkin",
            "slotId": "5189",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "5190",
            "uuid": "ed595eee-8ab9-4073-9b39-dcc889c06bf8",
            "slot": {
                "start": "2026-05-13T08:53:00.000Z",
                "end": "2026-05-13T08:58:00.000Z"
            },
            "patientId": "4981",
            "roleId": null,
            "campaignId": "4542",
            "createdOn": "2026-05-13T08:53:30.698Z",
            "appointmentType": "walkin",
            "slotId": "5188",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "5187",
            "generatedOn": null
        },
        {
            "appointmentId": "5141",
            "uuid": "9b29644e-4097-46e3-bcf4-5bf110d83410",
            "slot": {
                "start": "2026-05-13T08:49:00.000Z",
                "end": "2026-05-13T08:54:00.000Z"
            },
            "patientId": "5131",
            "roleId": null,
            "campaignId": "4760",
            "createdOn": "2026-05-13T08:49:30.897Z",
            "appointmentType": "walkin",
            "slotId": "5140",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4789",
            "generatedOn": null
        },
        {
            "appointmentId": "5114",
            "uuid": "c7340da5-8071-4c97-968d-f69610ef3bc3",
            "slot": {
                "start": "2026-05-13T08:51:00.000Z",
                "end": "2026-05-13T08:56:00.000Z"
            },
            "patientId": "4981",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-13T08:51:16.045Z",
            "appointmentType": "walkin",
            "slotId": "5113",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "5025",
            "uuid": "43e3af82-cc8a-42c7-9ee4-70e638c7d533",
            "slot": {
                "start": "2026-05-13T08:32:00.000Z",
                "end": "2026-05-13T08:37:00.000Z"
            },
            "patientId": "5023",
            "roleId": null,
            "campaignId": "4760",
            "createdOn": "2026-05-13T08:32:42.933Z",
            "appointmentType": "walkin",
            "slotId": "5024",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4789",
            "generatedOn": null
        },
        {
            "appointmentId": "4992",
            "uuid": "939d8b47-dc5f-4b80-8762-a4cbc75bda93",
            "slot": {
                "start": "2026-05-13T08:14:00.000Z",
                "end": "2026-05-13T08:19:00.000Z"
            },
            "patientId": "4990",
            "roleId": null,
            "campaignId": "4760",
            "createdOn": "2026-05-13T08:14:25.567Z",
            "appointmentType": "walkin",
            "slotId": "4991",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4789",
            "generatedOn": null
        },
        {
            "appointmentId": "4791",
            "uuid": "64de7509-cdab-4c29-a427-6523dfc2244a",
            "slot": {
                "start": "2026-05-13T07:40:00.000Z",
                "end": "2026-05-13T07:45:00.000Z"
            },
            "patientId": "4788",
            "roleId": null,
            "campaignId": "4760",
            "createdOn": "2026-05-13T07:40:32.166Z",
            "appointmentType": "walkin",
            "slotId": "4790",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4789",
            "generatedOn": null
        },
        {
            "appointmentId": "4619",
            "uuid": "0347fd26-6fea-44ba-b4d3-ef74a342386e",
            "slot": {
                "start": "2026-05-12T10:55:00.000Z",
                "end": "2026-05-12T11:00:00.000Z"
            },
            "patientId": "4612",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-12T10:55:03.222Z",
            "appointmentType": "walkin",
            "slotId": "4616",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "4617",
            "uuid": "e5a7b3f4-263a-4c1a-8ca9-e65965919986",
            "slot": {
                "start": "2026-05-12T10:55:00.000Z",
                "end": "2026-05-12T11:00:00.000Z"
            },
            "patientId": "4612",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-12T10:55:46.281Z",
            "appointmentType": "walkin",
            "slotId": "4615",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "4568",
            "uuid": "3ddc6bd2-87fa-483a-a72b-4db21c8c32d5",
            "slot": {
                "start": "2026-05-12T06:47:00.000Z",
                "end": "2026-05-12T06:52:00.000Z"
            },
            "patientId": "4562",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-12T06:47:47.915Z",
            "appointmentType": "walkin",
            "slotId": "4567",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "4546",
            "uuid": "eb48bdd7-36fe-4cd9-8d39-df4fe7170a51",
            "slot": {
                "start": "2026-05-12T03:47:00.000Z",
                "end": "2026-05-12T03:52:00.000Z"
            },
            "patientId": "4239",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-12T03:47:39.316Z",
            "appointmentType": "walkin",
            "slotId": "4545",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "4491",
            "uuid": "9f461d12-5a0f-42b4-b8a7-b7c32a65a78d",
            "slot": {
                "start": "2026-05-11T20:27:00.000Z",
                "end": "2026-05-11T20:32:00.000Z"
            },
            "patientId": "4489",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-11T20:27:43.805Z",
            "appointmentType": "walkin",
            "slotId": "4490",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "4438",
            "uuid": "42959f0e-cd1e-4589-83db-a7db2ca1e6ae",
            "slot": {
                "start": "2026-05-11T19:37:00.000Z",
                "end": "2026-05-11T19:42:00.000Z"
            },
            "patientId": "4436",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-11T19:37:20.102Z",
            "appointmentType": "walkin",
            "slotId": "4437",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "4359",
            "uuid": "79d6e34a-bcf5-4b5f-8492-67a3bcc5ead7",
            "slot": {
                "start": "2026-05-11T15:32:00.000Z",
                "end": "2026-05-11T15:37:00.000Z"
            },
            "patientId": "4276",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-11T15:32:42.030Z",
            "appointmentType": "walkin",
            "slotId": "4358",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "4341",
            "uuid": "190f3365-068d-4f06-bb72-5e9aeb29d06f",
            "slot": {
                "start": "2026-05-11T13:36:00.000Z",
                "end": "2026-05-11T13:41:00.000Z"
            },
            "patientId": "1689",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-11T13:36:26.496Z",
            "appointmentType": "walkin",
            "slotId": "4340",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "4289",
            "uuid": "d8546ac0-4f54-45ef-acc5-0ef0d5e17301",
            "slot": {
                "start": "2026-05-11T12:32:00.000Z",
                "end": "2026-05-11T12:37:00.000Z"
            },
            "patientId": "4239",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-11T12:32:44.564Z",
            "appointmentType": "walkin",
            "slotId": "4288",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "4242",
            "uuid": "6061a921-7ad9-4448-a97c-72e517bdb9a2",
            "slot": {
                "start": "2026-05-11T11:04:00.000Z",
                "end": "2026-05-11T11:09:00.000Z"
            },
            "patientId": "4236",
            "roleId": null,
            "campaignId": "3865",
            "createdOn": "2026-05-11T11:04:52.358Z",
            "appointmentType": "walkin",
            "slotId": "4241",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "4240",
            "generatedOn": null
        },
        {
            "appointmentId": "3545",
            "uuid": "559a1146-2ecd-4a7c-ade3-80caab9513a0",
            "slot": {
                "start": "2026-05-08T09:37:00.000Z",
                "end": "2026-05-08T09:42:00.000Z"
            },
            "patientId": "603",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-08T09:37:08.789Z",
            "appointmentType": "walkin",
            "slotId": "3544",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "3068",
            "uuid": "h3i4j5k6-l7m8-4n9o-0p1q-2r3s4t5u6v7w",
            "slot": {
                "start": "2026-05-08T10:20:00.000Z",
                "end": "2026-05-08T10:25:00.000Z"
            },
            "patientId": "2969",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T10:20:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3029",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3066",
            "uuid": "j5k6l7m8-n9o0-4p1q-2r3s-4t5u6v7w8x9y",
            "slot": {
                "start": "2026-05-08T10:40:00.000Z",
                "end": "2026-05-08T10:45:00.000Z"
            },
            "patientId": "2970",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T10:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3028",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3064",
            "uuid": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            "slot": {
                "start": "2026-05-08T09:20:00.000Z",
                "end": "2026-05-08T09:25:00.000Z"
            },
            "patientId": "2966",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T09:20:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3027",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3062",
            "uuid": "k6l7m8n9-o0p1-4q2r-3s4t-5u6v7w8x9y0z",
            "slot": {
                "start": "2026-05-08T10:50:00.000Z",
                "end": "2026-05-08T10:55:00.000Z"
            },
            "patientId": "2970",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T10:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3026",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3060",
            "uuid": "q2r3s4t5-u6v7-4w8x-9y0z-1a2b3c4d5e6f",
            "slot": {
                "start": "2026-05-08T11:50:00.000Z",
                "end": "2026-05-08T11:55:00.000Z"
            },
            "patientId": "2973",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T11:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3025",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3058",
            "uuid": "p1q2r3s4-t5u6-4v7w-8x9y-0z1a2b3c4d5e",
            "slot": {
                "start": "2026-05-08T11:40:00.000Z",
                "end": "2026-05-08T11:45:00.000Z"
            },
            "patientId": "2973",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T11:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3024",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3056",
            "uuid": "g2h3i4j5-k6l7-4m8n-9o0p-1q2r3s4t5u6v",
            "slot": {
                "start": "2026-05-08T10:10:00.000Z",
                "end": "2026-05-08T10:15:00.000Z"
            },
            "patientId": "2968",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T10:10:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3023",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3054",
            "uuid": "f1a2b3c4-d5e6-4f7g-8h9i-0j1k2l3m4n5o",
            "slot": {
                "start": "2026-05-08T10:00:00.000Z",
                "end": "2026-05-08T10:05:00.000Z"
            },
            "patientId": "2968",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T10:00:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3022",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3052",
            "uuid": "r3s4t5u6-v7w8-4x9y-0z1a-2b3c4d5e6f7g",
            "slot": {
                "start": "2026-05-08T12:00:00.000Z",
                "end": "2026-05-08T12:05:00.000Z"
            },
            "patientId": "2974",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T12:00:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3021",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3050",
            "uuid": "d4e5f6a7-b8c9-4d0e-1f2g-3h4i5j6k7l8m",
            "slot": {
                "start": "2026-05-08T09:40:00.000Z",
                "end": "2026-05-08T09:45:00.000Z"
            },
            "patientId": "2967",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T09:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3020",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3048",
            "uuid": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
            "slot": {
                "start": "2026-05-08T09:30:00.000Z",
                "end": "2026-05-08T09:35:00.000Z"
            },
            "patientId": "2966",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T09:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3019",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3046",
            "uuid": "n9o0p1q2-r3s4-4t5u-6v7w-8x9y0z1a2b3c",
            "slot": {
                "start": "2026-05-08T11:20:00.000Z",
                "end": "2026-05-08T11:25:00.000Z"
            },
            "patientId": "2972",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T11:20:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3018",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3044",
            "uuid": "i4j5k6l7-m8n9-4o0p-1q2r-3s4t5u6v7w8x",
            "slot": {
                "start": "2026-05-08T10:30:00.000Z",
                "end": "2026-05-08T10:35:00.000Z"
            },
            "patientId": "2969",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T10:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3017",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3042",
            "uuid": "a1b2c3d4-e5f6-4321-8901-b1c2d3e4f5a6",
            "slot": {
                "start": "2026-05-08T09:10:00.000Z",
                "end": "2026-05-08T09:15:00.000Z"
            },
            "patientId": "2965",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T09:10:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3016",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3040",
            "uuid": "m8n9o0p1-q2r3-4s4t-5u6v-7w8x9y0z1a2b",
            "slot": {
                "start": "2026-05-08T11:10:00.000Z",
                "end": "2026-05-08T11:15:00.000Z"
            },
            "patientId": "2971",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T11:10:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3015",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3038",
            "uuid": "o0p1q2r3-s4t5-4u6v-7w8x-9y0z1a2b3c4d",
            "slot": {
                "start": "2026-05-08T11:30:00.000Z",
                "end": "2026-05-08T11:35:00.000Z"
            },
            "patientId": "2972",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T11:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3014",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3036",
            "uuid": "e5f6g7h8-i9j0-4k1l-2m3n-4o5p6q7r8s9t",
            "slot": {
                "start": "2026-05-08T09:50:00.000Z",
                "end": "2026-05-08T09:55:00.000Z"
            },
            "patientId": "2967",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T09:50:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3013",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3034",
            "uuid": "s4t5u6v7-w8x9-4y0z-1a2b-3c4d5e6f7g8h",
            "slot": {
                "start": "2026-05-08T12:10:00.000Z",
                "end": "2026-05-08T12:15:00.000Z"
            },
            "patientId": "2974",
            "roleId": null,
            "campaignId": "2984",
            "createdOn": "2026-05-08T12:10:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3012",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2988",
            "generatedOn": null
        },
        {
            "appointmentId": "3032",
            "uuid": "l7m8n9o0-p1q2-4r3s-4t5u-6v7w8x9y0z1a",
            "slot": {
                "start": "2026-05-08T11:00:00.000Z",
                "end": "2026-05-08T11:05:00.000Z"
            },
            "patientId": "2971",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T11:00:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3011",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "3030",
            "uuid": "729a8f21-44e1-4c12-9831-d89f21b7c1a2",
            "slot": {
                "start": "2026-05-08T09:00:00.000Z",
                "end": "2026-05-08T09:05:00.000Z"
            },
            "patientId": "2965",
            "roleId": null,
            "campaignId": "2979",
            "createdOn": "2026-05-08T09:00:00.000Z",
            "appointmentType": "walkin",
            "slotId": "3010",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2987",
            "generatedOn": null
        },
        {
            "appointmentId": "2906",
            "uuid": "f1ffb913-c570-42e2-b151-9670ce042fcf",
            "slot": {
                "start": "2026-05-08T04:28:00.000Z",
                "end": "2026-05-08T04:33:00.000Z"
            },
            "patientId": "649",
            "roleId": null,
            "campaignId": "2885",
            "createdOn": "2026-05-08T04:28:12.597Z",
            "appointmentType": "walkin",
            "slotId": "2905",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2890",
            "generatedOn": null
        },
        {
            "appointmentId": "2892",
            "uuid": "e8664a88-f63a-4e36-b6ce-27d8700d91c2",
            "slot": {
                "start": "2026-05-08T04:23:00.000Z",
                "end": "2026-05-08T04:28:00.000Z"
            },
            "patientId": "1126",
            "roleId": null,
            "campaignId": "2885",
            "createdOn": "2026-05-08T04:23:52.790Z",
            "appointmentType": "walkin",
            "slotId": "2891",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2890",
            "generatedOn": null
        },
        {
            "appointmentId": "2828",
            "uuid": "aa90bb2d-3f9c-4b8d-b224-26df0ccaa284",
            "slot": {
                "start": "2026-05-07T11:03:00.000Z",
                "end": "2026-05-07T11:08:00.000Z"
            },
            "patientId": "1126",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-07T11:03:03.030Z",
            "appointmentType": "walkin",
            "slotId": "2827",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "2813",
            "uuid": "c769fcee-8f89-4798-b846-1f6764d5baf7",
            "slot": {
                "start": "2026-05-07T11:05:00.000Z",
                "end": "2026-05-07T11:10:00.000Z"
            },
            "patientId": "1126",
            "roleId": null,
            "campaignId": "562",
            "createdOn": "2026-05-07T11:05:53.049Z",
            "appointmentType": "walkin",
            "slotId": "2812",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2811",
            "generatedOn": null
        },
        {
            "appointmentId": "2779",
            "uuid": "3344f3ed-428b-4582-a121-35de673359de",
            "slot": {
                "start": "2026-05-07T10:55:00.000Z",
                "end": "2026-05-07T11:00:00.000Z"
            },
            "patientId": "649",
            "roleId": null,
            "campaignId": "2774",
            "createdOn": "2026-05-07T10:55:41.784Z",
            "appointmentType": "walkin",
            "slotId": "2778",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "2777",
            "generatedOn": null
        },
        {
            "appointmentId": "2677",
            "uuid": "c6ad8f91-a180-4814-bd0e-9765c5221f54",
            "slot": {
                "start": "2026-05-06T10:06:00.000Z",
                "end": "2026-05-06T10:11:00.000Z"
            },
            "patientId": "2667",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-06T10:06:19.799Z",
            "appointmentType": "walkin",
            "slotId": "2676",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "2471",
            "uuid": "955debe6-e877-40a8-b0cf-f68cb3612a2a",
            "slot": {
                "start": "2026-05-06T04:30:00.000Z",
                "end": "2026-05-06T04:35:00.000Z"
            },
            "patientId": "2460",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-06T04:30:30.534Z",
            "appointmentType": "walkin",
            "slotId": "2470",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "2433",
            "uuid": "f21d65f5-be4b-4d0b-8a2d-9d862795a003",
            "slot": {
                "start": "2026-05-06T03:46:00.000Z",
                "end": "2026-05-06T03:51:00.000Z"
            },
            "patientId": "1022",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-06T03:46:31.196Z",
            "appointmentType": "walkin",
            "slotId": "2432",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "1943",
            "uuid": "db51558a-0fd4-4e16-b758-4037b77be4dd",
            "slot": {
                "start": "2026-05-05T17:42:00.000Z",
                "end": "2026-05-05T17:47:00.000Z"
            },
            "patientId": "1924",
            "roleId": null,
            "campaignId": "1177",
            "createdOn": "2026-05-05T17:42:12.173Z",
            "appointmentType": "walkin",
            "slotId": "1940",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1407",
            "generatedOn": null
        },
        {
            "appointmentId": "1941",
            "uuid": "15eb25ac-af53-4585-9446-21a799e9a5b3",
            "slot": {
                "start": "2026-05-05T17:42:00.000Z",
                "end": "2026-05-05T17:47:00.000Z"
            },
            "patientId": "1924",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-05T17:42:22.516Z",
            "appointmentType": "walkin",
            "slotId": "1939",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "1822",
            "uuid": "df632d03-9fb6-412d-a2b1-beacb07f198d",
            "slot": {
                "start": "2026-05-05T14:30:00.000Z",
                "end": "2026-05-05T14:35:00.000Z"
            },
            "patientId": "1689",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-05T14:30:29.951Z",
            "appointmentType": "walkin",
            "slotId": "1819",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "1820",
            "uuid": "4e43382a-8019-478d-af2b-43df803d255b",
            "slot": {
                "start": "2026-05-05T14:30:00.000Z",
                "end": "2026-05-05T14:35:00.000Z"
            },
            "patientId": "1689",
            "roleId": null,
            "campaignId": "1177",
            "createdOn": "2026-05-05T14:30:47.795Z",
            "appointmentType": "walkin",
            "slotId": "1818",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1407",
            "generatedOn": null
        },
        {
            "appointmentId": "1761",
            "uuid": "93ea9c6a-962d-49d8-8221-0ec8ad461576",
            "slot": {
                "start": "2026-05-05T11:31:00.000Z",
                "end": "2026-05-05T11:36:00.000Z"
            },
            "patientId": "1689",
            "roleId": null,
            "campaignId": "1748",
            "createdOn": "2026-05-05T11:31:50.450Z",
            "appointmentType": "walkin",
            "slotId": "1758",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1756",
            "generatedOn": null
        },
        {
            "appointmentId": "1759",
            "uuid": "9690557f-0953-43b9-b876-ecd47e8ae616",
            "slot": {
                "start": "2026-05-05T11:31:00.000Z",
                "end": "2026-05-05T11:36:00.000Z"
            },
            "patientId": "1689",
            "roleId": null,
            "campaignId": "1752",
            "createdOn": "2026-05-05T11:31:05.544Z",
            "appointmentType": "walkin",
            "slotId": "1757",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1755",
            "generatedOn": null
        },
        {
            "appointmentId": "1438",
            "uuid": "046da887-b6dd-4baf-912e-93ad4762d8fa",
            "slot": {
                "start": "2026-05-05T08:02:00.000Z",
                "end": "2026-05-05T08:07:00.000Z"
            },
            "patientId": "1382",
            "roleId": null,
            "campaignId": "1177",
            "createdOn": "2026-05-05T08:02:09.596Z",
            "appointmentType": "walkin",
            "slotId": "1435",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1407",
            "generatedOn": null
        },
        {
            "appointmentId": "1436",
            "uuid": "14ceabc7-1a3b-47e8-bbe1-7b72b624c047",
            "slot": {
                "start": "2026-05-05T07:49:00.000Z",
                "end": "2026-05-05T07:54:00.000Z"
            },
            "patientId": "1382",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-05T07:49:56.482Z",
            "appointmentType": "walkin",
            "slotId": "1434",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "1242",
            "uuid": "25847aa1-0a8a-410b-afdb-31bd6b29248a",
            "slot": {
                "start": "2026-05-04T12:58:00.000Z",
                "end": "2026-05-04T13:03:00.000Z"
            },
            "patientId": "598",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-05-04T12:58:45.516Z",
            "appointmentType": "walkin",
            "slotId": "1241",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "761",
            "generatedOn": null
        },
        {
            "appointmentId": "1191",
            "uuid": "41944d4c-863f-4310-9964-e5cbdd845910",
            "slot": {
                "start": "2026-05-04T08:47:00.000Z",
                "end": "2026-05-04T08:52:00.000Z"
            },
            "patientId": "595",
            "roleId": null,
            "campaignId": "1179",
            "createdOn": "2026-05-04T08:47:09.166Z",
            "appointmentType": "walkin",
            "slotId": "1190",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "1186",
            "generatedOn": null
        },
        {
            "appointmentId": "1130",
            "uuid": "585a53bd-4f14-44e2-81ed-c9b3a91cb7b0",
            "slot": {
                "start": "2026-05-04T07:25:00.000Z",
                "end": "2026-05-04T07:30:00.000Z"
            },
            "patientId": "1126",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-05-04T07:25:40.808Z",
            "appointmentType": "walkin",
            "slotId": "1129",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "761",
            "generatedOn": null
        },
        {
            "appointmentId": "1058",
            "uuid": "cdccf060-2236-42b3-85d2-b3f13859a151",
            "slot": {
                "start": "2026-05-03T06:25:00.000Z",
                "end": "2026-05-03T06:30:00.000Z"
            },
            "patientId": "1056",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-05-03T06:25:57.663Z",
            "appointmentType": "walkin",
            "slotId": "1057",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "761",
            "generatedOn": null
        },
        {
            "appointmentId": "883",
            "uuid": "299c5880-2ec2-4ab5-9cb3-bec61f26c1d6",
            "slot": {
                "start": "2026-04-29T11:23:00.000Z",
                "end": "2026-04-29T11:28:00.000Z"
            },
            "patientId": "603",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-29T11:23:10.321Z",
            "appointmentType": "walkin",
            "slotId": "882",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "761",
            "generatedOn": null
        },
        {
            "appointmentId": "837",
            "uuid": "de87e000-0c38-407c-9547-10944072ebfb",
            "slot": {
                "start": "2026-04-29T07:30:00.000Z",
                "end": "2026-04-29T07:35:00.000Z"
            },
            "patientId": "835",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-29T07:30:08.087Z",
            "appointmentType": "walkin",
            "slotId": "836",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "761",
            "generatedOn": null
        },
        {
            "appointmentId": "763",
            "uuid": "88d69ac0-c02d-4d58-bbba-fd6c2c4ed2e8",
            "slot": {
                "start": "2026-04-28T05:11:00.000Z",
                "end": "2026-04-28T05:16:00.000Z"
            },
            "patientId": "760",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-28T05:11:50.836Z",
            "appointmentType": "walkin",
            "slotId": "762",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "761",
            "generatedOn": null
        },
        {
            "appointmentId": "715",
            "uuid": "b626104c-c101-4af1-8255-8547948da448",
            "slot": {
                "start": "2026-04-27T17:52:00.000Z",
                "end": "2026-04-27T17:57:00.000Z"
            },
            "patientId": "713",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-27T17:52:27.718Z",
            "appointmentType": "walkin",
            "slotId": "714",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "626",
            "generatedOn": "2026-04-30T07:44:15.217Z"
        },
        {
            "appointmentId": "688",
            "uuid": "14fa8b65-d03b-40c6-a49e-aad2cc960b6d",
            "slot": {
                "start": "2026-04-27T11:32:00.000Z",
                "end": "2026-04-27T11:37:00.000Z"
            },
            "patientId": "595",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-27T11:32:55.036Z",
            "appointmentType": "walkin",
            "slotId": "687",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "626",
            "generatedOn": null
        },
        {
            "appointmentId": "659",
            "uuid": "793a1a7a-40f1-4cb3-ae65-2aaf30b3f86d",
            "slot": {
                "start": "2026-04-27T10:50:00.000Z",
                "end": "2026-04-27T10:55:00.000Z"
            },
            "patientId": "649",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-27T10:50:25.364Z",
            "appointmentType": "walkin",
            "slotId": "658",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "626",
            "generatedOn": null
        },
        {
            "appointmentId": "645",
            "uuid": "9f3d349a-ae8f-44ef-a8ee-396bab38481d",
            "slot": {
                "start": "2026-04-27T10:03:00.000Z",
                "end": "2026-04-27T10:08:00.000Z"
            },
            "patientId": "635",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-27T10:03:52.550Z",
            "appointmentType": "walkin",
            "slotId": "644",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "626",
            "generatedOn": null
        },
        {
            "appointmentId": "631",
            "uuid": "28987b43-d63a-4212-8797-cba67e422415",
            "slot": {
                "start": "2026-04-27T06:56:00.000Z",
                "end": "2026-04-27T07:01:00.000Z"
            },
            "patientId": "616",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-27T06:56:24.710Z",
            "appointmentType": "walkin",
            "slotId": "630",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "626",
            "generatedOn": null
        },
        {
            "appointmentId": "488",
            "uuid": "3823f29d-c739-4a7c-9580-8c8092c3a7a3",
            "slot": {
                "start": "2026-04-23T14:30:00.000Z",
                "end": "2026-04-23T14:35:00.000Z"
            },
            "patientId": "485",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-23T14:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "487",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "486",
            "generatedOn": null
        },
        {
            "appointmentId": "445",
            "uuid": "ead15ddf-81e9-4849-963b-fd795844671a",
            "slot": {
                "start": "2026-04-21T14:40:00.000Z",
                "end": "2026-04-21T14:45:00.000Z"
            },
            "patientId": "443",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-21T14:40:00.000Z",
            "appointmentType": "walkin",
            "slotId": "444",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "353",
            "generatedOn": null
        },
        {
            "appointmentId": "439",
            "uuid": "afb26305-3d70-4cc5-b8d4-c4a00571bb8c",
            "slot": {
                "start": "2026-04-21T14:30:00.000Z",
                "end": "2026-04-21T14:35:00.000Z"
            },
            "patientId": "437",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-21T14:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "438",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "353",
            "generatedOn": null
        },
        {
            "appointmentId": "415",
            "uuid": "9f89561a-9dc0-4f83-b6c6-85654bafd3dc",
            "slot": {
                "start": "2026-04-21T14:30:00.000Z",
                "end": "2026-04-21T14:35:00.000Z"
            },
            "patientId": "410",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-21T14:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "414",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "353",
            "generatedOn": null
        },
        {
            "appointmentId": "376",
            "uuid": "d5f180b0-1609-4007-ab40-5463d5cfa6a9",
            "slot": {
                "start": "2026-04-21T14:30:00.000Z",
                "end": "2026-04-21T14:35:00.000Z"
            },
            "patientId": "368",
            "roleId": null,
            "campaignId": "302",
            "createdOn": "2026-04-21T14:30:00.000Z",
            "appointmentType": "walkin",
            "slotId": "375",
            "practitionerId": null,
            "hospitalFhirId": null,
            "hospitalId": null,
            "hospitalName": null,
            "hospitalCode": null,
            "status": "walkin",
            "scheduleId": "353",
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
                    orgId:         null,
                    campaignId:    item.campaignId,
                    sourceType:    "campaign"
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