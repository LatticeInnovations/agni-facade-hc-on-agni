
const MedicationDispense = require("../class/MedicationDispense");
const DispenseEncounter = require("../class/DispenseEncounter");
const Medication = require("../class/medication");
const MedicationRequest = require("../class/MedicationRequest");
const { v4: uuidv4 } = require("uuid");
const bundleStructure = require("./bundleOperation");
const { buildFHIRResource, getTransformedResult, fetchResource } = require("./helperFunctions");

const processSubEncounters = (medDispResources, mainEncounters) => {
  const subEncounters = medDispResources
      .filter((res) => res.resource.resourceType === "Encounter")
      .map((e) => e.resource);

  return subEncounters.map((element) => {
      if (mainEncounters.length > 0) {
          const primaryEncounter = mainEncounters.find(
              (e) => e.id === element.partOf.reference.split("/")[1]
          );
          element.appointmentId = primaryEncounter?.mappedAppointmentEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
      } else {
          element.appointmentId = null;
      }
      return element;
  });
};
 

const mapMedicationDispenseResources = (medDispResources, enc, medReqData, medicationData) => {
  const medDispenseRes = medDispResources
      .filter(
          (md) =>
              md.resource.resourceType === "MedicationDispense" &&
              md.resource.context.reference.split("/")[1] === enc.id
      )
      .map((e) => e.resource);

  return medDispenseRes.map((medDisp) => {
      const medReqIndex = medDisp.authorizingPrescription
          ? medReqData.findIndex(
                (e) => e.medReqFhirId === medDisp.authorizingPrescription[0].reference.split("/")[1]
            )
          : -1;

      const medIndex = medicationData.findIndex(
          (e) => e.medFhirId === medDisp.medicationReference.reference.split("/")[1]
      );

      medDisp.prescriptionData = medReqIndex !== -1 ? medReqData[medReqIndex] : {};
      medDisp.dispensedMedication = medIndex !== -1 ? medicationData[medIndex] : {};

      return medDisp;
  });
};

  // Fetch medicine dispense list with their sub encounters combined
  const fetchMedDispenseList = async function (medDispResources, mainEncounters, token) {
    try {
        // Fetch medication request and medication data
        const { medReqData, medicationData } = await getMedicationRequestAndMedication(medDispResources, token);

        // Process sub-encounters
        const subEncounters = processSubEncounters(medDispResources, mainEncounters);

        // Map sub-encounters to their respective MedicationDispense resources
        const medDispenseWithEncounter = subEncounters.map((enc) => {
            const medDispenseRes = mapMedicationDispenseResources(medDispResources, enc, medReqData, medicationData);
            return { subEncounter: enc, medDispenseRes };
        });

        return medDispenseWithEncounter;
    } catch (error) {
        console.error(error);
        const err = { statusCode: 404, code: "ERR", message: "Data not found" };
        return Promise.reject(err);
    }
};
  
const fetchExistingMainEncounters = async (prescriptionIds, token) => {
  const mainEncounterQuery = {
      "part-of": prescriptionIds.join(","),
      type: "pharmacy-service",
      _count: 1000,
  };

  const existingMainEncounters = await fetchResource("Encounter", mainEncounterQuery,
    token);
  if (existingMainEncounters.total > 0 && existingMainEncounters.entry) {
      return await Promise.all(
          existingMainEncounters.entry.map(async (encounter) => {
              return await bundleStructure.setBundlePost(  encounter.resource, encounter.resource.identifier, encounter.resource.id, "PUT", "identifier");
          })
      );
  }
  return [];
};
 

const getMissingPrescriptionIds = (existingMainEncountersList, prescriptionIds) => {
  const existingMainPrescriptionIds = new Set(
      existingMainEncountersList.map((e) => e.resource.partOf.reference.split("/")[1])
  );
  return prescriptionIds.filter((item) => !existingMainPrescriptionIds.has(item));
};

