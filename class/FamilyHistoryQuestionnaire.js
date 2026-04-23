const heartcareUrls = require("../utils/heartcareSystemUrl")
class FamilyHistoryQuestionnaire {

    constructor(questionnaireObj, fhirResource) {
        this.questionnaireObj = questionnaireObj;
        this.fhirResource = fhirResource;
    }

    setData() {
        this.fhirResource = {
            "resourceType": "Questionnaire",
            "identifier": [
              {
                system: heartcareUrls.identifierUrl,
                value: this.questionnaireObj.questionnaireId
              }
            ],
            "title": this.questionnaireObj.questionnaireName,
            "name": this.questionnaireObj.questionnaireName,
            "status": "active",
            "description": "Questionnaire for patient's family history",
            "item": [
              {
                "linkId": "familyDiseaseDetail",
                "text": "Does (or did) a parent, brother or sister have:",
                "type": "choice",
                "repeats": true,
                "answerOption": [
                  {
                    "valueCoding": {
                      "code": "56265001",
                      "display": "Heart attack/ angina/ other heart disease",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "266257000",
                      "display": "Transient ischaemic attack (TIA)",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "73211009",
                      "display": "Diabetes",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "431855005",
                      "display": "Chronic kidney disease",
                      "system": "http://snomed.info/sct"
                    }
                  }
                ]
              },
             {
                "linkId": "occurrenceAgeBoolean",
                "type": "choice",
                "text": "Did this occur before he/she was the age of 55 (male) / 65 (female)?",
                "repeats": false,
                "enableWhen": [
                  {
                    "question": "familyDiseaseDetail",
                    "operator": "exists",
                    "answerBoolean": true
                  }
                ],
                "answerOption": [
                    {
                        "valueCoding": {
                          "code": "1",
                          "display": "Yes"
                        }
                      },
                      {
                        "valueCoding": {
                          "code": "2",
                          "display": "No"
                        }
                    }
                ]
              },

            ]
          }

    }

    getJsonToFhirTranslator() {
        this.setData()
    }
    getFHIRResource() {
        return this.fhirResource;
    }
}

module.exports = FamilyHistoryQuestionnaire;