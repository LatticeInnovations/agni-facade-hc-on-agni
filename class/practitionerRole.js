const roleJson = require("../utils/role.json");
class PractitionerRole {
    roleObj;
    fhirResource;

    constructor(location_obj, fhir_resource) {
        this.roleObj = location_obj;
        this.fhirResource = fhir_resource
    }

    setOrganizationReference() {
        if(this.roleObj.orgId)
            this.fhirResource.organization.reference = "Organization/"+this.roleObj.orgId;
    }

    getOrganizationRole() {
        let result = roleJson.find(a => a.code === this.fhirResource.code?.[0]?.coding?.[0]?.code || null);
            this.roleObj.role =  this.fhirResource?.code?.[0]?.coding?.[0]?.code || null;
            this.roleObj.role = result?.code || null;
    }
    setPractitionerReference() {
        this.fhirResource.practitioner.reference = "Practitioner/"+this.roleObj.userId;
    }

    setRole() {
        console.log("check role here: ", this.roleObj.role)
        let result = roleJson.find(a => a.code === this.roleObj.role);
        console.log("result: ", result)
        this.fhirResource.code.push({
            coding:  [

                {
                    "system" : result.system,
                    "code": result.code,
                }
            ]
        })
        console.log(this.fhirResource)
    }


    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setOrganizationReference();
        this.setPractitionerReference();
        this.setRole();
    }

    getFHIRToTransformedResult() {
        this.getOrganizationRole();
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
        this.fhirResource.organization = {};
        this.fhirResource.practitioner = {};
    }

}


module.exports = PractitionerRole;