let { checkEmptyData } = require("../services/CheckEmpty");
const config = require("../config/nodeConfig");

class Person {
    personObj;
    fhirResource;
    token;
    constructor(personObj, fhirResource) {
        this.personObj = personObj;
        this.fhirResource = fhirResource;
        this.fhirResource.resourceType = "Person"
        console.info("=================------------->", this.fhirResource)
    }

    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.name = [];
        this.fhirResource.link = [];
        this.fhirResource.telecom = [];
        this.fhirResource.address = [];
        this.fhirResource.managingOrganization = {};
        this.fhirResource.generalPractitioner = [];
        this.fhirResource.contact = [];
    }


    setIdAsIdentifier() {
        if (this.personObj.id) {
            let jsonObj = this.setIdentifierJSON({
                "identifierType": "https://www.thelattice.in/",
                "identifierNumber": this.personObj.id,
                "code": "MR"
            })
            this.fhirResource.identifier.push(jsonObj)
        }
    }

    setFirstName() {
        let firstName = this.personObj.firstName;
        if (!checkEmptyData(firstName)) {
            let length = this.fhirResource.name.length
            this.fhirResource.name[length] = {};
            this.fhirResource.name[length].given = [];
            this.fhirResource.name[length].given.push(firstName);
        }

    }

    patchFirstName(fetchedData) {
        let isEmpty = checkEmptyData(fetchedData.name);
        if (!checkEmptyData(this.personObj.firstName) && !isEmpty) {
            this.fhirResource.push({ "op": this.personObj.firstName.operation, "path": "/name/0/given/0", "value": this.personObj.firstName.value });
        }
    }

    getFirstName() {
        if (this.fhirResource.name && !checkEmptyData(this.fhirResource.name[this.fhirResource.name.length - 1].given[0])) {
            this.personObj.firstName = this.fhirResource.name[this.fhirResource.name.length - 1].given[0]
        }
    }

    setLastName() {
        let lastName = this.personObj.lastName;
        if (!checkEmptyData(lastName)) {
            let length = this.fhirResource.name.length > 0 ? this.fhirResource.name.length - 1 : 0;
            this.fhirResource.name[length].family = lastName;
        }

    }

    patchLastName(fetchedData) {
        let isEmpty = checkEmptyData(fetchedData.name);
        if (!checkEmptyData(this.personObj.lastName) && !isEmpty)
            this.fhirResource.push({ "op": this.personObj.lastName.operation, "path": "/name/0/family", "value": this.personObj.lastName.value })
    }

    getLastName() {
        if (this.fhirResource.name && !checkEmptyData(this.fhirResource.name[this.fhirResource.name.length - 1].family)) {
            this.personObj.lastName = this.fhirResource.name[this.fhirResource.name.length - 1].family
        }
    }

    setMiddleName() {
        if (!checkEmptyData(this.personObj.middleName)) {
            let length = this.fhirResource.name.length;
            this.fhirResource.name[length - 1].given.push(this.personObj.middleName);
        }

    }

    patchMiddleName(fetchedData) {
        let isEmpty = checkEmptyData(fetchedData.name);
        if (!checkEmptyData(this.personObj.middleName) && !isEmpty)
            this.fhirResource.push({ "op": this.personObj.middleName.operation, "path": "/name/0/given/1", "value": this.personObj.middleName.value })
    }


    getMiddleName() {
        if (this.fhirResource.name && !checkEmptyData(this.fhirResource.name[this.fhirResource.name.length - 1].given[1])) {
            this.personObj.middleName = this.fhirResource.name[this.fhirResource.name.length - 1].given[1];
        }
    }

    getId() {
        this.personObj.fhirId = this.fhirResource.id
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
        if (!checkEmptyData(this.personObj.identifier) && this.personObj.identifier.length > 0) {
            this.personObj.identifier.forEach(element => {
                let jsonObj = this.setIdentifierJSON(element);
                this.fhirResource.identifier.push(jsonObj)
            });
        }
    }

    patchIdentifier(fetchedData) {
        if (this.personObj.identifier && this.personObj.identifier.length > 0) {
            // sort by first allowing replace, then remove then add to maintain the index of data to be replaced or removed 
            let sortedArray = this.personObj.identifier.sort((a, b) =>  (b.operation > a.operation) ? 1 : ((a.operation > b.operation ) ? -1 : 0));
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
        if (this.fhirResource.identifier && this.fhirResource.identifier.length > 0) {
            this.personObj.identifier = [];
            this.fhirResource.identifier.forEach(element => {
                this.personObj.identifier.push({
                    identifierType: element.system,
                    identifierNumber: element.value,
                    code: element.type ? element.type.coding[0].code : null
                })
                this.personObj.id = element.type && element.type.coding[0].code == "MR" ? element.value : this.personObj.id;
            });

        }
    }

    setGender() {
        if (!checkEmptyData(this.personObj.gender)) {
            this.fhirResource.gender = this.personObj.gender
        }
    }

    patchGender() {
        if (!checkEmptyData(this.personObj.gender))
            this.fhirResource.push({ "op": this.personObj.gender.operation, "path": "/gender", "value": this.personObj.gender.value })
    }

    getGender() {
        if (!checkEmptyData(this.fhirResource.gender)) {
            this.personObj.gender = this.fhirResource.gender
        }
    }

    setActive() {
        if (!checkEmptyData(this.personObj.active)) {
            this.fhirResource.active = this.personObj.active
        }
    }

    patchActive() {
        if (!checkEmptyData(this.personObj.active))
            this.fhirResource.push({ "op": this.personObj.active.operation, "path": "/active", "value": this.personObj.active.value },
                {"op": "add", path: "/extension", value: [
                    {
                        "url": "http://example.org/fhir/StructureDefinition/patient-deletion-reason",
                        "valueCodeableConcept": {
                            "text": this.personObj.active.deletedReason
                        }
                        
                    }
                ]})
    }

    getActive() {
        if (!checkEmptyData(this.fhirResource.active)) {
            this.personObj.active = this.fhirResource.active
        }
    }

    setBirthDate() {
        if (!checkEmptyData(this.personObj.birthDate)) {
            this.fhirResource.birthDate = this.personObj.birthDate
        }
    }

    patchBirthDate() {
        if (!checkEmptyData(this.personObj.birthDate))
            this.fhirResource.push({ "op": this.personObj.birthDate.operation, "path": "/birthDate", "value": this.personObj.birthDate.value })
    }

    getBirthDate() {
        if (!checkEmptyData(this.fhirResource.birthDate)) {
            this.personObj.birthDate = this.fhirResource.birthDate
        }
    }

    setEmailAddress() {
        if (!checkEmptyData(this.personObj.email)) {
            this.fhirResource.telecom.push({
                system: "email",
                value: this.personObj.email
            });
        }
    }

    patchTelecom(fetchedData) {
        let json = {}
        if(!fetchedData.telecom){
            let telecomValue = [];
            if(this.personObj.mobileNumber)
                telecomValue.push({"system": "phone", "value": this.personObj.mobileNumber.value});
            if(this.personObj.email)
                telecomValue.push({"system": "email", "value": this.personObj.email.value});
            this.fhirResource.push({"op": "add", "path": "/telecom", "value": telecomValue});
        }
        else {
            let phoneIndex = fetchedData.telecom.findIndex(e => e.system == "phone");
            let emailIndex = fetchedData.telecom.findIndex(e => e.system == "email");
            if(phoneIndex != -1 && this.personObj.mobileNumber) {  
                let operation = this.personObj.mobileNumber.operation == "remove" ? "replace": this.personObj.mobileNumber.operation;
                json = {"op": operation, "path": "/telecom/"+phoneIndex+ "/value", value: this.personObj.mobileNumber.operation == "remove" ? null : this.personObj.mobileNumber.value};   
                this.fhirResource.push(json);
            }
            else if(phoneIndex == -1 && this.personObj.mobileNumber) {
                json = {"op": "add", "path": "/telecom/"+fetchedData.telecom.length, value: {"system": "phone", "value": this.personObj.mobileNumber.value}}; 
                this.fhirResource.push(json);
            }
            if(emailIndex != -1 && this.personObj.email) {
                let operation = this.personObj.email.operation == "remove" ? "replace": this.personObj.email.operation
                json = {"op": operation, "path": "/telecom/"+emailIndex+ "/value", value: this.personObj.email.operation == "remove" ? null : this.personObj.email.value};   
                this.fhirResource.push(json)
            }
            else if(emailIndex == -1 && this.personObj.email) {
                this.fhirResource.push({"op": "add", "path": "/telecom/"+fetchedData.telecom.length, "value": {"system": "email", "value": this.personObj.email.value}});
            }
        }

    }

    getEmailAddress() {
        if (!checkEmptyData(this.fhirResource.telecom)) {
            let index = this.fhirResource.telecom.findIndex(e => e.system == "email")
            if (index > -1) {
                this.personObj.email = this.fhirResource.telecom[index].value
            }
        }

    }


    setPhone() {
        if (!checkEmptyData(this.personObj.mobileNumber)) {
            this.fhirResource.telecom.push({
                system: "phone",
                value: this.personObj.mobileNumber,
                rank: 1
            });
        }
    }

    getPhone() {
        if (this.fhirResource.telecom) {
            let index = this.fhirResource.telecom.findIndex(e => e.system == "phone");
            if (index > -1) {
                this.personObj.mobileNumber = this.fhirResource.telecom[index].value
            }
        }
    }

    setAddress(type) {
        let addressType = type == "home" ? "permanentAddress" : "tempAddress";
        if (this.personObj[addressType] && Object.keys(this.personObj[addressType]).length > 0) {
            let line = [this.personObj[addressType].addressLine1];
            if (!checkEmptyData(this.personObj[addressType].addressLine2)) {
                line.push(this.personObj[addressType].addressLine2)
            }
            this.fhirResource.address.push({
                use: type,
                line: line,
                city: this.personObj[addressType].city,
                district: this.personObj[addressType].district,
                state: this.personObj[addressType].state,
                postalCode: this.personObj[addressType].postalCode,
                country: this.personObj[addressType].country
            })
        }
    }

    addAddress() {
        let address = [];
        if(this.personObj.permanentAddress)
            address.push({
                use: "home", line: [this.personObj[permanentAddress].value.addressLine1, this.personObj[permanentAddress].value.addressLine2], city: this.personObj[permanentAddress].value.city, district: this.personObj[permanentAddress].value.district, state: this.personObj[permanentAddress].value.state, postalCode: this.personObj[permanentAddress].value.postalCode, country: this.personObj[permanentAddress].value.country
            })
        if(this.personObj.tempAddress)
        address.push({
            use: "temp", line: [this.personObj[tempAddress].value.addressLine1, this.personObj[tempAddress].value.addressLine2], city: this.personObj[tempAddress].value.city, district: this.personObj[tempAddress].value.district, state: this.personObj[tempAddress].value.state, postalCode: this.personObj[tempAddress].value.postalCode, country: this.personObj[tempAddress].value.country
        })

        this.fhirResource.push({"op": "add", "path": "/address", value: address})
    }

    patchAddress(type, fetchedResourceData) {
        let addressType = type == "home" ? "permanentAddress" : "tempAddress";
        let index = fetchedResourceData.address.findIndex(e => e.use == type);
        let operation = this.personObj[addressType].operation == "remove" ? "replace" : (index == -1 ? "add" : "replace");
        index = index == -1 ? fetchedResourceData.address.length : index;
        if (Object.keys(this.personObj[addressType].value).length > 0) {
            let line = [this.personObj[addressType].value.addressLine1];
            if (!checkEmptyData(this.personObj[addressType].value.addressLine2)) {
                line.push(this.personObj[addressType].value.addressLine2)
            }
            let jsonData = {
                use: type,
                line: line,
                city: this.personObj[addressType].value.city,
                district: this.personObj[addressType].value.district,
                state: this.personObj[addressType].value.state,
                postalCode: this.personObj[addressType].value.postalCode,
                country: this.personObj[addressType].value.country
            };
            if(this.personObj[addressType].operation == "remove") {
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
                let addressType = i == 0 ? "permanentAddress" : "tempAddress";
                this.personObj[addressType] = {
                   
                    city: this.fhirResource.address[i].city,
                    district: this.fhirResource.address[i].district,
                    state: this.fhirResource.address[i].state,
                    postalCode: this.fhirResource.address[i].postalCode,
                    country: this.fhirResource.address[i].country
                }
                if (this.fhirResource.address[i].line) {
                    this.personObj[addressType].addressLine1 = this.fhirResource.address[i].line[0];
                    this.personObj[addressType].addressLine2 = this.fhirResource.address[i].line[1];
                }

            }
        }
    }

    setLink() {
        this.fhirResource.link.push({
            "target": { "reference": "urn:uuid:" + this.personObj.patientId },
            "assurance": "level3"
        })
    }

    patchLink(index) {
        if (this.personObj.operation == "remove")
            this.fhirResource.push({ "op": this.personObj.operation, "path": "/link/" + index });
        else if (this.personObj.operation == "add")
            this.fhirResource.push({
                "op": this.personObj.operation, "path": "/link/1", value: this.personObj.value
            });
    }

    getManagingOrg(){
        if(!this.fhirResource.managingOrganization){
            this.personObj.managingOrganization = {
                reference : null
            }
        }
        else{
            this.personObj.managingOrganization = this.fhirResource.managingOrganization
        }
    }

    getGeneralPractitioner(){
        if(!this.fhirResource?.generalPractitioner){
            this.personObj.generalPractitioner = [];
        }
        else{
            this.personObj.generalPractitioner = this.fhirResource.generalPractitioner;
        }
    }

    setManagingOrg(){
        this.fhirResource.managingOrganization = {
            reference : "Organization/"+this.personObj.orgId
        }
    }

    setGeneralPractitioner(){
        this.fhirResource.generalPractitioner = [
            {
                reference: "Practitioner/"+this.personObj.userId
            }
        ];
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    getSimplifiedOutput() {
        return this.personObj;
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdAsIdentifier();
        this.setLink();
    }


    setPatchData(fetchedResourceData) {
        this.patchFirstName(fetchedResourceData);
        this.patchMiddleName(fetchedResourceData);
        this.patchLastName(fetchedResourceData);
        this.patchIdentifier(fetchedResourceData);
        this.patchActive();
        this.patchGender();
        this.patchBirthDate();
        if(this.personObj.mobileNumber || this.personObj.email)
            this.patchTelecom(fetchedResourceData);
        if(!fetchedResourceData.address) {
            this.addAddress();
        }        
        if (this.personObj["permanentAddress"] !== undefined && fetchedResourceData.address)
            this.patchAddress("home", fetchedResourceData);
        if (this.personObj["tempAddress"] !== undefined && fetchedResourceData.address)
            this.patchAddress("temp", fetchedResourceData);
    }
}


module.exports = Person;
