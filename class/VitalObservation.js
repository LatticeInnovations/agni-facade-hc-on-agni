const BaseObservation = require("./BaseObservation");

const vitalCodeMap = {
  bloodGlucose: { code: "36048009", display: "Blood glucose" },
  serumCreatinine: { code: "113075003", display: "Serum creatinine" },
  abdominalCircumference: { code: "396552003", display: "Abdominal circumference" },
  hipCircumference: { code: "284472007", display: "Hip circumference" },
  serumPotassium: { code: "271236005", display: "Serum potassium" },
  hbA1cPercentage: { code: "43396009", display: "HbA1c" },
  urineProtein: { code: "57378007", display: "Urine protein" },
  urineKetones: { code: "271347000", display: "Urine ketones" },
  eyeExamination: { code: "36228007", display: "Eye examination" },
  footExamination: { code: "284384005", display: "Foot examination" },
  others: { code: "74964007", display: "Other test" },
};
const reverseVitalCodeMap = Object.fromEntries(
  Object.entries(vitalCodeMap).map(([key, val]) => [val.code, key])
);

class VitalObservation extends BaseObservation {
    constructor(observationObj, fhirResource, vitalType) {
      super(observationObj);
      this.observationObj = observationObj;
      this.fhirResource = fhirResource;
      this.vitalType = vitalType;  
    }

  setEncounterReference() {
    if(this.observationObj?.encounterId) {
        this.fhirResource.encounter.reference = this.observationObj?.encounterId;
    }
   
}




  setCommonVitalsStructure() {
    this.fhirResource.resourceType = "Observation";
    this.fhirResource.status = "final";
    this.setBasicStructure();
    if (this.observationObj.appUpdatedDate) {
      this.fhirResource.effectiveDateTime = this.observationObj.appUpdatedDate;
    }
  }

  setCode() {
    this.fhirResource.code = this.setVitalCode()
  }

  setVitalCode() {
    const { code, display } = vitalCodeMap[this.vitalType] || {};
  return {
      coding: [
        {
          system: "http://snomed.info/sct",
          code,
          display: this.observationObj.type
        }
      ],
      text: display
    };
  }

  setComponent() {
    const vitalType = this.vitalType;
    const value = this.observationObj.value;
    const code = this.setVitalCode();
  
    const component = {
      code,
      ...this.getValueForComponent(vitalType, value)
    };
    
    this.fhirResource.component.push(component);
  }

  getComponent() {
    const key = reverseVitalCodeMap[this.fhirResource.code.coding[0].code];
    const component = this.fhirResource.component ?? null;
    if(component) {
      this.observationObj[key] = this._extractComponentValue(component[0])
      if(key === 'hbA1cPercentage' ) {
        this.observationObj[key] = this.observationObj?.hbA1cPercentage?.value || null
      }

    }
    else  {
      this.observationObj[key] = null
    }
   
  }

  _extractComponentValue(component) {
    if (component?.valueQuantity) {
      return {
        value: component.valueQuantity.value ?? null,
        unit: component.valueQuantity.unit ?? null,
        type: component.code?.coding?.[0]?.display
      };
    }  
    else if (component?.valueCodeableConcept) {
      return component.valueCodeableConcept.text;
    }  
    else if (component?.valueString) {
      return component.valueString
    }  
    return null;
  }

  getValueForComponent(vitalType, value) {
    const valueType = this.getValueType(vitalType);
  
    switch (valueType) {
      case "valueQuantity":
        return {
          valueQuantity: this.buildValueQuantity(vitalType, value)
        };
  
      case "valueCodeableConcept":
        return {
          valueCodeableConcept: {
            text: value
          }
        };
  
      case "valueString":
        return {
          valueString: value
        };
  
      default:
        return this.setFallbackQuantityValue();
    }
  }

  getValueType(vitalType) {
    const vitalTypeConfig = {
      hbA1cPercentage: "valueQuantity",
      urineProtein: "valueCodeableConcept",
      urineKetones: "valueCodeableConcept",
      eyeExamination: "valueString",
      footExamination: "valueString",
      others: "valueString"
    };
  
    return vitalTypeConfig[vitalType] || "fallback";
  }

  buildValueQuantity(vitalType, value) {
    let unit = null;
    
    if(vitalType == "hbA1cPercentage") {
      unit = "%";
    }
    else {
      unit = this.observationObj.unit
    }
  
    return {
      value,
      unit,
      system: "http://unitsofmeasure.org"
    };
  }

  setFallbackQuantityValue() {
    if (this.observationObj.value && this.observationObj.unit) {
      return {
        valueQuantity: {
          value: this.observationObj.value,
          unit: this.observationObj.unit,
          system: "http://unitsofmeasure.org"
        }
      };
    } else {
      const fallbackValue = this.observationObj[this.vitalType];
      return {
        valueString: fallbackValue
      };
    }
  }

  getJsonToFhirTranslator() {
    this.setCommonVitalsStructure();
    this.setEncounterReference();
    this.setCode();
    this.setComponent();
    this.setPatientReference();
    this.setPractitionerReference();
  }

  getFHIRToTransformedResult() {
    this.getComponent();
  }
}
module.exports = VitalObservation;
