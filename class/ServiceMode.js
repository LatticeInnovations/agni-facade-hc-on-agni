const { v4: uuidv4 } = require("uuid");
const { serviceModeSystemUrl, serviceModeUrl } = require("../utils/heartcareSystemUrl");

class ServiceMode {
    constructor(body, fhirResource = {}) {
        this.body = body || {};
        this.fhirResource = fhirResource;
        this.fhirResource.resourceType = "ActivityDefinition";
    }

    setBasicDetails() {

        this.fhirResource.status = this.mapStatus(this.body.status);

        if (this.body.name) {
            this.fhirResource.name = this.body.name;
            this.fhirResource.title = this.body.name;
        }

        if (this.body.description) {
            this.fhirResource.description = this.body.description;
        }

        this.fhirResource.kind = "ServiceRequest";

        return this;
    }

    setCode() {
        if (this.body.code) {
            this.fhirResource.code = {
                coding: [
                    {
                        system: serviceModeSystemUrl,
                        code: this.body.code,
                        display: this.body.name || this.body.code
                    }
                ]
            };
        }

        return this;
    }

    setIdentifier() {
        this.fhirResource.identifier = [
            {
                system: serviceModeSystemUrl,
                value: this.body.uuid || uuidv4()
            }
        ];

        return this;
    }

    setMeta() {
        this.fhirResource.meta = {
            profile: [serviceModeUrl],
            tag: [
                {
                    system: "http://example.org/resource-category",
                    code: "SERVICE_MODE",
                    display: "Service Mode Resource"
                }
            ]
        };
        return this;
    }

    mapStatus(status) {
        const statusMap = {
            ACTIVE: "active",
            INACTIVE: "retired",
        };

        return statusMap?.[status] || "retired"; 
    }
 
    build() {
        return this.fhirResource;
    }
    getFHIRResource() {
        return this.fhirResource;
    }
    getJsonToFhirTranslator() {
        this.setBasicDetails();
        this.setCode();
        this.setIdentifier();
        this.setMeta();
        return this.fhirResource;
    }
    getFHIRToTransformedResult() {
        return {
            uuid: this.fhirResource.identifier[0].value,
            name: this.fhirResource.name,
            description: this.fhirResource.description,
            status: this.fhirResource.status === "active" ? "ACTIVE" : "INACTIVE"
        };
    }

}

module.exports = ServiceMode;