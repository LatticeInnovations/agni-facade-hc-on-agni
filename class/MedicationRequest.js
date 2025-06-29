let { checkEmptyData } = require("../services/CheckEmpty");
let timing = require("../utils/medtime.json");
const doseFormList = require("../utils/dosForm.json")
const config = require("../config/nodeConfig");
class MedicationRequest {
    medReqObj;
    fhirResource;

    constructor(med_req_obj, fhir_resource) {
        this.medReqObj = med_req_obj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "MedicationRequest";
    }

   setIdentifier() {
    this.fhirResource.identifier = this.medReqObj.identifier;
   }
   getIdentifier() {
    this.medReqObj.identifier = this.fhirResource.identifier;
   }


   getMedFhirId() {
    this.medReqObj.medFhirId = this.fhirResource?.medicationReference?.reference.split("/")[1];
}


 
getId() {
    this.medReqObj.medReqFhirId = this.fhirResource.id
    if(this.fhirResource.identifier) {        
        this.medReqObj.medReqUuid = this.fhirResource.identifier[0].value
    }

   }


    setIntent() {
        this.fhirResource.intent = "order";
    }

    setMedication() {
        if(this.medReqObj.medFhirId) {
            this.fhirResource.medicationReference.reference = "Medication/" + this.medReqObj.medFhirId
        }
        
    }

    setGroupIdentifier() {      
        this.fhirResource.groupIdentifier = {
            "system": config.prescriptionUrl,
            "value": this.medReqObj.grpIdentify
        }
    }


    setPatientReference() {
        this.fhirResource.subject.reference = "Patient/" + this.medReqObj.patientId
    }

    getPatientReference() {
        this.medReqObj.patientId = this.fhirResource.subject.reference.split("/")[1];
    }

    setEncounter() {
        this.fhirResource.encounter.reference = "urn:uuid:" +this.medReqObj.encounterId;
    }

    setNote() {
        if(!checkEmptyData(this.medReqObj.note)){
            this.fhirResource.note.push({text: this.medReqObj.note}) 
        }
    }

    getNote() {
        if(!checkEmptyData(this.fhirResource.note)) {
            this.medReqObj.note = this.fhirResource.note[0].text;
        }
        else {
            this.medReqObj.note = null;
        }
    }

    setEffectiveDosePeriod() {
        let startDate = this.medReqObj.generatedOn;
        let endDate = new Date(startDate);  
        endDate = endDate.setDate(endDate.getDate() + (this.medReqObj.duration -1));
        this.fhirResource.effectiveDosePeriod = {
            start: startDate,
            end: endDate
        }
    }

    getDoseInstruction() {
        if(this.fhirResource.dosageInstruction) {
            this.medReqObj.qtyPerDose = this.fhirResource.dosageInstruction[0].doseAndRate[0].doseQuantity.value;
            this.medReqObj.frequency = this.fhirResource.dosageInstruction[0].timing.repeat.frequency;
            this.medReqObj.doseForm = this.fhirResource.dosageInstruction[0].doseAndRate[0].doseQuantity.unit;
            this.medReqObj.doseFormCode = doseFormList[this.fhirResource.dosageInstruction[0].doseAndRate[0].doseQuantity.unit];
            this.medReqObj.duration = this.fhirResource.dosageInstruction[0].timing.repeat.period;
            console.log()
            if(this.fhirResource.dosageInstruction[0].additionalInstruction) {
                this.medReqObj.timing = this.fhirResource.dosageInstruction[0].additionalInstruction[0].coding[0].code;
            }
            else {
                this.medReqObj.timing = null;
            }
        }

    }

    setDosageInstruction() {
        if(this.medReqObj.medFhirId) {
            let data = {
                "timing" : {
                    "repeat": {
                        "boundsDuration" : {
                               "unit":"days",
                               "system":config.measureUrl,
                               "code":"d"
    
                        },
                        "frequency": this.medReqObj.frequency,
                        "period": this.medReqObj.duration,
                        "periodUnit": "d"
                    }
                },
                "doseAndRate": [
                    {
                        "doseQuantity":{
                            "value":this.medReqObj.qtyPerDose,
                            "unit":this.medReqObj.doseForm,
                            "system":config.sctCodeUr,
                            "code": doseFormList[this.medReqObj.doseForm]
                         }
    
                    }
                ]
            }
            if(!checkEmptyData(this.medReqObj.timing)){
               data.additionalInstruction = [
                {
                    "coding": [
                        {
                            "system":config.sctCodeUr,
                            "code":this.medReqObj.timing,
                            "display": timing.filter(e => e.medinstructionCode == this.medReqObj.timing).map(e => e.medinstructionVal)[0]
                        }
                    ]
                }
               ]
            }
            this.fhirResource.dosageInstruction.push(data);
        }
        
        
    }

    setDocument(){
        if(this.medReqObj.prescriptionFiles) {
            this.medReqObj.prescriptionFiles.forEach((file) => {
                this.fhirResource.supportingInformation.push({
                    "reference": "urn:uuid:" + file.documentUuid
                });
            });
        }

    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setIntent();
        this.setMedication();
        this.setGroupIdentifier();
        this.setPatientReference();
        this.setEncounter();
        this.setNote();
        this.setDosageInstruction();
        this.setDocument();
    }

    getJSONtoFhirForPrescriptionDocument(){
        this.setBasicStructure();
        this.setIdentifier();
        this.setIntent();
        this.setGroupIdentifier();
        this.setPatientReference();
        this.setEncounter();
        this.setDocument();
    }

    getFHIRToTransformedResult() {
        this.getId();
        this.getMedFhirId();
        this.getNote();
        this.getDoseInstruction();
    }

    getSimplifiedOutput() {
        return this.medReqObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    setBasicStructure() {
        this.fhirResource.dosageInstruction = [];
        this.fhirResource.medicationReference = {};
        this.fhirResource.subject = {};
        this.fhirResource.encounter = {};
        this.fhirResource.note = [];
        this.fhirResource.identifier = [];
        this.fhirResource.supportingInformation = [];
        this.fhirResource.status = "completed";
    }



    deletePrescriptionDocument(){
        this.fhirResource.status = "entered-in-error";
        return this.fhirResource;
    }
}


module.exports = MedicationRequest;