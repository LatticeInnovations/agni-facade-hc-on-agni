const BaseDocumentReference = require('./BaseDocumentReference');

class LabDocumentReference extends BaseDocumentReference {
  getFHIRToTransformedResult() {
    this.documentObj.labDocumentFhirId = this.fhirResource.id;
    this.documentObj.labDocumentUuid = this.fhirResource?.identifier?.[0]?.value;
    this.documentObj.note = this.fhirResource?.description || "";
    this.documentObj.filename = this.fhirResource?.content?.[0]?.attachment?.title || "";
    return this.documentObj;
  }
}

module.exports = LabDocumentReference;