const createNewMainEncounters = async (reqInput, missingPrescriptionIds) => {
  if (!missingPrescriptionIds || missingPrescriptionIds.length === 0) {
      return [];
  }

  return await Promise.all(
      missingPrescriptionIds.map(async (inputId) => {
          const input = reqInput.find((e) => e.prescriptionFhirId === inputId);
          if (!input) {
              return null;
          }

          input.mainEncounterUuid = uuidv4();
          const mainEncounterResource = await getEncounterResource(input, {}, true);

          return await bundleStructure.setBundlePost(mainEncounterResource,  mainEncounterResource.identifier, input.mainEncounterUuid, "POST", "identifier");
      })
  ).then((results) => results.filter((encounter) => encounter !== null)); // Filter out null values
};


const getMainEncountersForPrescription = async function (reqInput, token, prescriptionIds) {
  try {
      if (!prescriptionIds || prescriptionIds.length === 0) {
          return [];
      }

      // Fetch existing main encounters
      const existingMainEncountersList = await fetchExistingMainEncounters(prescriptionIds, token);

      // Identify prescription IDs for missing main encounters
      const missingPrescriptionIds = getMissingPrescriptionIds(existingMainEncountersList, prescriptionIds);

      // Create new main encounters for missing prescription IDs
      const newEncounters = await createNewMainEncounters(reqInput, missingPrescriptionIds);

      // Combine existing and new encounters
      return [...existingMainEncountersList, ...newEncounters];
  } catch (error) {
      console.error("Error in getMainEncountersForPrescription:", error);
      return Promise.reject(error);
  }
};
  
  const mapEncounterAndMedDispense= async function(mainEncounters, medDispenseWithEncounter) {
    try {
      const medicationDispenseResult = await Promise.all(
        mainEncounters.map(async (mainEnc) => {
          // get main encounter object
          mainEnc.isMain = true;
          const mainEncounterObj = getTransformedResult(DispenseEncounter, mainEnc);
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
      element.subEncounter.isMain = false;
      const subEncounterObj = getTransformedResult(DispenseEncounter, element.subEncounter);
      subEncounterObj.appointmentId = element.subEncounter.appointmentId
      // get dispense list included with medicationRequest data and medication data as well for a sub encounter
      const medDispenseObjects = element.medDispenseRes.map((medDispense) =>
  {         let medDispenseData = getTransformedResult(MedicationDispense, medDispense);
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
      console.log("medDispResources: ", medDispResources)
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
        const medRequestResources = await fetchResource("MedicationRequest", {_id: Array.from(medReqIds).join(","), _count: 200}, token)
          medReqData = medRequestResources.entry.map(medReq => {
            const medData = getTransformedResult(MedicationRequest, medReq.resource);
            medData.qtyPrescribed = medData.qtyPerDose * medData.frequency * medData.duration;
            medicationIds.add(medReq.resource.medicationReference.reference.split("/")[1])
            return medData
        });
      }
  
      let medicationResources = await fetchResource("Medication", {_id: Array.from(medicationIds).join(","), _count: 200}, token)
      let medicationData = medicationResources.entry.map(element => {
        const medication = getTransformedResult(Medication, element.resource);
        return  medication
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
              const medDisResource = buildFHIRResource(MedicationDispense, dispenseData);
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
      let medicationRequestResources = await fetchResource("MedicationRequest",{encounter: prescriptionEncounterId,  _id: dispenseListMedReqIds,  _count: 2000}, token)
      // create lookup of medicines to be dispensed list
      const medDispenseLookup = new Map(
        medicineDispensedList.map((dispense) => [dispense.medReqFhirId, dispense])
      );
      // console.info("medicationRequestResources: ", medicationRequestResources)
      // combine both using medReqFhirId
      const combined = medicationRequestResources.entry
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
      reqInput.isMain = isMain;
      const dispenseEncounter = buildFHIRResource(DispenseEncounter, reqInput);
      return dispenseEncounter;
    } catch (e) {
      return Promise.reject(e);
    }
  };
  

module.exports = {
    getEncounterResource, combineMedReqAndInput, getMedicationDispenseResources, addOTCRecord, addNewRecord, mapEncounterAndMedDispense, getMainEncountersForPrescription, fetchMedDispenseList, fetchSubEncounterWithMedDispenseUserOutput
}