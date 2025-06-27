const config = require("../config/nodeConfig");

class BaseDocumentReference {
    constructor(documentObj, fhirResource) {
      this.documentObj = documentObj;
      this.fhirResource = fhirResource;
      this.fhirResource.resourceType = "DocumentReference"
    }
  
    setBasicStructure() {
      this.fhirResource.id = this.documentObj.uuid;
      this.fhirResource.resourceType = "DocumentReference";
      this.fhirResource.status = "current";
      this.fhirResource.content = [];
      this.fhirResource.description = "";
      this.fhirResource.identifier = [];
      this.fhirResource.subject = {};
      this.fhirResource.context = { encounter: [] };
    }
  
    setDocumentContent() {
      this.fhirResource.content.push({
        attachment: {
          url: `${config.facadeUrl}/uploads/${this.documentObj.filename}`,
          title: this.documentObj.filename
        }
      });
    }
  
    setNote() {
      if (this.documentObj.note) {
        this.fhirResource.description = this.documentObj.note;
      }
    }
  
    setIdentifier() {
      this.fhirResource.identifier.push({
        system: config.snUrl,
        value: this.documentObj.uuid
      });
    }
  
    setSubject() {
      if (this.documentObj.patientId) {
        this.fhirResource.subject.reference = "Patient/" + this.documentObj.patientId;
      }
    }
  
    setContext() {
      if (this.documentObj.encounterUuid) {
        this.fhirResource.context.encounter.push({
          reference: "urn:uuid:" + this.documentObj.encounterUuid
        });
      }
    }
  
    getJsonToFhirTranslator() {
      this.setBasicStructure();
      this.setIdentifier();
      this.setDocumentContent();
      this.setNote();
      this.setContext();
      this.setSubject();
    }
  
    getFHIRResource() {
      return this.fhirResource;
    }
  
    patchDocumentContent() {
      this.fhirResource.content = [];
      this.setDocumentContent();
    }
  
    setPatchData() {
      this.setNote();
      this.patchDocumentContent();
      return this.fhirResource;
    }
  
    deleteDocument() {
      this.fhirResource.status = "entered-in-error";
      return this.fhirResource;
    }
  
    getSimplifiedOutput() {
      return this.documentObj;
    }
  
    // Default transformer (can be overridden)
    getFHIRToTransformedResult() {
      this.documentObj.documentFhirId = this.fhirResource.id;
      this.documentObj.documentUuid = this.fhirResource?.identifier?.[0]?.value;
      this.documentObj.note = this.fhirResource?.description || "";
      return this.documentObj;
    }
  }

  module.exports = BaseDocumentReference;
  