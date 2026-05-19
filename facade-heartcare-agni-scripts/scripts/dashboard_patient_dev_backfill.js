require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { sequelize } = require('../../models'); // Adjust this path to your models configuration folder
const { upsertSnapshotPatient } = require('../../services/dashboardSnapshotService'); // Adjust this path to your worker service file

/**
 * runBackfill
 * Streams and processes all existing historical data into analytics snapshots.
 */
async function runBackfill() {
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMoreRecords = true;
    let totalProcessed = 0;

    console.log('🚀 Starting patient snapshot historical data backfill...');
    const startTime = Date.now();

    try {
        // Authenticate database pool link before beginning loop
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');

        while (hasMoreRecords) {
            console.log(`📦 Fetching batch: Offset ${offset}, Limit ${BATCH_SIZE}...`);

            // 1. Fetch a chunk of existing patient records.
            // Replace 'Patients' with the actual Sequelize model name for your core raw data table.
            const rawPatients = [
        {
            "fhirId": "5841",
            "firstName": "Anu",
            "lastName": "Test",
            "id": "98dfcdeb-fbe0-4d82-be8a-8df71d2bb3b6",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1981-09-04",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1337",
                "district": "1338",
                "state": "1336",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1340"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Anita",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00008",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5564",
            "firstName": "Third",
            "lastName": "User",
            "id": "be3d4a4b-453d-40b4-9b14-14fb0bf636e8",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1966-05-14",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Vrgy",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00029",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5563",
            "firstName": "Second",
            "lastName": "User",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "5e49cdaf-3d2d-448e-b397-2b0fe6567a5e",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00030",
                    "code": null,
                    "use": null
                }
            ],
            "id": "5e49cdaf-3d2d-448e-b397-2b0fe6567a5e",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1959-05-14",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Dhdh",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00030",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5562",
            "firstName": "First",
            "lastName": "User",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "a2d69693-74fa-4b0e-ac36-4fc0d50d3d67",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00031",
                    "code": null,
                    "use": null
                }
            ],
            "id": "a2d69693-74fa-4b0e-ac36-4fc0d50d3d67",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1971-05-14",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Gdgdhd",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00031",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5515",
            "firstName": "Lydia",
            "lastName": "Euth",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "c7f8dabe-e468-4745-b2f7-8c6d906f2ad8",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "35646",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "GUJ00005",
                    "code": null,
                    "use": null
                }
            ],
            "id": "c7f8dabe-e468-4745-b2f7-8c6d906f2ad8",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1981-12-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Prica Ruth",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00005",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5514",
            "firstName": "Sarah",
            "lastName": "Hannah",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "cdb16312-4087-4deb-aeef-26a6e71895f2",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "34646",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "GUJ00006",
                    "code": null,
                    "use": null
                }
            ],
            "id": "cdb16312-4087-4deb-aeef-26a6e71895f2",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1997-11-05",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Christine",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00006",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5513",
            "firstName": "Junia",
            "lastName": "Faith",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "ee3d78cb-5b41-40dd-8b0f-15e64e733df8",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "34464",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "GUJ00007",
                    "code": null,
                    "use": null
                }
            ],
            "id": "ee3d78cb-5b41-40dd-8b0f-15e64e733df8",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1967-02-07",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Rhoda",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00007",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5444",
            "firstName": "Eve",
            "lastName": "Joy",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "e52e6e1e-22a1-495d-b197-61740e9bc94b",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "34467",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "GUJ00003",
                    "code": null,
                    "use": null
                }
            ],
            "id": "e52e6e1e-22a1-495d-b197-61740e9bc94b",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1970-09-05",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Noelle",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00003",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5443",
            "firstName": "Marcia",
            "lastName": "Quai",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "cbd89fa0-11f2-4d82-ac45-319721c7b6a9",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "3446",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "cbd89fa0-11f2-4d82-ac45-319721c7b6a9",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1984-09-07",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Anjela",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5386",
            "firstName": "Daniel",
            "lastName": "Mark",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "244de8a0-3133-47cc-a2fe-6b6b503e999a",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "3464",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "GUJ00002",
                    "code": null,
                    "use": null
                }
            ],
            "id": "244de8a0-3133-47cc-a2fe-6b6b503e999a",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1972-02-08",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Ana",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00002",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5382",
            "firstName": "Joana",
            "lastName": "Grace",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "5b79b8f2-d9b8-49d8-9629-b1115e6d37f1",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "5346",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "GUJ00001",
                    "code": null,
                    "use": null
                }
            ],
            "id": "5b79b8f2-d9b8-49d8-9629-b1115e6d37f1",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1978-02-08",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4748",
                "district": "4750",
                "state": "4747",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4752"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4756"
                }
            ],
            "mothersName": "Anjelina Grace",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "GUJ00001",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5355",
            "firstName": "Monic",
            "lastName": "Goros",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "b8ae1f23-c809-4d26-9e6c-bb1f2abfd3ad",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "1",
                    "code": null,
                    "use": "official"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00028",
                    "code": null,
                    "use": null
                }
            ],
            "id": "b8ae1f23-c809-4d26-9e6c-bb1f2abfd3ad",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1959-09-26",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "National ic",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00028",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5327",
            "firstName": "Aaron",
            "lastName": "Caleb",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "3950e786-2918-44c7-9b84-90489b0f45c6",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "434498",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00008",
                    "code": null,
                    "use": null
                }
            ],
            "id": "3950e786-2918-44c7-9b84-90489b0f45c6",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1968-08-07",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Ezra Caleb",
            "fathersName": "David Caleb",
            "spouseName": "Boaz Caleb",
            "heartcareId": "KAR00008",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5247",
            "firstName": "Khon",
            "lastName": "Apollos",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "81c7b5b4-871f-47b3-8e8d-9e7e1f63fcc4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "2454",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00007",
                    "code": null,
                    "use": null
                }
            ],
            "id": "81c7b5b4-871f-47b3-8e8d-9e7e1f63fcc4",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1971-09-12",
            "mobileNumber": "434946491",
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Euler Thomas",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "KAR00007",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5131",
            "firstName": "Levi",
            "lastName": "Mark",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "4b72d7a1-e3ed-4b8a-92aa-650739bdfcaf",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "578446",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00005",
                    "code": null,
                    "use": null
                }
            ],
            "id": "4b72d7a1-e3ed-4b8a-92aa-650739bdfcaf",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1981-12-04",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Lily Mark",
            "fathersName": "Issac Mark",
            "spouseName": "Ruth Ann",
            "heartcareId": "KAR00005",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5130",
            "firstName": "Paul",
            "lastName": "Jude",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "af98c1bc-daef-43b6-ae85-8f429f800877",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "34549",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00006",
                    "code": null,
                    "use": null
                }
            ],
            "id": "af98c1bc-daef-43b6-ae85-8f429f800877",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1981-09-07",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Chloe Jude",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "KAR00006",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "5023",
            "firstName": "Luke",
            "lastName": "Jhon",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "3b931816-6b2b-464c-b2b2-189ff4be28f9",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "355455",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00004",
                    "code": null,
                    "use": null
                }
            ],
            "id": "3b931816-6b2b-464c-b2b2-189ff4be28f9",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1967-11-05",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": {
                "latitude": 13.0835598,
                "longitude": 77.5412975
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Mary",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "KAR00004",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4990",
            "firstName": "Noah",
            "lastName": "Samuel",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "ab5960ff-fa5e-4837-9760-42e719928129",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "804545",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00003",
                    "code": null,
                    "use": null
                }
            ],
            "id": "ab5960ff-fa5e-4837-9760-42e719928129",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1974-11-09",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": "560098",
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Hanna Samuel",
            "fathersName": "Joseph Samuel",
            "spouseName": null,
            "heartcareId": "KAR00003",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4981",
            "firstName": "Prachi",
            "lastName": "Saxena",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "7dcb184a-20d3-48a7-b637-aece608b9aba",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "1234567",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00027",
                    "code": null,
                    "use": null
                }
            ],
            "id": "7dcb184a-20d3-48a7-b637-aece608b9aba",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1986-05-13",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Prem",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00027",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4822",
            "firstName": "Ajay",
            "lastName": "Singh",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "9fa7e6dd-78a0-43a9-b906-dd64201895d4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "346469",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00002",
                    "code": null,
                    "use": null
                }
            ],
            "id": "9fa7e6dd-78a0-43a9-b906-dd64201895d4",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1977-08-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": "560098",
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Anjali",
            "fathersName": "Eheta",
            "spouseName": null,
            "heartcareId": "KAR00002",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4788",
            "firstName": "Kanika",
            "lastName": "Kumar",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "28e2c009-3e91-49d0-a0c3-9d439880eb8a",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "34548",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "KAR00001",
                    "code": null,
                    "use": null
                }
            ],
            "id": "28e2c009-3e91-49d0-a0c3-9d439880eb8a",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1980-11-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "4744",
                "district": "4745",
                "state": "4743",
                "postalCode": "560097",
                "country": "Vanuatu",
                "addressLine1": "4749"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/4754"
                }
            ],
            "mothersName": "Anisha",
            "fathersName": "Aniruddh",
            "spouseName": null,
            "heartcareId": "KAR00001",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4612",
            "firstName": "TwelveMay",
            "lastName": "Screening",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "6ce9c5b8-cda0-489f-b601-7a48312063e7",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "22222",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00026",
                    "code": null,
                    "use": null
                }
            ],
            "id": "6ce9c5b8-cda0-489f-b601-7a48312063e7",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1965-12-07",
            "mobileNumber": null,
            "email": "nishita@thelattice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Hdh",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00026",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4562",
            "firstName": "Screening",
            "lastName": "Seven",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "39e9118f-8844-484f-a524-5f4a1d5494d7",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "111111",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "39e9118f-8844-484f-a524-5f4a1d5494d7",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1965-12-07",
            "mobileNumber": null,
            "email": "nishita@thalltice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Dff",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4489",
            "firstName": "Screening",
            "lastName": "Six",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "e1aad562-cf8c-4c40-9e10-cc8cd7e6d5c5",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "55555",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "e1aad562-cf8c-4c40-9e10-cc8cd7e6d5c5",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1965-12-07",
            "mobileNumber": null,
            "email": "nishita@thelattice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Test",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4436",
            "firstName": "Screening",
            "lastName": "Five",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "47333bff-4f6a-44f0-82c6-82b0a8631afc",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "55555",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "47333bff-4f6a-44f0-82c6-82b0a8631afc",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1966-03-11",
            "mobileNumber": null,
            "email": "try.nishitakoshta@gmail.com",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "F",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4276",
            "firstName": "Four",
            "lastName": "Screening",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "87eadff7-0edd-4bcc-a719-e9706eee1a21",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "666666",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00025",
                    "code": null,
                    "use": null
                }
            ],
            "id": "87eadff7-0edd-4bcc-a719-e9706eee1a21",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1952-04-10",
            "mobileNumber": null,
            "email": "nishita@thelattice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Hhh",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00025",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4239",
            "firstName": "Elevenapril",
            "lastName": "Screening",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "8c8597f3-baa3-475e-a9f8-ee2adf143021",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "1111111",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00024",
                    "code": null,
                    "use": null
                }
            ],
            "id": "8c8597f3-baa3-475e-a9f8-ee2adf143021",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1965-08-31",
            "mobileNumber": null,
            "email": "try.nishitakoshta@gmail.com",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Yu",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00024",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4236",
            "firstName": "Three",
            "lastName": "Screening",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "b6818cfb-c7bd-494a-b94c-c1b7a53547c5",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "1234568",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00023",
                    "code": null,
                    "use": null
                }
            ],
            "id": "b6818cfb-c7bd-494a-b94c-c1b7a53547c5",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1955-09-03",
            "mobileNumber": null,
            "email": "try.nishitakoshta@gmail.com",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "C",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00023",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "4212",
            "firstName": "Test",
            "lastName": "Lattice",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "48907251-3bca-432c-83e6-3ad907619364",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/hospital-id",
                    "identifierNumber": "ABC123",
                    "code": null,
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "123456",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "48907251-3bca-432c-83e6-3ad907619364",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1976-08-18",
            "mobileNumber": "7697582514",
            "email": "try.nishitakoshta@gmail.com",
            "permanentAddress": {
                "city": "2144",
                "district": "2201",
                "state": "2117",
                "postalCode": "4822002",
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Eleven",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3900",
            "firstName": "Ashley",
            "lastName": "Anderson",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "588db035-1d50-4f47-ae47-5c572fbd8bb7",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00001",
                    "code": null,
                    "use": null
                }
            ],
            "id": "588db035-1d50-4f47-ae47-5c572fbd8bb7",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1980-02-28",
            "mobileNumber": null,
            "email": "ashley.anderson@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Karen Anderson",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00001",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3899",
            "firstName": "James",
            "lastName": "Taylor",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "a74cb1a4-e5b2-466b-b1e6-ad66b5add8c0",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00002",
                    "code": null,
                    "use": null
                }
            ],
            "id": "a74cb1a4-e5b2-466b-b1e6-ad66b5add8c0",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1975-09-12",
            "mobileNumber": null,
            "email": "james.taylor@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Dorothy Taylor",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00002",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3898",
            "firstName": "Laura",
            "lastName": "Moore",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "48595a65-cbbd-4770-810d-f302749574c4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00003",
                    "code": null,
                    "use": null
                }
            ],
            "id": "48595a65-cbbd-4770-810d-f302749574c4",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1983-06-08",
            "mobileNumber": null,
            "email": "laura.moore@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Margaret Moore",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00003",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3897",
            "firstName": "David",
            "lastName": "Miller",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "dd84696c-a7ae-4ad0-b418-ffa4c45b07ae",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00004",
                    "code": null,
                    "use": null
                }
            ],
            "id": "dd84696c-a7ae-4ad0-b418-ffa4c45b07ae",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1978-03-17",
            "mobileNumber": null,
            "email": "david.miller@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Jennifer Miller",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00004",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3896",
            "firstName": "Jessica",
            "lastName": "Wilson",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "e5018ca6-05dd-47ff-af06-d51cf05ee3a9",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00005",
                    "code": null,
                    "use": null
                }
            ],
            "id": "e5018ca6-05dd-47ff-af06-d51cf05ee3a9",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1981-12-25",
            "mobileNumber": null,
            "email": "jessica.wilson@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Elizabeth Wilson",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00005",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3895",
            "firstName": "Michael",
            "lastName": "Davis",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "3ad8a61c-98f2-44aa-97a2-728fe097a4b4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00006",
                    "code": null,
                    "use": null
                }
            ],
            "id": "3ad8a61c-98f2-44aa-97a2-728fe097a4b4",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1976-01-05",
            "mobileNumber": null,
            "email": "michael.davis@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Barbara Davis",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00006",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3894",
            "firstName": "Emily",
            "lastName": "White",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "a015b991-f0b8-4ec7-bb4f-592c6a2064d1",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00007",
                    "code": null,
                    "use": null
                }
            ],
            "id": "a015b991-f0b8-4ec7-bb4f-592c6a2064d1",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1982-08-14",
            "mobileNumber": null,
            "email": "emily.white@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Patricia White",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00007",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3893",
            "firstName": "Robert",
            "lastName": "Brown",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "cfcc4bd9-aa86-4b2a-8e60-ca82a94c0045",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00008",
                    "code": null,
                    "use": null
                }
            ],
            "id": "cfcc4bd9-aa86-4b2a-8e60-ca82a94c0045",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1979-05-30",
            "mobileNumber": null,
            "email": "robert.brown@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Susan Brown",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00008",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3892",
            "firstName": "Sarah",
            "lastName": "Jones",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "e3ff7ac3-c468-483a-8472-f5de9839081b",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00009",
                    "code": null,
                    "use": null
                }
            ],
            "id": "e3ff7ac3-c468-483a-8472-f5de9839081b",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1974-11-20",
            "mobileNumber": null,
            "email": "sarah.jones@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Linda Jones",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00009",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "3891",
            "firstName": "John",
            "lastName": "Smith",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "b933c431-7447-464b-9338-b60234f94a23",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "DEL00010",
                    "code": null,
                    "use": null
                }
            ],
            "id": "b933c431-7447-464b-9338-b60234f94a23",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1984-03-12",
            "mobileNumber": null,
            "email": "john.smith@example.com",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1347"
                }
            ],
            "mothersName": "Mary Smith",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "DEL00010",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2974",
            "firstName": "Maria",
            "lastName": "Lopez",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "43a21793-4a95-4aaf-bea9-5c93f6cdf048",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00018",
                    "code": null,
                    "use": null
                }
            ],
            "id": "43a21793-4a95-4aaf-bea9-5c93f6cdf048",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1971-12-05",
            "mobileNumber": null,
            "email": "m.lopez@hospital.com",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Carmen",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00018",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2973",
            "firstName": "Samuel",
            "lastName": "Jackson",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "a5726023-db38-48e4-955a-b05775d39329",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00013",
                    "code": null,
                    "use": null
                }
            ],
            "id": "a5726023-db38-48e4-955a-b05775d39329",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1988-11-30",
            "mobileNumber": null,
            "email": "sam.j@campaign.in",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Gloria",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00013",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2972",
            "firstName": "David",
            "lastName": "Gupta",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "37e1a728-0edd-43b6-ba6e-30c94fd95bd7",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00015",
                    "code": null,
                    "use": null
                }
            ],
            "id": "37e1a728-0edd-43b6-ba6e-30c94fd95bd7",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1984-05-22",
            "mobileNumber": null,
            "email": "d.gupta@clinic.in",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Anjali",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00015",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2971",
            "firstName": "Linda",
            "lastName": "Thompson",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "2ed2a08a-44e2-4391-844b-5d5890ce726d",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00017",
                    "code": null,
                    "use": null
                }
            ],
            "id": "2ed2a08a-44e2-4391-844b-5d5890ce726d",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1968-09-15",
            "mobileNumber": null,
            "email": "linda.t@health.co",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Patricia",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00017",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2970",
            "firstName": "Elena",
            "lastName": "Rodriguez",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "dbcea015-96f2-4524-b0eb-6b3a5d6cb7e4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00022",
                    "code": null,
                    "use": null
                }
            ],
            "id": "dbcea015-96f2-4524-b0eb-6b3a5d6cb7e4",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1981-06-12",
            "mobileNumber": null,
            "email": "elena.r@campaign.org",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Isabel",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00022",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2969",
            "firstName": "Karen",
            "lastName": "O'Reilly",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "1b94d4b9-3f57-4f9d-9223-18d88c37d6dd",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00021",
                    "code": null,
                    "use": null
                }
            ],
            "id": "1b94d4b9-3f57-4f9d-9223-18d88c37d6dd",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1961-02-05",
            "mobileNumber": null,
            "email": "k.oreilly@dublin.ie",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Mary",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00021",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2968",
            "firstName": "Robert",
            "lastName": "Miller",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "dccd63e0-f015-4e5b-8e00-e67f904b8b08",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00014",
                    "code": null,
                    "use": null
                }
            ],
            "id": "dccd63e0-f015-4e5b-8e00-e67f904b8b08",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1956-03-30",
            "mobileNumber": null,
            "email": "robert.m@provider.net",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Susan",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00014",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2967",
            "firstName": "Marcus",
            "lastName": "Thorne",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "d9e60ec9-6823-4232-a713-1ec22ed1a8cd",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00020",
                    "code": null,
                    "use": null
                }
            ],
            "id": "d9e60ec9-6823-4232-a713-1ec22ed1a8cd",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1975-01-20",
            "mobileNumber": null,
            "email": "m.thorne@tsdsad.in",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Elena",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00020",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2966",
            "firstName": "Sarah",
            "lastName": "Chen",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "f2387b21-1d51-4748-88ce-1c9e51beb167",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00016",
                    "code": null,
                    "use": null
                }
            ],
            "id": "f2387b21-1d51-4748-88ce-1c9e51beb167",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1992-02-14",
            "mobileNumber": null,
            "email": "sarah.chen@webmail.com",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Mei",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00016",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2965",
            "firstName": "James",
            "lastName": "Wilson",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "789033c9-0d5f-4b8f-b393-bc2a21c9b5eb",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00019",
                    "code": null,
                    "use": null
                }
            ],
            "id": "789033c9-0d5f-4b8f-b393-bc2a21c9b5eb",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1964-11-12",
            "mobileNumber": null,
            "email": "j.wilson@healthmail.com",
            "permanentAddress": {
                "city": "2144",
                "district": "2204",
                "state": "2117",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "3863"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Martha",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00019",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2667",
            "firstName": "K",
            "lastName": "William",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "8a03deca-c864-45c9-8696-3be2b7f2f83e",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00012",
                    "code": null,
                    "use": null
                }
            ],
            "id": "8a03deca-c864-45c9-8696-3be2b7f2f83e",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1958-04-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "H",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00012",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "2460",
            "firstName": "Mohan",
            "lastName": "Lal",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "dd6ce223-a8a0-4f76-aa5f-83f787dc440c",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00010",
                    "code": null,
                    "use": null
                }
            ],
            "id": "dd6ce223-a8a0-4f76-aa5f-83f787dc440c",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1958-05-18",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "2156",
                "district": "2215",
                "state": "2116",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1351"
                }
            ],
            "mothersName": "Kamla",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00010",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1924",
            "firstName": "Danieal",
            "lastName": "J",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "3724e662-cd6f-4842-a292-cea559f33301",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00008",
                    "code": null,
                    "use": null
                }
            ],
            "id": "3724e662-cd6f-4842-a292-cea559f33301",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1954-05-13",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "H",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00008",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1923",
            "firstName": "David",
            "lastName": "K",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "64b78520-2259-4cb1-8b9a-d3db2d2678b2",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00009",
                    "code": null,
                    "use": null
                }
            ],
            "id": "64b78520-2259-4cb1-8b9a-d3db2d2678b2",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1954-09-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Kk",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00009",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1689",
            "firstName": "Jacob",
            "lastName": "J",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "9e211c62-4d55-4d07-bce0-827e1a2e887e",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00007",
                    "code": null,
                    "use": null
                }
            ],
            "id": "9e211c62-4d55-4d07-bce0-827e1a2e887e",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1959-08-25",
            "mobileNumber": null,
            "email": "binay@thelattice.in",
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Jn",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00007",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1400",
            "firstName": "Aman",
            "lastName": "Sharma",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "8af0a40a-709c-41e2-a173-e5b25942b3bc",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "434656",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00006",
                    "code": null,
                    "use": null
                }
            ],
            "id": "8af0a40a-709c-41e2-a173-e5b25942b3bc",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1996-06-30",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1337",
                "district": "1338",
                "state": "1336",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Anjali",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00006",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1382",
            "firstName": "Tony",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "4babb9bd-70b0-4cd8-a2f1-a37eba1ccf9e",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "4babb9bd-70b0-4cd8-a2f1-a37eba1ccf9e",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1954-08-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Dd",
            "fathersName": "M",
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1374",
            "firstName": "Zibran",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "4969d3bf-eac8-49a7-a521-7a8ec2ec3d1c",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00011",
                    "code": null,
                    "use": null
                }
            ],
            "id": "4969d3bf-eac8-49a7-a521-7a8ec2ec3d1c",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1954-07-14",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1342",
                "district": "1343",
                "state": "1341",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1345"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1351"
                }
            ],
            "mothersName": "Dd",
            "fathersName": "M",
            "spouseName": null,
            "heartcareId": "TES00011",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1357",
            "firstName": "Singh",
            "lastName": "Anuj",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "faaa209c-a67c-4a42-bc86-5d6ec3e0c013",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "3461845",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00004",
                    "code": null,
                    "use": null
                }
            ],
            "id": "faaa209c-a67c-4a42-bc86-5d6ec3e0c013",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1974-02-15",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1337",
                "district": "1338",
                "state": "1336",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "1340"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Anjali",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00004",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1356",
            "firstName": "Anita",
            "lastName": "Sharma",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "b574b4fc-ead7-491f-9684-52fd72042f81",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "1546459",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "b574b4fc-ead7-491f-9684-52fd72042f81",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1978-09-12",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "1337",
                "district": "1338",
                "state": "1336",
                "postalCode": "110018",
                "country": "Vanuatu",
                "addressLine1": "1340"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/1349"
                }
            ],
            "mothersName": "Anjali",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1300",
            "firstName": "Niik",
            "lastName": "K",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "78c3d9f7-876e-4633-9040-a445c7d330b2",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00003",
                    "code": null,
                    "use": null
                }
            ],
            "id": "78c3d9f7-876e-4633-9040-a445c7d330b2",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1964-08-11",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Djals",
            "fathersName": "Jj",
            "spouseName": "Ll",
            "heartcareId": "TES00003",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1126",
            "firstName": "M",
            "lastName": "Campaign",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "98960c90-8a3f-4f4e-8fa3-fc92bdc6dc5e",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "identifierNumber": "TES00002",
                    "code": null,
                    "use": null
                }
            ],
            "id": "98960c90-8a3f-4f4e-8fa3-fc92bdc6dc5e",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1976-05-04",
            "mobileNumber": null,
            "email": "mansi@thelattice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Fgbv ddffd fdd",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": "TES00002",
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1056",
            "firstName": "Joseph",
            "lastName": "K",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "c5d8144f-2214-4449-83d0-f3b68d3b350a",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "c5d8144f-2214-4449-83d0-f3b68d3b350a",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1958-07-25",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Lucy",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "1022",
            "firstName": "Fd",
            "lastName": "Df",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "6aab72aa-6221-48ed-92f2-56b652ded9c4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "32431",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "6aab72aa-6221-48ed-92f2-56b652ded9c4",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1970-05-15",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "1335",
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Rdfszz",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "835",
            "firstName": "Test",
            "lastName": "Screening",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "96d1a3e4-387e-447d-bc16-3ab2b72aa4d1",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "96d1a3e4-387e-447d-bc16-3ab2b72aa4d1",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1970-04-29",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Hcg",
            "fathersName": "Hggh",
            "spouseName": "Hgh",
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "760",
            "firstName": "New",
            "lastName": "Patient",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "0096fe66-131c-4719-b6ee-4815d202d648",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "0096fe66-131c-4719-b6ee-4815d202d648",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1966-04-28",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Mother",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "713",
            "firstName": "DJ",
            "lastName": "D",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "6e801a66-fa2e-45d8-8880-9f504b2de55a",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "6e801a66-fa2e-45d8-8880-9f504b2de55a",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1976-08-15",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "FF",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "649",
            "firstName": "John",
            "lastName": "Due",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "06baa11e-2c3c-42f9-80cf-913b5152a2a7",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "06baa11e-2c3c-42f9-80cf-913b5152a2a7",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1965-04-13",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "J",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "635",
            "firstName": "N",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "025424a4-e7e0-43cf-9587-240088c51eb4",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "025424a4-e7e0-43cf-9587-240088c51eb4",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1976-07-11",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Lkjfsl",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "616",
            "firstName": "N",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "28f4d6b3-a669-4d47-b4f6-163106ed8645",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "28f4d6b3-a669-4d47-b4f6-163106ed8645",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1976-07-13",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "TT",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "611",
            "firstName": "N",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "e6fcd912-e575-46c8-9c3d-c8e2db3de1b3",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "e6fcd912-e575-46c8-9c3d-c8e2db3de1b3",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1976-08-13",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "TTT",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "603",
            "firstName": "N",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "e9be2547-e5ad-42ad-a9e8-a71c36a5c8ce",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/hospital-id",
                    "identifierNumber": "123ABC",
                    "code": null,
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "1111",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "e9be2547-e5ad-42ad-a9e8-a71c36a5c8ce",
            "isDeleted": false,
            "gender": "female",
            "birthDate": "1976-08-12",
            "mobileNumber": null,
            "email": "nishita@thelattice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "1111112",
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "TT",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "598",
            "firstName": "N",
            "lastName": "Test",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "b7976f03-1d66-49c1-9648-79437efe96c1",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "b7976f03-1d66-49c1-9648-79437efe96c1",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1975-08-14",
            "mobileNumber": null,
            "email": "nishita@thelattice.in",
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu",
                "addressLine1": "264"
            },
            "gpsCoordinates": {
                "latitude": null,
                "longitude": null
            },
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "TT",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "595",
            "firstName": "John",
            "lastName": "Disuza",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "2c824e57-e3e2-484c-a32c-230d2143bd09",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "http://143.110.253.49/main/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "2c824e57-e3e2-484c-a32c-230d2143bd09",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1985-04-19",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": null,
                "country": "Vanuatu"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Liiza",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "485",
            "firstName": "Vinya",
            "lastName": "Sharma",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "279b6753-20a1-4c27-bf00-20e19d43de8c",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "40209",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "https://heartcare.gov.vu/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "279b6753-20a1-4c27-bf00-20e19d43de8c",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1994-04-16",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "23166",
                "country": "Vanuatu",
                "addressLine1": "264",
                "addressLine2": "Mavala"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Anita Sharma",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "443",
            "firstName": "Aditya",
            "lastName": "Sharma",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "38b6b112-f518-437f-bfc8-a5eaef641847",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "43209",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "https://heartcare.gov.vu/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "38b6b112-f518-437f-bfc8-a5eaef641847",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1994-04-16",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "23166",
                "country": "Vanuatu",
                "addressLine1": "264",
                "addressLine2": "Mavala"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Anita Sharma",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "437",
            "firstName": "Aditi",
            "lastName": "Sharma",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "ea7571f3-85ce-4760-9feb-0db100b6d4da",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "41209",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "https://heartcare.gov.vu/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "ea7571f3-85ce-4760-9feb-0db100b6d4da",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1994-04-16",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "23166",
                "country": "Vanuatu",
                "addressLine1": "264",
                "addressLine2": "Mavala"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "Anita Sharma",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "410",
            "firstName": "Agni check auth 2",
            "lastName": "agni issue check 2",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "5e65b6ce-7064-4a8d-b6f8-01208372d20e",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "87209",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "https://heartcare.gov.vu/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "5e65b6ce-7064-4a8d-b6f8-01208372d20e",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1996-04-16",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "23166",
                "country": "Vanuatu",
                "addressLine1": "264",
                "addressLine2": "Mavala"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "test id m",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        },
        {
            "fhirId": "368",
            "firstName": "Agni check auth",
            "lastName": "agni issue check",
            "identifier": [
                {
                    "identifierType": "https://www.thelattice.in/",
                    "identifierNumber": "8b3156c4-8fab-4741-8e2b-f00581d97334",
                    "code": "MR",
                    "use": null
                },
                {
                    "identifierType": "https://crvsd.gov.vu/services/national-id-cards-and-e-id",
                    "identifierNumber": "87609",
                    "code": null,
                    "use": "temp"
                },
                {
                    "identifierType": "https://heartcare.gov.vu/dashboard/patient-info",
                    "code": null,
                    "use": null
                }
            ],
            "id": "8b3156c4-8fab-4741-8e2b-f00581d97334",
            "isDeleted": false,
            "gender": "male",
            "birthDate": "1996-04-16",
            "mobileNumber": null,
            "permanentAddress": {
                "city": "261",
                "district": "262",
                "state": "260",
                "postalCode": "23166",
                "country": "Vanuatu",
                "addressLine1": "264",
                "addressLine2": "Mavala"
            },
            "gpsCoordinates": null,
            "managingOrganization": {
                "reference": null
            },
            "generalPractitioner": [
                {
                    "reference": "Practitioner/266"
                }
            ],
            "mothersName": "test id mother",
            "fathersName": null,
            "spouseName": null,
            "heartcareId": null,
            "patientDeceasedReasonId": null,
            "patientDeceasedReason": null
        }
    ]
            if (rawPatients.length === 0) {
                hasMoreRecords = false;
                break;
            }

            console.log(`📥 Processing ${rawPatients.length} records in current thread chunk...`);

            // 2. Map and parse row details to feed concurrently into the worker
            const tasks = rawPatients.map(async (rawPatient) => {
                try {
                    // Normalize the data shape if your database stores fields as flat items
                    // rather than the nested structures your live FHIR controllers receive.
                    // Fire the optimized atomic worker we locked down
                    await upsertSnapshotPatient(rawPatient);
                    totalProcessed++;
                } catch (recordError) {
                    // Suppress individual failures so one bad row doesn't crash the entire script run
                    console.error(`❌ Skip Error on Patient ID [${rawPatient.id}]:`, recordError.message);
                }
            });

            // Run this current batch concurrently
            await Promise.allSettled(tasks);

            // 3. Keep step progression shifting forward
            offset += BATCH_SIZE;

            // Optional safety breaker: if the chunk returns less than the batch size, it was the final page.
            if (rawPatients.length < BATCH_SIZE) {
                hasMoreRecords = false;
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 Backfill successfully complete!`);
        console.log(`✨ Total database snapshots sync-ups updated: ${totalProcessed}`);
        console.log(`⏱️ Total time elapsed: ${duration} seconds`);

    } catch (globalError) {
        console.error('💥 Critical script failure triggered:', globalError);
        process.exit(1);
    } finally {
        // Clean up open network threads
        await sequelize.close();
        console.log('🛑 Database connection pool terminated safely.');
        process.exit(0);
    }
}

// Execute command runner
runBackfill();