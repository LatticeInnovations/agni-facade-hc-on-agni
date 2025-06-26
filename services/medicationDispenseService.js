
const MedicationDispense = require("../class/MedicationDispense");
const DispenseEncounter = require("../class/DispenseEncounter");
const Medication = require("../class/medication");
const MedicationRequest = require("../class/MedicationRequest");
const { v4: uuidv4 } = require("uuid");
let config = require("../config/nodeConfig");
const bundleStructure = require("./bundleOperation")
 
  // Fetch medicine dispense list with their sub encounters combined
  const fetchMedDispenseList = async function(medDispResources, mainEncounters, token) {
    try {
  
      let {medReqData, medicationData} = await getMedicationRequestAndMedication(medDispResources, token)
      //  filter sub encounter resource from fetched resources
      let subEncounters = medDispResources.filter(
        (res) => res.resource.resourceType == "Encounter"
      ).map(e => e.resource);
      subEncounters = subEncounters.map(element => {      
        if(mainEncounters.length > 0) {
          let primaryEncounter = mainEncounters.filter(e => e.id == element.partOf.reference.split("/")[1])
          element.appointmentId = primaryEncounter[0].mappedAppointmentEncounter.appointment[0].reference.split("/")[1]
          
        }
        else {
          element.appointmentId = null
        }
        return element
        
      })
      //  map sub encounter resources to their respective MedicationDispense resources
      const medDispenseWithEncounter = subEncounters.map((enc) => {
      let medDispenseRes = medDispResources.filter((md) => md.resource.resourceType == "MedicationDispense" && md.resource.context.reference.split("/")[1] == enc.id)
      .map((e) => {return e.resource});
      // map medicine and medicationRequest data with medicationDispense data
      medDispenseRes = medDispenseRes.map(medDisp => {
        let medReqIndex = -1 
        //  check if it's not OTC then it have medicationRequest reference
        if(medDisp.authorizingPrescription)
          medReqIndex = medReqData.findIndex(e => e.medReqFhirId == medDisp.authorizingPrescription[0].reference.split("/")[1])
        const medIndex = medicationData.findIndex(e => e.medFhirId == medDisp.medicationReference.reference.split("/")[1])
        if(medReqIndex != -1) {
          medDisp.prescriptionData = medReqData[medReqIndex]
        }
        else {
          medDisp.prescriptionData = {}
        }
        if(medIndex != -1) {
          medDisp.dispensedMedication = medicationData[medIndex]
        }
        return medDisp
      });
        return {
          subEncounter: enc, medDispenseRes: medDispenseRes
        };
      });    
      return medDispenseWithEncounter;
    } catch (e) {
      console.error(e);
      const err = { statusCode: 404, code: "ERR", message: "Data not found" };
      return Promise.reject(err);
    }
  
  }
  


