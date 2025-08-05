const { identifierUrl } = require("../utils/heartcareSystemUrl");

class RiskFactorQuestionnaireResponse {
  constructor(answerObj, fhirResource) {
    this.fhirResource = fhirResource;
    this.answerObj = answerObj;
  }

  setBasicStructure() {
    this.fhirResource = {
      resourceType: "QuestionnaireResponse",
      identifier: {
        system: identifierUrl,
        value: this.answerObj.uuid,
      },
      status: "completed",
      questionnaire: this.answerObj.questionnaireId,
      encounter: { reference: "Encounter/" + this.answerObj.encounterId },
      author: {
        reference: "Practitioner/" + this.answerObj.practitionerId,
      },
      source: {
        reference: "Patient/" + this.answerObj.patientId,
      },
      authored: this.answerObj.appUpdatedDate,
      item: [],
    };
  }

  getFixedData() {
    this.answerObj = {
      fhirId: this.fhirResource.id,
      practitionerId: this.fhirResource.author.reference.split("/")[1],
      patientId: this.fhirResource.source.reference.split("/")[1],
      uuid: this.fhirResource.identifier.value,
      appUpdatedDate: this.fhirResource.authored,
    };
  }

  setData() {
    this.fhirResource.item = [
      {
        linkId: "tobaccoUse",
        answer: [
          {
            valueCoding: {
              code: this.answerObj?.tobaccoUse ?? null
            },
          },
        ],
      },
      {
        linkId: "briefAdvice",
        answer: [
          {
            valueBoolean:  this.answerObj?.briefAdvice ?? null
          },
        ],
      },
      {
        linkId: "assessedStatus",
        answer: [
          {
            valueBoolean: this.answerObj?.assessedStatus ?? null
          },
        ],
      },
      {
        linkId: "assistQuit",
        answer: [
          {
            valueCoding: {
              code: this.answerObj?.assistQuit ?? null
            },
          },
        ],
      },
      {
        linkId: "pharmacotherapy",
        answer: [
          {
            valueCoding: {
              code: this.answerObj?.pharmacotherapy ?? null
            },
          },
        ],
      },
      {
        linkId: "dateOfPlan",
        answer: [
          {
            valueDate: this.answerObj?.dateOfPlan ?? null
          },
        ],
      },
      {
        linkId: "planStatus",
        answer: [
          {
            valueCoding: {
              code: this.answerObj?.planStatus ?? null
            },
          },
        ],
      },
    ];
  }

  getData() {
    const item = this.fhirResource.item;
    this.answerObj.tobaccoUse = item?.[0]?.answer?.[0]?.valueCoding?.code || null;
    this.answerObj.briefAdvice = item?.[1]?.answer?.[0]?.valueBoolean || null;
    this.answerObj.assessedStatus = item?.[2]?.answer?.[0]?.valueBoolean || null;
    this.answerObj.assistQuit = item?.[3]?.answer?.[0]?.valueCoding?.code || null;
    this.answerObj.pharmacotherapy = item?.[4]?.answer?.[0]?.valueCoding?.code || null;
    this.answerObj.dateOfPlan = item?.[5]?.answer?.[0]?.valueDate || null;
    this.answerObj.planStatus = item?.[6]?.answer?.[0]?.valueCoding?.code || null;
  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setData();
  }
  getFHIRResource() {
    return this.fhirResource;
  }

  getFHIRToTransformedResult() {
    this.getFixedData();
    this.getData();
  }

  getSimplifiedOutput() {
    return this.answerObj;
  }
}

module.exports = RiskFactorQuestionnaireResponse;
