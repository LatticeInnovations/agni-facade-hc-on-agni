const { identifierUrl } = require("../utils/heartcareSystemUrl");

class HistoryMedicationQuestionnaireResponse {

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
                    "linkId": "medicinePrescribed",
                    "answer": []
                },
                {
                    "linkId": "medicinePrescribedOthers",
                    "answer": [ ]
                },
                {
                    "linkId": "Adherence",
                    "answer": []
                },
                {
                    "linkId": "sideEffects",
                    "answer": []
                },
                {
                    "linkId": "sideEffectsText",
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


    setSection1Answer() {
        this.answerObj.medicinePrescribed.forEach(element => {
            this.fhirResource.item[0].answer.push({
                "valueCoding": {
                "code": element
              }
            })
        });
    }

    getSection1Answer() {
        this.answerObj.medicinePrescribed = this.fhirResource.item[0]?.answer?.map(e=> e.valueCoding.code) || []
    }

    setMedicinePrescribedOthers() {
        const otherCheckIndex = this.answerObj.medicinePrescribed.findIndex(e => e === "74964007")
        console.log("otherCheckIndex: ", otherCheckIndex)
        if(otherCheckIndex > -1)
        this.fhirResource.item[1].answer.push({
            "valueString": this.answerObj.medicinePrescribedOthers
        })
    }
    getMedicinePrescribedOthers() {
        this.answerObj.medicinePrescribedOthers = this.fhirResource.item[1]?.answer?.[0]?.valueString || null
    }

    setSection2Answer() {
        if(this.answerObj.adherence &&  this.answerObj.adherence!= null)
            this.fhirResource.item[2].answer.push({
               "valueCoding": {
                    "code": this.answerObj.adherence
                  }
            })
    }

    getSection2Answer() {
        this.answerObj.adherence = this.fhirResource.item[2]?.answer?.[0]?.valueCoding?.code || null
    }

    setSection3Answer() {
            this.fhirResource.item[3].answer.push({
                "valueBoolean": this.answerObj.hasSideEffect
        })

    }
    
    getSection3Answer() {
        this.answerObj.hasSideEffect = this.fhirResource.item[3].answer[0].valueBoolean;
    }

    setSection4Answer() {
        if(this.answerObj.sideEffects &&  this.answerObj.sideEffects!= null)
            this.fhirResource.item[4].answer.push({
                    "valueString": this.answerObj.sideEffects
            })
    }

    getSection4Answer() {
        this.answerObj.sideEffects = this.fhirResource.item[4]?.answer?.[0]?.valueString || null
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setSection1Answer();
        this.setMedicinePrescribedOthers();
        this.setSection2Answer();
        this.setSection3Answer();
        this.setSection4Answer();
    }
    getFHIRResource() {
        return this.fhirResource;
    }

    getFHIRToTransformedResult() {
        this.getFixedData();
        this.getSection1Answer();
        this.getMedicinePrescribedOthers();
        this.getSection2Answer();
        this.getSection3Answer();
        this.getSection4Answer();
    }

    getSimplifiedOutput() {
        return this.answerObj;
    }

}

module.exports = HistoryMedicationQuestionnaireResponse