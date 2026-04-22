const { identifierUrl } = require("../utils/heartcareSystemUrl");

class AllergyIntolerance {

    constructor(answerObj, fhirResource) {
        this.fhirResource = fhirResource;
        this.answerObj = answerObj;
    }

    setBasicStructure() {
        this.fhirResource = {
            resourceType: "AllergyIntolerance",
            identifier: 
                {
                    "system": identifierUrl,
                    "value": this.answerObj.uuid
                },
            encounter: {"reference": "Encounter/" + this.answerObj.encounterId},
            recorder: {
                reference: "Practitioner/" + this.answerObj.practitionerId
            },
            patient: {
                "reference": "Patient/" + this.answerObj.patientId
            },
            recordedDate: this.answerObj.appUpdatedDate,
            note: []
        }
    }

    setType() {
        this.fhirResource.code = [
            {
                coding: [
                    {
                        code: this.answerObj.type,
                        system: "https://your-custom-coding-system"
                    }
                ]
            }
        ]
    }

    getFixedData() {
        this.answerObj = {
            fhirId:  this.fhirResource.id,
            practitionerId: this.fhirResource.recorder.reference.split("/")[1],
            patientId: this.fhirResource.patient.reference.split("/")[1],
            uuid: this.fhirResource?.identifier?.[0]?.value || null,
            appUpdatedDate: this.fhirResource.recordedDate,
        }
    }

    setAllergy() {
        this.fhirResource.note.push({
                "text": this.answerObj?.allergy || null
            })
    }

    getAllergy() {
        this.answerObj.allergy = this.fhirResource?.note?.[0]?.text || null
    }


    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setAllergy();
        this.setType();
    }
    getFHIRResource() {
        return this.fhirResource;
    }

    getFHIRToTransformedResult() {
        this.getFixedData();
        this.getAllergy();
    }

    getSimplifiedOutput() {
        return this.answerObj;
    }

}

module.exports = AllergyIntolerance
