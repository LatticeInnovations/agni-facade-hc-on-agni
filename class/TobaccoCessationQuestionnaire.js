const heartcareUrls = require("../utils/heartcareSystemUrl");
class TobaccoCessationQuestionnaire {
  constructor(questionnaireObj, fhirResource) {
    this.questionnaireObj = questionnaireObj;
    this.fhirResource = fhirResource;
  }

  setData() {
    this.fhirResource = {
      resourceType: "Questionnaire",
      identifier: [
        {
          system: heartcareUrls.identifierUrl,
          value: this.questionnaireObj.questionnaireId,
        },
      ],
      "title": this.questionnaireObj.questionnaireName,
      "name": this.questionnaireObj.questionnaireName,
      "status": "active",
      "description": "Questionnaire for patient's Tobacco Cessation - history section",
      item: [
        {
          "linkId": "tobaccoUse",
          "text": "Does the patient use tobacco?",
          "type": "choice",
          "answerOption": [
            { "valueCoding": { "code": "1", "display": "Yes, every day" } },
            { "valueCoding": { "code": "2", "display": "Yes, but not every day" } },
            { "valueCoding": { "code": "3", "display": "No, I do not use tobacco" } }
          ]
        },
        {
          "linkId": "briefAdvice",
          "text": "Has patient been given personalized advice on quitting tobacco use?",
          "type": "boolean",
          "enableWhen": [
            {
              "question": "tobaccoUse",
              "operator": "=",
              "answerCoding": { "code": "1" }
            },
            {
              "question": "tobaccoUse",
              "operator": "=",
              "answerCoding": { "code": "2" }
            }
          ],
          "enableBehavior": "any"
        },
        {
          "linkId": "assessedStatus",
          "text": "Is the patient ready to quit?",
          "type": "boolean",
          "enableWhen": [
            {
              "question": "briefAdvice",
              "operator": "=",
              "answerBoolean": true
            }
          ]
        },
        {
          "linkId": "assistQuit",
          "text": "Quit plan completed?",
          "type": "choice",
          "answerOption": [
            { "valueCoding": { "code": "1", "display": "Yes, brief quit plan" } },
            { "valueCoding": { "code": "2", "display": "Yes, intensive quit plan" } },
            { "valueCoding": { "code": "3", "display": "No" } },
            { "valueCoding": { "code": "4", "display": "No, refer to intensive counselling" } }
          ],
          "enableWhen": [
            {
              "question": "assessedStatus",
              "operator": "=",
              "answerBoolean": true
            }
          ]
        },
        {
          "linkId": "pharmacotherapy",
          "text": "Pharmacotherapy (PH) provided?",
          "type": "choice",
          "answerOption": [
            { "valueCoding": { "code": "1", "display": "Yes, Nicotine Replacement Therapy" } },
            { "valueCoding": { "code": "2", "display": "Yes, other" } },
            { "valueCoding": { "code": "3", "display": "No" } }
          ],
          "enableWhen": [
            {
              "question": "assistQuit",
              "operator": "=",
              "answerCoding": { "code": "2" }
            }
          ]
        },
        {
          "linkId": "dateOfPlan",
          "text": "Start date of plan",
          "type": "date",
          "enableWhen": [
            {
              "question": "assistQuit",
              "operator": "=",
              "answerCoding": { "code": "1" }
            },
            {
              "question": "assistQuit",
              "operator": "=",
              "answerCoding": { "code": "2" }
            }
          ],
          "enableBehavior": "any"
        },
        {
          "linkId": "planStatus",
          "text": "Status of plan",
          "type": "choice",
          "answerOption": [
            { "valueCoding": { "code": "1", "display": "Active" } },
            { "valueCoding": { "code": "2", "display": "Completed" } },
            { "valueCoding": { "code": "3", "display": "Abandoned" } }
          ],
          "enableWhen": [
            {
              "question": "assistQuit",
              "operator": "=",
              "answerCoding": { "code": "1" }
            },
            {
              "question": "assistQuit",
              "operator": "=",
              "answerCoding": { "code": "2" }
            }
          ],
          "enableBehavior": "any"
        }
      ]
    }
  }

  getJsonToFhirTranslator() {
    this.setData();
  }
  getFHIRResource() {
    return this.fhirResource;
  }
}

module.exports = TobaccoCessationQuestionnaire;
