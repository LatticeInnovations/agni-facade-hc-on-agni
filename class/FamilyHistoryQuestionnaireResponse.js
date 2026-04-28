const { identifierUrl } = require("../utils/heartcareSystemUrl");

class FamilyHistoryQuestionnaireResponse {

    constructor(answerObj, fhirResource) {
        this.fhirResource = fhirResource;
        this.answerObj = answerObj;
    }

    setBasicStructure() {
        this.fhirResource = {
            resourceType: "QuestionnaireResponse",
            identifier: 
                {
                    "system": identifierUrl,
                    "value": this.answerObj.uuid
                },
            status: "completed",
            questionnaire: this.answerObj.questionnaireId,
            encounter: {"reference": "Encounter/" + this.answerObj.encounterId},
            author: {
                reference: "Practitioner/" + this.answerObj.practitionerId
            },
            source: {
                "reference": "Patient/" + this.answerObj.patientId
            },
            authored: this.answerObj.appUpdatedDate,
            item: [
                {
                    "linkId": "familyDiseaseDetail",
                    "answer": []
                },
                {
                    "linkId": "occurrenceAgeBoolean",
                    "answer": []
                }
            ]
        }
    }

    getFixedData() {
        this.answerObj = {
            fhirId:  this.fhirResource.id,
            practitionerId: this.fhirResource.author.reference.split("/")[1],
            patientId: this.fhirResource.source.reference.split("/")[1],
            uuid: this.fhirResource.identifier.value,
            appUpdatedDate: this.fhirResource.authored,
        }
    }


    setFamilyDiseaseDetail() {
        this.answerObj.familyDiseases.forEach(element => {
            this.fhirResource.item[0].answer.push({
                "valueCoding": {
                "code": element
              }
            })
        });
    }

    getFamilyDiseaseDetail() {
        this.answerObj.familyDiseases = this.fhirResource?.item?.[0]?.answer?.map(e=> e.valueCoding.code) || []
    }


    setOccurrenceAgeBoolean() {
        if(this.answerObj.occurrenceAgeData &&  this.answerObj.occurrenceAgeData!= null)
            this.fhirResource.item[1].answer.push({
               "valueCoding": {
                    "code": this.answerObj.occurrenceAgeData
                  }
            })
    }

    getOccurrenceAgeBoolean() {
        this.answerObj.occurrenceAgeData = this.fhirResource?.item?.[1]?.answer?.[0]?.valueCoding?.code || null
    }

    getPractitionerId() {
        console.log(this.fhirResource.author.reference.split("/")[1])
        this.answerObj.practitionerId = this.fhirResource?.author?.reference?.split("/")[1] || null;
        console.log("practitionerId", this.answerObj.practitionerId)
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setFamilyDiseaseDetail();
        this.setOccurrenceAgeBoolean();
    }
    getFHIRResource() {
        return this.fhirResource;
    }

    getFHIRToTransformedResult() {
        this.getFixedData();
        this.getFamilyDiseaseDetail();
        this.getOccurrenceAgeBoolean();
        this.getPractitionerId();
    }

    getSimplifiedOutput() {
        return this.answerObj;
    }

}

module.exports = FamilyHistoryQuestionnaireResponse
