let { checkEmptyData } = require("../services/CheckEmpty");
const Person = require("./person");

class Practitioner  extends Person{
    practitionerObj;
    fhirResource;
    reqType;

    constructor(practitioner_obj, fhir_resource) {
        super(practitioner_obj, fhir_resource);
        this.practitionerObj = practitioner_obj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Practitioner";
        console.info('practitioner data: ', practitioner_obj)

    }


     setWorkAddress(type) {
        let addressType = "address";
        if (this.practitionerObj[addressType] && Object.keys(this.practitionerObj[addressType]).length > 0) {
            let line = [this.practitionerObj[addressType].addressLine1];
            if (!checkEmptyData(this.practitionerObj[addressType].addressLine2)) {
                line.push(this.practitionerObj[addressType].addressLine2)
            }
            this.fhirResource.address.push({
                use: type,
                line: line,
                city: this.practitionerObj[addressType].city,
                district: this.practitionerObj[addressType].district,
                state: this.practitionerObj[addressType].state,
                postalCode: this.practitionerObj[addressType].postalCode,
                country: this.practitionerObj[addressType].country
            })
        }
    }

    addWorkAddress() {
        let address = [];
        if(this.practitionerObj.address)
            address.push({
                use: "home", line: [this.practitionerObj[address].value.addressLine1, this.practitionerObj[address].value.addressLine2], city: this.practitionerObj[address].value.city, district: this.practitionerObj[address].value.district, state: this.practitionerObj[address].value.state, postalCode: this.practitionerObj[address].value.postalCode, country: this.practitionerObj[address].value.country
            })

        this.fhirResource.push({"op": "add", "path": "/address", value: address})
    }

    patchWorkAddress(type, fetchedResourceData) {
        let addressType = "address";
        let index = fetchedResourceData.address.findIndex(e => e.use == type);
        let operation = this.practitionerObj[addressType].operation == "remove" ? "replace" : (index == -1 ? "add" : "replace");
        index = index == -1 ? fetchedResourceData.address.length : index;
        if (Object.keys(this.practitionerObj[addressType].value).length > 0) {
            let line = [this.practitionerObj[addressType].value.addressLine1];
            if (!checkEmptyData(this.practitionerObj[addressType].value.addressLine2)) {
                line.push(this.practitionerObj[addressType].value.addressLine2)
            }
            let jsonData = {
                use: type,
                line: line,
                city: this.practitionerObj[addressType].value.city,
                district: this.practitionerObj[addressType].value.district,
                state: this.practitionerObj[addressType].value.state,
                postalCode: this.practitionerObj[addressType].value.postalCode,
                country: this.practitionerObj[addressType].value.country
            };
            if(this.practitionerObj[addressType].operation == "remove") {
                jsonData = {
                    use: type,
                    line: null,
                    city: null,
                    district: null,
                    state: null,
                    postalCode: null,
                    country: null
                }
            }
            this.fhirResource.push({
                "op": operation, "path": "/address/" + index, "value": jsonData

            })
        }
    }


    getWorkAddress() {
        if (this.fhirResource.address && this.fhirResource.address.length > 0) {
            let length = this.fhirResource.address.length;
            for (let i = 0; i < length; i++) {
                let addressType = "address" ;
                this.practitionerObj[addressType] = {                   
                    city: this.fhirResource.address[i].city,
                    state: this.fhirResource.address[i].state,
                    postalCode: this.fhirResource.address[i].postalCode,
                    country: this.fhirResource.address[i].country
                }
                if(this.fhirResource.address[i].district) {
                    this.practitionerObj[addressType].district = this.fhirResource.address[i].district
                }
                if (this.fhirResource.address[i].line) {
                    this.practitionerObj[addressType].addressLine1 = this.fhirResource.address[i].line[0];
                    this.practitionerObj[addressType].addressLine2 = !this.fhirResource.address[i].line[1] ? null : this.fhirResource.address[i].line[1];
                }

            }
        }
    }


    getFHIRResource() {
        return this.fhirResource;
    }

    getSimplifiedOutput() {
        return this.practitionerObj;
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setFirstName();
        this.setMiddleName();
        this.setLastName();
        this.setActive();
        this.setGender();
        this.setBirthDate();
        this.setPhone();
        this.setEmailAddress();
        this.setWorkAddress("work");

    }

    getFHIRToTransformedResult() {
        this.getId();
        this.getFirstName();
        this.getMiddleName();
        this.getLastName();
        this.getIdentifier();
        this.getActive();
        this.getGender();
        this.getBirthDate();
        this.getPhone();
        this.getEmailAddress();
        this.getWorkAddress();
    }

    patchUserInputToFHIR(fetchedResourceData) {
        this.patchFirstName(fetchedResourceData);
        this.patchMiddleName(fetchedResourceData);
        this.patchLastName(fetchedResourceData);
        this.patchIdentifier(fetchedResourceData);
        this.patchActive();
        this.patchGender();
        if(this.personObj.mobileNumber || this.personObj.email)
            this.patchTelecom(fetchedResourceData);
        if(!fetchedResourceData.address) {
            this.addWorkAddress();
        }        
        if (this.practitionerObj["address"] !== undefined && fetchedResourceData.address)
            this.patchWorkAddress("work", fetchedResourceData);

    }
}


module.exports = Practitioner;