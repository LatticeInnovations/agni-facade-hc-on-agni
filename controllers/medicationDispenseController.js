
const dispenseStatus = require("../utils/dispenseStatus.json");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const dispenseService = require("../services/medicationDispenseService");
const { fetchResource, handleError } = require("../services/helperFunctions");
const resType = "MedicationDispense";

const createdDispenseResources = async (req, existingMainEncountersList, token) => {
    try {
        let bundleResources = [...existingMainEncountersList]
        await Promise.all(req.body.map(async (reqData) => {
            reqData.practitionerId = req.decoded.userId;
            let statusData = dispenseStatus.find( (e) => e.statusId == reqData.status);
            if(existingMainEncountersList.length > 0 && reqData.prescriptionFhirId) {
              const mainEncounterIndex = existingMainEncountersList.findIndex(
                (e) => e.resource.partOf.reference.split("/")[1] === reqData.prescriptionFhirId
              );
              // console.log("main encounter index check :", mainEncounterIndex)
                // Update the status to "XXX"
              existingMainEncountersList[mainEncounterIndex].resource.status = statusData?.encounter;
              const mainEncounter = existingMainEncountersList[mainEncounterIndex]
              reqData.mainEnounterId = mainEncounter.resource.id ? "Encounter/" + mainEncounter.resource.id : "urn:uuid:" + mainEncounter.resource.identifier[0].value
              // console.info("check req data ==============> ", reqData)
              const newRecord = await dispenseService.addNewRecord(resType, reqData, token)
              console.log("new record: ", newRecord)
              bundleResources = [...bundleResources]
              bundleResources.push(...newRecord);
            }
            else {
              const newOTCRecord = await dispenseService.addOTCRecord(resType, reqData)
              console.log("check OTC ENTRY    =============================================")
              bundleResources.push(...newOTCRecord);
            }
          }));
          return bundleResources
    }
    catch(error) {
        console.error("createdDispenseResources Error :", error)
    }
}

//  Save prescription data
const saveMedicationDispense = async function (req, res) {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        const token = req.token.encodedToken;
        
        const prescriptionFhirIds = [ ...new Set(req.body.map(e=> e.prescriptionFhirId).filter(value => value !== undefined))];
        // fetch main encounter using appointment id
      const prescriptionEncounters = await fetchResource("Encounter", { "_id": prescriptionFhirIds.join(","), _count: 5000});  
      if(prescriptionEncounters.entry.length == 0) {
                return []
      }
     
      let existingMainEncountersList = await dispenseService.getMainEncountersForPrescription(req.body, token, prescriptionFhirIds)
      const resourceResult = await createdDispenseResources(req, existingMainEncountersList, token);
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            // let responseData = setMedicationDispenseResponse(req.body, response.data.entry, "post");
            const responseData = setMedicationDispenseResponse("post", response.data.entry, req.body, bundleData.bundle.entry)   
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
        }
        else {
             return  handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveMedicationDispense Error: ", error);
        return handleError(res, error)
    }

}

// map prescription a dn appointment encounter to main encounter
const mapMainEncountersToSubEncounter = async (mainEncounters, prescriptionEncounters, appointmentEncounter) => {
    try {
        return mainEncounters.map((mainEnc) => {
            const mappedPrescriptionEncounter = prescriptionEncounters.filter( e=> e.id == mainEnc.partOf.reference.split("/")[1])
          //   console.info("mappedPrescriptionEncounter: ", mappedPrescriptionEncounter);
            const mappedAppointmentEncounter = appointmentEncounter.filter( e => e.id == mappedPrescriptionEncounter[0].partOf.reference.split("/")[1]);
          //   console.info("mappedAppointmentEncounter: ", mappedAppointmentEncounter[0]);
            mainEnc.mappedPrescriptionEncounter = mappedPrescriptionEncounter[0]
            mainEnc.mappedAppointmentEncounter = mappedAppointmentEncounter[0];
            return mainEnc;
      })
    }
    catch(error){
        console.error("mapMainEncountersToSubEncounter Error: ", error)
        throw error;
    }
}