const getMainEncountersForPrescription = async function(reqInput, token, prescriptionIds) {
    try {
      let existingMainEncountersList = []
      // console.info("prescriptionIds: ", prescriptionIds)
      if(prescriptionIds.length > 0) {
            // search existing main encounters
      const mainEncounterQuery = {
          "part-of": prescriptionIds.join(","),
          type: "pharmacy-service",
          _count: 1000,
        };
        const existingMainEncounters = await bundleStructure.searchData(
          config.baseUrl + "Encounter",
          mainEncounterQuery, token
        );
        // console.info("main encounters list: ", existingMainEncounters.data)
        
        if(existingMainEncounters.data.total > 0) {
          existingMainEncountersList = await Promise.all(existingMainEncounters?.data?.entry?.map(
            async (encounter) => {
              const mainEncounterResInBundle = await bundleStructure.setBundlePost(encounter.resource, encounter.resource.identifier, encounter.resource.id, "PUT", "identifier");  
              return mainEncounterResInBundle  
            }
          )) || [];
        }
      }
  
  
      if (existingMainEncountersList.length < prescriptionIds.length) {
        // Find the prescription Ids of main encounter that do not exist already
        const existingMainPrescriptionIds = new Set(
          existingMainEncountersList.map((e) => e.resource.partOf.reference.split("/")[1])
        );
        // console.info("existingMainPrescriptionIds: ", existingMainPrescriptionIds, "prescriptionIds: ", prescriptionIds)
        // filter non existing main encounters
        const leftMainEncounters = prescriptionIds.filter(
          (item) => !existingMainPrescriptionIds.has(item)
        );
        // console.info("check nonexisting", leftMainEncounters)
        // Create new main encounters concurrently using Promise.all
        let newEncounters = await Promise.all(
          leftMainEncounters.map(async (inputId) => {
              let input = reqInput.filter(e=> e.prescriptionFhirId == inputId)[0]
              input.mainEncounterUuid = uuidv4()
            const mainEncounterResource =  await getEncounterResource(input, {}, true);
            const mainEncounterResInBundle = await bundleStructure.setBundlePost(mainEncounterResource, mainEncounterResource.identifier, input.mainEncounterUuid, "POST", "identifier");  
            return mainEncounterResInBundle;
          }));
        // console.info("Check new Encounters: ", newEncounters)
        existingMainEncountersList.push(...newEncounters);
      }
      
  
  
      return existingMainEncountersList;
    } catch (e) {
      return Promise.reject(e);
    }
  }
  
  const mapEncounterAndMedDispense= async function(mainEncounters, medDispenseWithEncounter) {
    try {
      const medicationDispenseResult = await Promise.all(
        mainEncounters.map(async (mainEnc) => {
          // get main encounter object
          const mainEncounterObj = new DispenseEncounter({}, mainEnc, true).getFhirToJson();
          // get sub encounter
          let subEncounterWithMedDispenseObj = await Promise.all(
            medDispenseWithEncounter
              .filter(
                (e) => e.subEncounter.partOf.reference.split("/")[1] == mainEnc.id
              )
              .map(async (element) => {
                let { subEncounterObj,  medicineDispensedList } = await fetchSubEncounterWithMedDispenseUserOutput(element);  
                subEncounterObj.medicineDispensedList = medicineDispensedList         
                return subEncounterObj;
              })
          );
            // console.log("check RESULT ---------->", subEncounterWithMedDispenseObj, "---------------")    
            subEncounterWithMedDispenseObj = subEncounterWithMedDispenseObj.sort((a, b) => new Date(b.generatedOn) - new Date(a.generatedOn))
            mainEncounterObj.dispenseData = subEncounterWithMedDispenseObj
          return mainEncounterObj
        })
      );
      return medicationDispenseResult
    } catch (e) {
      return Promise.reject(e);
    }
  }
  
  const fetchSubEncounterWithMedDispenseUserOutput = async function(element) {
    try {
      const subEncounterObj = new DispenseEncounter({}, element.subEncounter, false).getFhirToJson();
      subEncounterObj.appointmentId = element.subEncounter.appointmentId
      // get dispense list included with medicationRequest data and medication data as well for a sub encounter
      const medDispenseObjects = element.medDispenseRes.map((medDispense) =>
  {         let medDispenseData = new MedicationDispense({}, medDispense).getFhirToJson()
            medDispenseData.prescriptionData = medDispense.prescriptionData;
            medDispenseData.dispensedMedication = medDispense.dispensedMedication
        return medDispenseData}
      );
      return { subEncounterObj: subEncounterObj,  medicineDispensedList: medDispenseObjects};
    }
    catch(e) {
      return Promise.reject(e)
    }
  }
  

  const getMedicationRequestAndMedication = async function(medDispResources, token) {
    try {
      // Get medication Request ids and medicationIds to further fetch the data from medication details
      let {medReqIds, medicationIds} = medDispResources.reduce((acc, element) => {
        if(element.resource.authorizingPrescription){
          acc.medReqIds.add(element?.resource.authorizingPrescription[0]?.reference.split("/")[1])
        }  
  
        if(element.resource.medicationReference) {
          acc.medicationIds.add(element.resource.medicationReference.reference.split("/")[1])
        }
        return acc; 
      }, { medReqIds: new Set(), medicationIds: new Set() });
      // console.info("medReqIds: ", medReqIds)
      // fetch medication request resource with their data.
      let medReqData = []
      if(medReqIds.size > 0) {
        const medRequestResources = await bundleStructure.searchData(config.baseUrl + "MedicationRequest", {_id: Array.from(medReqIds).join(","), _count: 200}, token)
          medReqData = medRequestResources.data.entry.map(medReq => {
            let medReqData = new MedicationRequest({}, medReq.resource);
            medReqData.getFhirToJson();
            let medData = medReqData.getMedReqResource();
            medData.qtyPrescribed = medData.qtyPerDose * medData.frequency * medData.duration;
            medicationIds.add(medReq.resource.medicationReference.reference.split("/")[1])
            return medData
        });
      }
  
      let medicationResources = await bundleStructure.searchData(config.baseUrl + "Medication", {_id: Array.from(medicationIds).join(","), _count: 200}, token)
      let medicationData = medicationResources.data.entry.map(element => {
        let medication = new Medication({}, element.resource);
        medication.getFHIRToTransformedResult();
        const medData = medication.getMedicationResource()
        return  medData
      });
  
      medReqData = medReqData.map(reqData => {
        const foundMedId = medicationData.findIndex(e =>  Number(e.medFhirId) == reqData.medFhirId)      
        if(foundMedId != -1) {
          reqData.prescribedMedication = medicationData[foundMedId]        
        }
        return reqData
      })
      
      return {"medReqData" : medReqData, "medicationData" : medicationData}
    }
    catch (e) {
      return Promise.reject(e)
    }
  
  }
  const addNewRecord = async function (resType, reqInput, token) {
    try {
      let bundleResources = []
      // get encounter id of the prescription from which it is attached
      let prescriptionEncounterId = reqInput.prescriptionFhirId;
      // console.info(" ======> prescriptionEncounterId: ", prescriptionEncounterId, reqInput)
      // Matching MedicationRequest list to be fetched to further link it to medicationDispense
      let combinedMedReqResource = await combineMedReqAndInput(prescriptionEncounterId, reqInput, token);
  
       // create sub-encounter to maintain notes and date time
      const subEncounter = await getEncounterResource(reqInput, {}, false);
      const subEncounterResInBundle = await bundleStructure.setBundlePost(subEncounter, subEncounter.identifier, reqInput.dispenseId, "POST", "identifier");
      bundleResources.push(subEncounterResInBundle)
      //  create medical dispense record
      const medicationDispenseResources = await getMedicationDispenseResources(combinedMedReqResource)
      bundleResources = [...bundleResources, ...medicationDispenseResources]
  
      return bundleResources
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  };
  
  const addOTCRecord = async function (resType, reqInput) {
    try {
    let bundleResources = []
       // create sub-encounter to maintain notes and date time
      const subEncounter = await getEncounterResource(reqInput, {}, false);
      const subEncounterResInBundle = await bundleStructure.setBundlePost(subEncounter, subEncounter.identifier, reqInput.dispenseId, "POST", "identifier");
      bundleResources.push(subEncounterResInBundle)
      //  create medical dispense record
       // Add the remaining unmatched items from the lookup
       console.log("$$$$$$$$$$$$$$$$$$: ", reqInput)
       const medDispenseData = reqInput.medicineDispensedList.map((medDispense) => {
        medDispense.date  =  reqInput.generatedOn,
        medDispense.subEncounterId = reqInput.dispenseId,
        medDispense.patientId = reqInput.patientId,
        medDispense.practitionerId = reqInput.practitionerId
        return medDispense;
    });
      const medicationDispenseResources = await getMedicationDispenseResources(medDispenseData)
      bundleResources = [...bundleResources, ...medicationDispenseResources]
  
      return bundleResources
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }
  
  
  const getMedicationDispenseResources = async function(combinedMedReqResource) {
      try {
          let medicationDispenseResources = []
          for ( let dispenseData of combinedMedReqResource) {
            // console.log("DISPENSE DATA *******************************:", dispenseData)
              const medDispenseClass = new MedicationDispense(dispenseData, {})
              let medDisResource = medDispenseClass.getJSONtoFhir()
              const dispenseResourceBundle = await bundleStructure.setBundlePost(medDisResource, medDisResource.identifier, medDisResource.identifier[0].value, "POST", "identifier");    
              medicationDispenseResources.push(dispenseResourceBundle)
          }
          return medicationDispenseResources
      }
      catch(e) {
          return Promise.reject(e)
      }
  }
  
  const combineMedReqAndInput = async function ( prescriptionEncounterId, reqInput, token) {
    try {
      // console.info(" ==========>", prescriptionEncounterId)
      const medicineDispensedList = reqInput.medicineDispensedList
      let dispenseListMedReqIds = medicineDispensedList
        .map((e) => e.medReqFhirId)
        .join(",");
      //  get medReqFhirId to fetch MedicationRequest data for that prescriptionId
      let medicationRequestResources = await bundleStructure.searchData(
        config.baseUrl + "MedicationRequest",{encounter: prescriptionEncounterId,  _id: dispenseListMedReqIds,  _count: 2000}, token
      );
      // create lookup of medicines to be dispensed list
      const medDispenseLookup = new Map(
        medicineDispensedList.map((dispense) => [dispense.medReqFhirId, dispense])
      );
      // console.info("medicationRequestResources: ", medicationRequestResources)
      // combine both using medReqFhirId
      const combined = medicationRequestResources.data.entry
      .map((obj1) => {
        const medReqFhirId =
          obj1.resource.id;
        const medDispense = medDispenseLookup.get(medReqFhirId) || {};
  
        // Remove the matched item from the lookup to track unmatched items
        medDispenseLookup.delete(medReqFhirId);
        return {
          ...medDispense,  prescribedMedFhirId: obj1.resource.medicationReference.reference.split("/")[1], dosageInstruction: obj1.resource.dosageInstruction,  subEncounterId: reqInput.dispenseId,
          patientId: reqInput.patientId, date: reqInput.generatedOn, practitionerId: reqInput.practitionerId};
      });
      // console.log("Check combined: =================", combined, "==================")
      // Add the remaining unmatched items from the lookup
      const unmatchedDispenses = Array.from(medDispenseLookup.values()).map((unmatched) => ({
          ...unmatched, 
          date: reqInput.generatedOn,
          subEncounterId: reqInput.dispenseId,
          patientId: reqInput.patientId,
          practitionerId: reqInput.practitionerId
      }));
  
      return [...combined, ...unmatchedDispenses];
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }
  
  const getEncounterResource = async function (reqInput, FHIRData, isMain) {
    try {
      //  Create main encounter resource to combine it to prescription
      let encounterResource = null;
      const dispenseEncounter = new DispenseEncounter(reqInput, FHIRData, isMain);
      encounterResource = dispenseEncounter.getUserInputToFhir();
      return encounterResource;
    } catch (e) {
      return Promise.reject(e);
    }
  };
  

module.exports = {
    getEncounterResource, combineMedReqAndInput, getMedicationDispenseResources, addOTCRecord, addNewRecord, mapEncounterAndMedDispense, getMainEncountersForPrescription, fetchMedDispenseList, fetchSubEncounterWithMedDispenseUserOutput
}