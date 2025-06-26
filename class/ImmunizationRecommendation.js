const config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const vaccines = require('../utils/vaccines.json');
const moment = require('moment');

class ImmunizationRecommendation {
    fhirResource;
    data;
    constructor(data, fhir_resource) {
        this.fhirResource = fhir_resource;
        this.immunizationRec = data;
    }

    setBasicStructure() {
        this.fhirResource.resourceType = "ImmunizationRecommendation";
        this.fhirResource.id = uuidv4();
        this.fhirResource.patient = {
            reference: "Patient/" + "urn:uuid:" + this.immunizationRec.patientId
        }
        this.fhirResource.date = new Date().toISOString();
        this.fhirResource.authority = {
            "reference": "Organization/" + this.immunizationRec.orgId, // id of practitioner
        }
    }

    createRecommendationData(code, birthDate, dose, doses, vaccineData) {
        // console.info("code", code, " birthdate ", birthDate, " dose ", dose, " vaccine data", vaccineData)
        let startDate = moment(birthDate).add(vaccineData.doses[dose].start, 'weeks');
        let endDate = moment(birthDate).add(vaccineData.doses[dose].end, 'weeks');
        let midDate = moment(startDate).add(endDate.diff(startDate) / 2, 'milliseconds').toISOString();
        return {
            "vaccineCode": [
                {
                    "coding": [
                        {
                            "system": "http://hl7.org/fhir/sid/cvx",
                            "code": code,
                            "display": vaccineData.display
                        }
                    ],
                    "text": vaccineData.text
                }
            ],
            "dateCriterion": [
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org/",
                                "code": "30981-5",
                                "display": "Earliest date to give"
                            }
                        ]
                    },
                    "value": moment(birthDate).add(vaccineData.doses[dose].start, 'weeks').toISOString()
                },
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org/",
                                "code": "30980-7",
                                "display": "Date vaccine due"
                            }
                        ]
                    },
                    "value": midDate
                },
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org/",
                                "code": "59778-1",
                                "display": "Latest date to give immunization"
                            }
                        ]
                    },
                    "value": moment(birthDate).add(vaccineData.doses[dose].end, 'weeks').toISOString()
                }
            ],
            "doseNumberString": dose,
            "seriesDosesString": doses.length,
        }
    }

    setRecommendation() {
        this.fhirResource.recommendation = [];
        let vaccineData = vaccines[this.immunizationRec.code];
        let doses = Object.keys(vaccineData.doses);
        for (let dose of doses) {
            this.fhirResource.recommendation.push(this.createRecommendationData(this.immunizationRec.code, this.immunizationRec.birthDate, dose, doses, vaccineData));
        }
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setRecommendation();
    }

    getFHIRResource() {
        return this.fhirResource;
      }
    

      getFHIRToTransformedResult() {
        let result = [];
        for(let recommendation of this.fhirResource.recommendation) {
            result.push({
                patientId : this.fhirResource.patient.reference.split('/')[1],
                vaccine : recommendation.vaccineCode[0].coding[0].display,
                vaccineText : recommendation.vaccineCode[0].text,
                vaccineCode : recommendation.vaccineCode[0].coding[0].code,
                seriesDoses : recommendation?.seriesDosesString || null,
                doseNumber : recommendation?.doseNumberString || null,
                vaccineStartDate : recommendation?.dateCriterion?.filter(e => e.code.coding[0]?.code == "30981-5")[0].value,
                vaccineEndDate : recommendation?.dateCriterion?.filter(e => e.code.coding[0]?.code == "59778-1")[0].value,
                vaccineBufferDate : recommendation?.dateCriterion?.filter(e => e.code.coding[0]?.code == "30981-5")[0].value,
                vaccineDueDate : recommendation?.dateCriterion?.filter(e => e.code.coding[0]?.code == "30980-7")[0].value,
            });
            this.immunizationRec.result = result
        }
    }

    getSimplifiedOutput() {
        return this.immunizationRec;
      }

      setPatchData() {
        let recommendation = [];
        let code = this.fhirResource?.recommendation?.[0]?.vaccineCode?.[0]?.coding?.[0]?.code;
        let vaccineData = vaccines[code];
        let doses = Object.keys(vaccineData.doses);
        for (let dose of doses) {
            recommendation.push(this.createRecommendationData(code, this.immunizationRec.birthDate, dose, doses, vaccineData));
        }

        return [{
            "op": "replace",
            "path": "/recommendation",
            "value": recommendation
        }]
    }
}

module.exports = ImmunizationRecommendation;