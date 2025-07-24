let { checkEmptyData } = require("../services/CheckEmpty");
const config = require("../config/nodeConfig");

function setIdAsIdentifier(obj, code) {
    let jsonObj = {};
    if(!obj.identifierType) {
        jsonObj = setIdentifierJSON({
            "identifierType": "https://www.thelattice.in/",
            "identifierNumber": obj.uuid ? obj.uuid : obj.id,
            "code": code || null
        });
    }
    else {
        jsonObj = setIdentifierJSON(obj);
    }


    return jsonObj;

}
function setIdentifierJSON(element) {
    let jsonObj = {}
    if (!checkEmptyData(element.code)) {
        jsonObj = {
            type: {
                "coding": [{
                    system: config.fhirCodeUrl,
                    code: element.code
                }]
            }
        }
    }
    jsonObj.system = element.identifierType;
    jsonObj.value = element.identifierNumber;
    return jsonObj;
}

function getIdentifier(fhirResource, code) {
    console.log("fhirResource.identifier: ", fhirResource.identifier)
    if (fhirResource.identifier && fhirResource.identifier.length > 0) {
        let identifier = []; let uuid = null;
        fhirResource.identifier.forEach(element => {
            identifier.push({
                identifierType: element.system,
                identifierNumber: element.value,
                code: element.type ? element.type.coding[0].code : null
            })
            uuid = element.type && element.type.coding[0].code == code ? element.value : null;
        });

        return { identifier, uuid };
    }
}

module.exports = { setIdAsIdentifier, getIdentifier }