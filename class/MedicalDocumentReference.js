const BaseDocumentReference = require('./BaseDocumentReference');

class MedicalDocumentReference extends BaseDocumentReference {
    
  getFHIRToTransformedResult() {
    this.documentObj.medicalDocumentFhirId = this.fhirResource.id;
    this.documentObj.medicalDocumentUuid = this.fhirResource?.identifier?.[0]?.value;
    this.documentObj.note = this.fhirResource?.description || "";
    this.documentObj.filename = this.fhirResource?.content?.[0]?.attachment?.title || "";
    return this.documentObj;
  }
}

module.exports = MedicalDocumentReference;
