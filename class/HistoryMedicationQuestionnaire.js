const heartcareUrls = require("../utils/heartcareSystemUrl")
class HistoryMedicationQuestionnaire {

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
            "description": "Questionnaire for patient's history taking and tests - medication section",
            "item": [
              {
                "linkId": "medicinePrescribed",
                "text": "Are you taking any medication prescribed by a doctor for:",
                "type": "choice",
                "repeats": true,
                "answerOption": [
                  {
                    "valueCoding": {
                      "code": "38341003",
                      "display": "Hypertension",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "73211009",
                      "display": "Diabetes: oral pill",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "44054006",
                      "display": "Diabetes: insulin",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "13644009",
                      "display": "Hypercholesterolaemia: statin",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "49601007",
                      "display": "High CVD risk or prophylactic use: aspirin",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "131531000119103",
                      "display": "Previous CVD event: aspirin",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "711150003",
                      "display": "Previous CVD event: anticoagulant",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "195967001",
                      "display": "Asthma",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "13645005",
                      "display": "Chronic obstructive pulmonary disease (COPD)",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "709044004",
                      "display": "Chronic Kidney Disease",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "363346000",
                      "display": "Cancer",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "82423001",
                      "display": "Chronic pain",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "421563008",
                      "display": "Traditional remedies",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "56717001",
                      "display": "Tuberculosis",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "62479008",
                      "display": "AIDS",
                      "system": "http://snomed.info/sct"
                    }
                  },
                  {
                    "valueCoding": {
                      "code": "74964007",
                      "display": "Others",
                      "system": "http://snomed.info/sct"
                    }
                  }
                ]
              },
              {
                "linkId": "medicinePrescribedOthers",
                "text": "Please specify other disease",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "medicinePrescribed",
                    "operator": "=",
                    "answerCoding": {
                      "code": "74964007",
                      "system": "http://snomed.info/sct"
                    }
                  }
                ]
              },
              {
                "linkId": "Adherence",
                "type": "choice",
                "repeats": false,
                "enableWhen": [
                  {
                    "question": "medicinePrescribed",
                    "operator": "exists",
                    "answerBoolean": true
                  }
                ],
                "answerOption": [
                    {
                        "valueCoding": {
                          "code": "1",
                          "display": "Taking medication as prescribed"
                        }
                      },
                      {
                        "valueCoding": {
                          "code": "2",
                          "display": "Discontinued due to poor compliance"
                        }
                    },
                    {
                        "valueCoding": {
                          "code": "3",
                          "display": "Forget to take medication sometimes"
                        }
                    },
                    {
                        "valueCoding": {
                          "code": "4",
                          "display": "Discontinued due to pharmacy stock-out"
                        }
                    }
                ]
              },
              {
                "linkId": "sideEffects",
                "text": "Side effects",
                "type": "boolean"
              },
              {
                "linkId": "sideEffectsText",
                "text": "Please specify",
                "type": "string",
                "required": true,
                "enableWhen": [
                  {
                    "question": "sideEffectsCheckbox",
                    "operator": "=",
                    "answerBoolean": true
                  }
                ]
              }
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

module.exports = HistoryMedicationQuestionnaire;