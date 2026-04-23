const { v4: uuidv4 } = require("uuid");

class ScreeningSite {

    constructor(body, fhirResource = {}) {
        this.body = body || {};
        this.fhirResource = fhirResource;

        this.fhirResource.resourceType = "Location";
    }

    setBasicDetails() {
        this.fhirResource.status = "active";

        if (this.body.name) {
            this.fhirResource.name = this.body.name;
        }

        return this;
    }

    setType() {
        this.fhirResource.type = [
            {
                coding: [
                    {
                        system: "http://heartcare.vu/location-type",
                        code: "SCREENING_SITE"
                    }
                ]
            }
        ];

        return this;
    }

    setServiceModeExtension() {
        this.fhirResource.extension = this.fhirResource.extension || [];

        this.fhirResource.extension.push({
            url: "http://heartcare.vu/StructureDefinition/service-mode",
            valueCodeableConcept: {
                coding: [
                    {
                        system: "http://heartcare.vu/service-mode",
                        code: this.body.serviceMode
                    }
                ]
            }
        });

        return this;
    }

    setCampaignPeriodExtension() {
        this.fhirResource.extension = this.fhirResource.extension || [];

        this.fhirResource.extension.push({
            url: "http://heartcare.vu/StructureDefinition/campaign-period",
            valuePeriod: {
                start: this.body.startDate,
                end: this.body.endDate
            }
        });

        return this;
    }

    setLocationDetails() {
        if (this.body.location?.type === "FREE_TEXT") {
            this.fhirResource.address = {
                text: this.body.location.value
            };
        }

        if (this.body.location?.type === "AREA_COUNCIL") {
            this.fhirResource.partOf = {
                reference: `Location/${this.body.location.value}`
            };
        }

        return this;
    }

    setIdentifier() {
        this.fhirResource.identifier = this.fhirResource.identifier || [];

        this.fhirResource.identifier.push({
            system: "http://heartcare.vu/screening-site",
            value: this.body.uuid || uuidv4()
        });

        return this;
    }

    setMeta() {
        this.fhirResource.meta = {
            lastUpdated: new Date().toISOString()
        };

        return this;
    }

    build() {
        return this.fhirResource;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    getJsonToFhirTranslator() {
        this.setBasicDetails();
        this.setType();
        this.setServiceModeExtension();
        this.setCampaignPeriodExtension();
        this.setLocationDetails();
        this.setIdentifier();
        this.setMeta();

        return this.fhirResource;
    }

    getFHIRToTransformedResult() {
        return {
            id: this.fhirResource.id,
            name: this.fhirResource.name,
            serviceMode: this.getServiceMode(),
            startDate: this.getStartDate(),
            endDate: this.getEndDate(),
            location: this.getLocation()
        };
    }

    getServiceMode() {
        const ext = this.fhirResource.extension?.find(
            e => e.url.includes("service-mode")
        );

        return ext?.valueCodeableConcept?.coding?.[0]?.code || null;
    }

    getStartDate() {
        const ext = this.fhirResource.extension?.find(
            e => e.url.includes("campaign-period")
        );

        return ext?.valuePeriod?.start || null;
    }

    getEndDate() {
        const ext = this.fhirResource.extension?.find(
            e => e.url.includes("campaign-period")
        );

        return ext?.valuePeriod?.end || null;
    }

    getLocation() {
        if (this.fhirResource.address?.text) {
            return {
                type: "FREE_TEXT",
                value: this.fhirResource.address.text
            };
        }

        if (this.fhirResource.partOf?.reference) {
            const match = this.fhirResource.partOf.reference.match(/Location\/(.+)/);
            if (match) {
                return {
                    type: "AREA_COUNCIL",
                    value: match[1]
                };
            }
        }

        return null;
    }
}

module.exports = ScreeningSite;