//  Get Practitioner data
let getMedicationDispense = async function (req, res) {
    try {
        const queryParams = {
            "type": "pharmacy-service",
            "_total": "accurate",
            "_count": 3000,
            "part-of": req.query.prescriptionId,
            subject: req.query.patientId
        }
        let resourceResult = []
        let responseData = await fetchResource("Encounter", queryParams);
        console.info("response data: ", responseData)
        let resStatus = 1;
        const token = req.token.encodedToken;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        let mainEncounters = responseData.entry.map(e => e.resource);

        // console.info("mainEncounters: ", mainEncounters)
        const mainEncounterFhirIds = mainEncounters.map((e) => e.id).join(",");
            
        const prescriptionEncounterIds = mainEncounters.map(e => e.partOf.reference.split("/")[1]);
        //  get prescription's encounter ids with which the dispense in linked
        //  get appointment encounter ids
        let appointmentEncounter = await fetchResource("Encounter", { _id: prescriptionEncounterIds.join(","), _include: "Encounter:part-of",  _count: 2000}, token)

        const prescriptionEncounters = appointmentEncounter.entry.filter(e => e.resource.type).map(enc => enc.resource)
        appointmentEncounter = appointmentEncounter.entry.filter(e => !e.resource.type).map(enc => enc.resource)
        // console.info("appointmentEncounter:", appointmentEncounter)
        // console.info("prescriptionEncounters:", prescriptionEncounters)
        mainEncounters = mainEncounters = await mapMainEncountersToSubEncounter(mainEncounters, prescriptionEncounters, appointmentEncounter);
        const medDispResources = await fetchResource("Encounter", { "part-of": mainEncounterFhirIds, type: "dispensing-encounter", _revinclude: "MedicationDispense:context:Encounter",  _count: 2000}, token);
        if(!medDispResources.entry) {
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        // Fetch medication list and sub encounter from main encounter
        const medDispenseWithEncounter = await dispenseService.fetchMedDispenseList(medDispResources.entry, mainEncounters, token)  
        // console.log("medDispenseWithEncounter ---------------------", medDispenseWithEncounter, "------------------------")
        resourceResult = await dispenseService.mapEncounterAndMedDispense(mainEncounters, medDispenseWithEncounter)
                     
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult})
        
    }
    catch (error) {
            console.error("getMedicationDispense Error: ", error);
            return handleError(res, error)
        }
    }

const setMedicationDispenseResponse = (reqMethod, responseData, reqInput,  reqBundleData) => {
  let filteredData = [];
  let response = [];
  responseData = bundleStructure.mapBundleService(reqBundleData, responseData);
//   console.log(  "responseData: ", responseData, "--------------------------------------------------" );
  filteredData = responseData.filter( (e) =>
      e.resource.resourceType == "Encounter" &&
      e.resource.type &&
      e.resource.type[0].coding[0].code == "dispensing-encounter"
  );
  let medDispenseData = responseData
    .filter((e) => e.resource.resourceType == "MedicationDispense")
    .map((e) => {
      return {
        medDispenseUuid: e.resource.identifier[0].value,
        medDispenseFhirId: e.response.location.substring(
          e.response.location.indexOf("/") + 1,
          e.response.location.indexOf("/_history")
        ),
      };
    });
  //  filtered data contains sub encounters for the date nad time capture
  filteredData = filteredData.map((subEnc) => {
    let dispenseData = reqInput.filter(
      (inp) => inp.dispenseId == subEnc.resource.identifier[0].value
    );
    // console.log("dispenseData: ", dispenseData);
    let medicineDispensedList = dispenseData[0].medicineDispensedList.map(
      (medDisp) => {
        const medDispenseIndex = medDispenseData.findIndex(
          (output) => medDisp.medDispenseUuid == output.medDispenseUuid
        );
        if (medDispenseIndex != -1) {
          return medDispenseData[medDispenseIndex];
        }
      }
    );
    // console.log("medicineDispensedList: ", medicineDispensedList);
    subEnc.medicineDispensedList = medicineDispensedList;
    return subEnc;
  });
//   console.log("filteredData ==========> ", filteredData);
  response = responseService.setDefaultResponse(
    "MedicationDispense",
    reqMethod,
    filteredData
  );
//   console.log("response ==========> ", response);
  response.forEach((res, i) => {
    res.medicineDispensedList = filteredData[i].medicineDispensedList || [];
  });

  return response;
};




module.exports = {
    saveMedicationDispense,
    getMedicationDispense
}