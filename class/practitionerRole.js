const roleJson = require("../utils/role.json");
class PractitionerRole {
    roleObj;
    fhirResource;

    constructor(location_obj, fhir_resource) {
        this.roleObj = location_obj;
        this.fhirResource = fhir_resource
    }

    setOrganizationReference() {
        if (this.roleObj.orgId)
            this.fhirResource.organization.reference = "Organization/" + this.roleObj.orgId;
    }

    getOrganizationReference() {
        this.roleObj.orgId = this.fhirResource?.organization?.reference?.split("/")[1] || null
    }

    getOrganizationRole() {
        let result = roleJson.find(a => a.code === this.fhirResource.code?.[0]?.coding?.[0]?.code || null);
        this.roleObj.role = this.fhirResource?.code?.[0]?.coding?.[0]?.code || null;
        this.roleObj.role = result?.code || null;
    }
    setPractitionerReference() {
        this.fhirResource.practitioner.reference = "Practitioner/" + this.roleObj.userId;
    }

    setRoleId() {
        let result = roleJson.find(a => a.roleTypeId === parseInt(this.roleObj.roleId));
        if (result)
            this.fhirResource.code.push({
                coding: [

                    {
                        "system": result.system,
                        "code": result.code,
                    }
                ],
                "text": "userTypeId"
            })
    }

    setRoleGroupId() {
        if (this.roleObj.roleGroupId) {
            let result = roleJson.find(a => a.roleTypeId === parseInt(this.roleObj.roleGroupId));
            if (result)
                this.fhirResource.code.push({
                    coding: [

                        {
                            "system": result?.system,
                            "code": result.code,
                        }
                    ],
                    "text": "roleGroupTypeId"
                })
        }

    }

    getRole() {
        if (this.fhirResource.code) {
            const roleIndex = this.fhirResource.code.findIndex(e => e.text === "userTypeId");
            this.roleObj.role = this.fhirResource?.code?.[roleIndex]?.coding?.[0]?.code || null
        }
        else {
            this.roleObj.roleGroup = null;
        }

    }

    getRoleGroup() {
        if (this.fhirResource.code) {
            const roleGroupIndex = this.fhirResource.code.findIndex(e => e.text === "roleGroupTypeId");
            this.roleObj.roleGroup = this.fhirResource?.code?.[roleGroupIndex]?.coding?.[0]?.code || null
        }
        else {
            this.roleObj.roleGroup = null;
        }
    }
    setLocationReference(locationId) {
        this.fhirResource.location = [
            {
                reference: `urn:uuid:${locationId}` 
            }
        ];
    }

    setScreeningStaffRole() {
        this.fhirResource.code.push({
            coding: [
                {
                    system: "http://heartcare.vu/role-type",
                    code: "SCREENING_STAFF"
                }
            ]
        });
    }
    setLeaderFlag() {
        if (this.roleObj.isHead !== undefined) {
            this.fhirResource.extension = this.fhirResource.extension || [];

            this.fhirResource.extension.push({
                url: "http://heartcare.vu/StructureDefinition/is-leader",
                valueBoolean: this.roleObj.isHead
            });
        }
    }
    getLeaderFlag() {
        const ext = this.fhirResource.extension?.find(
            e => e.url === "http://heartcare.vu/StructureDefinition/is-leader"
        );

        this.roleObj.isHead = ext?.valueBoolean || false;
    }
    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setOrganizationReference();
        this.setPractitionerReference();
        this.setLocationReference(this.roleObj.locationId);
        this.setScreeningStaffRole();
        this.setLeaderFlag();
        this.setRoleId();
        this.setRoleGroupId();
    }

    getFHIRToTransformedResult() {
        this.getOrganizationReference();
        this.getRole();
        this.getRoleGroup();
        this.getLeaderFlag();
    }

    getFHIRResource() {
        return this.fhirResource;
    }
    getSimplifiedOutput() {
        return this.roleObj;
    }

    setBasicStructure() {
        this.fhirResource.resourceType = "PractitionerRole"
        this.fhirResource.code = [];
        this.fhirResource.active = true;
        this.fhirResource.organization = {};
        this.fhirResource.practitioner = {};
    }

}


module.exports = PractitionerRole;