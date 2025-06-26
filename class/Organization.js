let { checkEmptyData } = require("../services/CheckEmpty");
let idFunction = require("../utils/setGetIdentifier");
const config = require("../config/nodeConfig");

class Organization {
    orgObj;
    fhirResource;
    constructor(orgObj, fhirResource) {
        this.orgObj = orgObj;
        this.fhirResource = fhirResource;
        this.fhirResource.resourceType = "Organization"
    }

    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.name = [];
        this.fhirResource.type = [];
        this.fhirResource.telecom = [];
        this.fhirResource.address = [];
        this.fhirResource.partOf = {};
    }

    setIdAsIdentifier() {
        if(this.orgObj.identifier) {
            for (let identifier of this.orgObj.identifier) {
                let data = idFunction.setIdAsIdentifier(identifier, "MR");
                this.fhirResource.identifier.push(data);
            }

        }
      
    }

    setOrgType() {
        let orgType = this.orgObj.orgType;
        if (!checkEmptyData(orgType)) {
            this.fhirResource.type.push({
                coding: [
                    {
                        "system": config.orgType,
                        "code": orgType,
                    }
                ]
            })
        }
    }

    getOrgType() {
        if (!checkEmptyData(this.fhirResource.type) && this.fhirResource.type.length > 0) {
            this.orgObj.orgType = this.fhirResource.type[0].coding[0].code;
        }
    }

    patchOrgType(fetchedData) {
        let isEmpty = checkEmptyData(fetchedData.type);
        if (!checkEmptyData(this.orgObj.type) && !isEmpty) {
            this.fhirResource.push({ "op": this.orgObj.orgtype.operation, "path": "/type/0/coding/0", "value": this.orgObj.orgType.value });
        }
    }

    setOrgName() {
        let orgName = this.orgObj.orgName;
        if (!checkEmptyData(orgName)) {
            this.fhirResource.name = orgName;
        }

    }

    patchOrgName(fetchedData) {
        let isEmpty = checkEmptyData(fetchedData.name);
        if (!checkEmptyData(this.orgObj.orgName) && !isEmpty) {
            this.fhirResource.push({ "op": this.orgObj.orgName.operation, "path": "/name", "value": this.orgObj.orgName.value });
        }
    }

    getOrgName() {
        if (this.fhirResource.name && !checkEmptyData(this.fhirResource.name)) {
            this.orgObj.orgName = this.fhirResource.name;
        }
    }

  
    getId() {
        this.orgObj.orgId = this.fhirResource.id
    }

    setIdentifierJSON(element) {
        let jsonObj = {}
        if (!checkEmptyData(element.code)) {
            jsonObj = {
                type: {
                    "coding": [{
                        system: config.fhirCodeUrl,
                        code: element.code
                    }]
                },
                system: element.identifierType,
                value: element.identifierNumber,

            }
        }
        else {
            jsonObj = { value: element.identifierNumber, system: element.identifierType }
        }
        return jsonObj;
    }

    setIdentifier() {
        if (!checkEmptyData(this.orgObj.identifier) && this.orgObj.identifier.length > 0) {
            this.orgObj.identifier.forEach(element => {
                let jsonObj = this.setIdentifierJSON(element);
                this.fhirResource.identifier.push(jsonObj)
            });
        }
    }

    patchIdentifier(fetchedData) {
        if (this.orgObj.identifier && this.orgObj.identifier.length > 0) {
            // sort by first allowing replace, then remove then add to maintain the index of data to be replaced or removed 
            let sortedArray = this.orgObj.identifier.sort((a, b) =>  (b.operation > a.operation) ? 1 : ((a.operation > b.operation ) ? -1 : 0));
            sortedArray.forEach(element => {
                let index = 0;
                index = fetchedData.identifier.findIndex(idCard => idCard.system == element.value.identifierType);
                index = index == -1 ? 0 : index;
                let path =  "/identifier/" + index;
                let jsonObj = this.setIdentifierJSON(element.value);
                this.fhirResource.push(
                    { "op": element.operation, "path": path, "value": jsonObj });
            })
        }
    }

    getIdentifier() {
        if(this.fhirResource.identifier) {
            let data = idFunction.getIdentifier(this.fhirResource, "MR");
            this.orgObj.id = data.id;
            this.orgObj.identifier = data.identifier;
        }

    }

   

    setActive() {
        if (!checkEmptyData(this.orgObj.active)) {
            this.fhirResource.active = true;
        }
    }

    patchActive() {
        if (!checkEmptyData(this.orgObj.active))
            this.fhirResource.push({ "op": this.orgObj.active.operation, "path": "/active", "value": this.orgObj.active.value })
    }

    getActive() {
        if (!checkEmptyData(this.fhirResource.active)) {
            this.orgObj.active = this.fhirResource.active
        }
    }

    
    setEmailAddress() {
        if (!checkEmptyData(this.orgObj.email)) {
            this.fhirResource.telecom.push({
                system: "email",
                value: this.orgObj.email
            });
        }
    }

    patchTelecom(fetchedData) {
        let json = {}
        if(!fetchedData.telecom){
            let telecomValue = [];
                json = {"op": "add", "path": "/telecom", value: [{}]}
            if(this.orgObj.contactNumber)
                telecomValue.push({"system": "phone", "value": this.orgObj.contactNumber.value});
            if(this.orgObj.email)
                telecomValue.push({"system": "email", "value": this.orgObj.email.value});
            this.fhirResource.push({"op": "add", "path": "/telecom", "value": telecomValue});
        }
        else {
            let phoneIndex = fetchedData.telecom.findIndex(e => e.system == "phone");
            let emailIndex = fetchedData.telecom.findIndex(e => e.system == "email");
            if(phoneIndex != -1 && this.orgObj.contactNumber) {  
                let operation = this.orgObj.contactNumber.operation == "remove" ? "replace": this.orgObj.contactNumber.operation;
                json = {"op": operation, "path": "/telecom/"+phoneIndex+ "/value", value: this.orgObj.contactNumber.operation == "remove" ? null : this.orgObj.contactNumber.value};   
                this.fhirResource.push(json);
            }
            else if(phoneIndex == -1 && this.orgObj.contactNumber) {
                json = {"op": "add", "path": "/telecom/"+fetchedData.telecom.length, value: {"system": "phone", "value": this.orgObj.contactNumber.value}}; 
                this.fhirResource.push(json);
            }
            if(emailIndex != -1 && this.orgObj.email) {
                let operation = this.orgObj.email.operation == "remove" ? "replace": this.orgObj.email.operation
                json = {"op": operation, "path": "/telecom/"+emailIndex+ "/value", value: this.orgObj.email.operation == "remove" ? null : this.orgObj.email.value};   
                this.fhirResource.push(json)
            }
            else if(emailIndex == -1 && this.orgObj.email) {
                this.fhirResource.push({"op": "add", "path": "/telecom/"+fetchedData.telecom.length, "value": {"system": "email", "value": this.orgObj.email.value}});
            }
        }

    }

    getEmailAddress() {
        if (!checkEmptyData(this.fhirResource.telecom)) {
            let index = this.fhirResource.telecom.findIndex(e => e.system == "email")
            if (index > -1) {
                this.orgObj.email = this.fhirResource.telecom[index].value
            }
        }

    }


    setPhone() {
        if (!checkEmptyData(this.orgObj.contactNumber)) {
            this.fhirResource.telecom.push({
                system: "phone",
                value: this.orgObj.contactNumber,
                rank: 1
            });
        }
    }

    getPhone() {
        if (this.fhirResource.telecom) {
            let index = this.fhirResource.telecom.findIndex(e => e.system == "phone");
            if (index > -1) {
                this.orgObj.contactNumber = this.fhirResource.telecom[index].value
            }
            else {
                this.orgObj.contactNumber = null 
            }
        }
        else {
            this.orgObj.contactNumber = null
        }
    }

    setAddress(type) {
        let addressType = "address";
        if (this.orgObj[addressType] && Object.keys(this.orgObj[addressType]).length > 0) {
            let line = [this.orgObj[addressType].addressLine1];
            if (!checkEmptyData(this.orgObj[addressType].addressLine2)) {
                line.push(this.orgObj[addressType].addressLine2)
            }
            this.fhirResource.address.push({
                use: type,
                line: line,
                city: this.orgObj[addressType].city,
                district: this.orgObj[addressType].district,
                state: this.orgObj[addressType].state,
                postalCode: this.orgObj[addressType].postalCode,
                country: this.orgObj[addressType].country
            })
        }
    }

    addAddress() {
        let address = [];
        if(this.orgObj.address)
            address.push({
                use: "home", line: [this.orgObj[address].value.addressLine1, this.orgObj[address].value.addressLine2], city: this.orgObj[address].value.city, district: this.orgObj[address].value.district, state: this.orgObj[address].value.state, postalCode: this.orgObj[address].value.postalCode, country: this.orgObj[address].value.country
            })

        this.fhirResource.push({"op": "add", "path": "/address", value: address})
    }

    patchAddress(type, fetchedResourceData) {
        let addressType = "address";
        let index = fetchedResourceData.address.findIndex(e => e.use == type);
        let operation = this.orgObj[addressType].operation == "remove" ? "replace" : (index == -1 ? "add" : "replace");
        index = index == -1 ? fetchedResourceData.address.length : index;
        if (Object.keys(this.orgObj[addressType].value).length > 0) {
            let line = [this.orgObj[addressType].value.addressLine1];
            if (!checkEmptyData(this.orgObj[addressType].value.addressLine2)) {
                line.push(this.orgObj[addressType].value.addressLine2)
            }
            let jsonData = {
                use: type,
                line: line,
                city: this.orgObj[addressType].value.city,
                district: this.orgObj[addressType].value.district,
                state: this.orgObj[addressType].value.state,
                postalCode: this.orgObj[addressType].value.postalCode,
                country: this.orgObj[addressType].value.country
            };
            if(this.orgObj[addressType].operation == "remove") {
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


    getAddress() {
        if (this.fhirResource.address && this.fhirResource.address.length > 0) {
            let length = this.fhirResource.address.length;
            for (let i = 0; i < length; i++) {
                let addressType = "address" ;
                this.orgObj[addressType] = {                   
                    city: this.fhirResource.address[i].city,
                    state: this.fhirResource.address[i].state,
                    postalCode: this.fhirResource.address[i].postalCode,
                    country: this.fhirResource.address[i].country
                }
                if(this.fhirResource.address[i].district) {
                    this.orgObj[addressType].district = this.fhirResource.address[i].district
                }
                if (this.fhirResource.address[i].line) {
                    this.orgObj[addressType].addressLine1 = this.fhirResource.address[i].line[0];
                    this.orgObj[addressType].addressLine2 = !this.fhirResource.address[i].line[1] ? null : this.fhirResource.address[i].line[1];
                }

            }
        }
    }


    getFHIRResource() {
        return this.fhirResource;
    }

    getSimplifiedOutput() {
        return this.orgObj;
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure()
        this.setIdAsIdentifier();
        this.setOrgType();
        this.setOrgName();
        this.setIdentifier();
        this.setActive();
        this.setPhone();
        this.setEmailAddress();
        this.setAddress("work");
    }
    

    getFHIRToTransformedResult() {
        this.getId();
        this.getOrgName();
        this.getIdentifier();
        this.getOrgType();
        this.getActive();
        this.getPhone();
        this.getEmailAddress();
        this.getAddress();
    }

    patchUserInputToFHIR(fetchedResourceData) {
        this.patchOrgName(fetchedResourceData);
        this.patchIdentifier(fetchedResourceData);
        this.patchOrgType(fetchedResourceData);
        this.patchActive();
        if(this.orgObj.contactNumber || this.orgObj.email)
            this.patchTelecom(fetchedResourceData);
        if(!fetchedResourceData.address) {
            this.addAddress();
        }        
        if (this.orgObj["address"] !== undefined && fetchedResourceData.address)
            this.patchAddress("work", fetchedResourceData);

    }
}


module.exports = Organization;
