let axios = require("axios");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
let Encounter = require("../class/GroupEncounter");
let Immunization = require("../class/Immunization")
let DocumentReference = require("../class/BaseDocumentReference");
const { immunizationSaveObject } = require("../utils/Validator/immunizationValidation");
const { handleError, buildFHIRResource, fetchResource, getTransformedResult } = require("../services/helperFunctions");
const {validateRequest} = require("../utils/validateRequest");


function createSubEncounter(parameters) {
  try {
        const { tokenDecoded, mainEncounter, immunizationData } = parameters;
        const patientId = immunizationData.patientId;
        const encounterId = uuidv4();
        const subEncounter = buildFHIRResource(Encounter, {
          id: encounterId,
          appointmentEncounterId: mainEncounter.id,
          patientId: patientId,
          uuid: encounterId,
          userId: tokenDecoded.userId,
          createdOn: immunizationData.createdOn,
          orgId: tokenDecoded.orgId,
        });    
        subEncounter.type = [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "384810002",
                display: "Immunization management",
              },
            ],
          },
        ]
        return subEncounter;
      } catch (e) {
        console.error(e);
        return Promise.reject(e);
      }
}

const createImmunizationResources = async (reqInput, mainEncounters, tokenDecoded, immunizationRecommendations) => {
  const resourceResult = [];
  await Promise.all(reqInput.map(async (immunizationData) => {
    let mainEncounter = mainEncounters.filter(
      (e) =>e.resourceType == "Encounter" && e.appointment[0]?.reference?.split("/")[1] == immunizationData.appointmentId);
    console.log("Immunization POST");
    mainEncounter = mainEncounter[0];
    let subEncounter = createSubEncounter({ tokenDecoded, mainEncounter, immunizationData });
    let subEncounterBundle = await bundleStructure.setBundlePost(subEncounter, null, subEncounter.identifier[0].value, "POST", "identifier");
    console.info("sub encounter id: ",subEncounter )

    // set immunization parameters and create Immunization Record
    immunizationData.orgId = tokenDecoded.orgId;
    immunizationData.practitionerId = tokenDecoded.userId;
    immunizationData.subEncounterId = subEncounter.identifier[0].value;
    const immunizationBundle = await createImmunizationResource(immunizationData); 
      
      // Link immunization To ImmunizationRecommendation
    const recommendationBundle = await addImmunizationReference(immunizationRecommendations, immunizationData)   
      console.log("recommendation resource check: ", recommendationBundle)
      //  push data
    resourceResult.push(subEncounterBundle, immunizationBundle, recommendationBundle);
      // if documents exist create reference
    if(immunizationData.immunizationFiles) {
      for (const file of immunizationData.immunizationFiles) {
        file.encounterUuid = subEncounter.identifier[0].value;
        file.patientId = immunizationData.patientId;
        let docReferenceBundle = await createDocumentReference(file)
        console.info("doc reference check: ", docReferenceBundle.resource.context.encounter, "------------------------------")
        resourceResult.push(docReferenceBundle)
      }
    }
  }));
  return resourceResult
}

const saveImmunizationData = async function (req, res) {
    try {
        const token = req.decoded.encodedToken;
        const reqInput = req.body;
        const validatedBody = validateRequest(reqInput, immunizationSaveObject, res);
        if (!validatedBody) return;
        const mainEncounters = await getMainEncounter(reqInput, token);
        // Get immunization recommendation resources of the patients
        const immunizationRecommendations = await getImmunizationRecommendation(reqInput, token);
        if(immunizationRecommendations.length == 0)
            res.status(400).json({ status: 1, message: "Immunization recommendation not present.", data: [] })
        // console.log(immunizationRecommendations)
        const resourceResult = await createImmunizationResources(reqInput, mainEncounters, req.decoded, immunizationRecommendations);

        console.info("FINAL CHECK RESOURCE RESULT ARRAY CHECK: ", resourceResult, "************************************");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/fhir+json'
          }
      }); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setImmunizationResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Immunization data saved.", data: responseData })
        }
        else {
          return handleError(res, response);
        }
      } catch (error) {
        console.error("saveImmunizationData Error: ", error)
        return handleError(res, error)
      }
    };


    //  Get Practitioner data
let getImmunizationDetails = async function (req, res) {
    try {
        let resourceResult = []
        const token = req.accessToken;
        const queryParams = {"_total": "accurate","_count": 3000,"patient": req.query.patientId }
        const responseData = await fetchResource("Immunization", queryParams);
        let resStatus = 1;
        if(responseData.entry.length == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData = responseData.entry;
        const encounterIds = FHIRData.map(e => e.resource.encounter.reference.split("/")[1]).join(",")
        let subEncounters = await fetchResource("Encounter", {"_id": encounterIds, "_count": 5000 }, token )
        subEncounters = subEncounters?.entry?.map((e) => e?.resource) || [];

        let subEncMainEncMap = new Map(subEncounters.map((e) => [e.id, e?.partOf?.reference.split("/")[1]]));

        let mainEncounterIds = subEncounters.map(e => e?.partOf?.reference.split("/")[1]).join(",");
        console.info("These are main encounters", mainEncounterIds);

        let mainEncounters = await fetchResource("Encounter", {"_id": mainEncounterIds, "_count": 5000 }, token );
        mainEncounters = mainEncounters?.entry?.map((e) => e?.resource) || [];

        let mainEncounterAppointmentMap = new Map(mainEncounters.map((e) => [e.id, e?.appointment?.[0]?.reference?.split("/")[1]]));
        // fetch Document references for the immunization
        let docReferenceResources = await fetchResource("DocumentReference", {"encounter": encounterIds, "encounter.type": "384810002",  "_count": 5000 }, token)
        docReferenceResources = docReferenceResources.total > 0 ? docReferenceResources.entry.map(e => e.resource) : []
        // create response data
        resourceResult = await getVaccineDocumentReferenceFiles(FHIRData, mainEncounterAppointmentMap, subEncMainEncMap,docReferenceResources);
        
        res.status(200).json({ status: resStatus, message: "Immunization data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(error) {
        console.error("Error",error)
        handleError(res, error);       
    }
}

const getVaccineDocumentReferenceFiles = async (FHIRData, mainEncounterAppointmentMap, subEncMainEncMap,docReferenceResources ) => {
  try {
    const resourceResult = []
    FHIRData.forEach(vaccine => {
      let immunizationObj = getTransformedResult(Immunization, vaccine.resource);
      immunizationObj.appointmentId = mainEncounterAppointmentMap.get(subEncMainEncMap.get(immunizationObj.subEncounterId));
      delete immunizationObj.subEncounterId;
      //  get doc if present
      let immunizationFiles = []
      immunizationFiles = docReferenceResources.filter(e => e.context.encounter[0].reference == vaccine.resource.encounter.reference).map(e => {
        return {filename: e.content[0].attachment.title}})
      immunizationObj.immunizationFiles = immunizationFiles;
      resourceResult.push(immunizationObj)
    });

    return resourceResult;
  }
  catch(error) {
    console.log("getVaccineDocumentReferenceFiles get API function error: ", error)
    throw error;      
  }
}

async function getImmunizationRecommendation(reqInput, token) {
  try {
    const patientIds = reqInput.map((e) => e.patientId).join(",");
    const vaccineCodes = reqInput.map((e) => e.vaccineCode).join(",");
    const immunizationRecommendations = await fetchResource("ImmunizationRecommendation", {
      "vaccine-type": vaccineCodes,
      patient: patientIds,
      _count: 5000,
    },
    token);
    if (immunizationRecommendations.entry.length == 0) {
      return [];
    }
    const immunizationRecommendationResources =
      immunizationRecommendations.entry.map((e) => e.resource);
    return immunizationRecommendationResources;
  } catch (e) {
    console.error(e);
    return Promise.reject(e);
  }
}
    
async function getMainEncounter(reqInput, token) {
  try {
            console.log(reqInput)
            const appointmentIds = reqInput.map((e) => e.appointmentId).join(",");
            // fetch main encounter using appointment id
            const getMainEncounters = await fetchResource("Encounter", {
              appointment: appointmentIds, _count: 5000, _include: "Encounter:appointment",},
            token);
            if (getMainEncounters.entry.length == 0) {
              return [];
            }
            const mainEncounters = getMainEncounters.entry.map((e) => e.resource);
            return mainEncounters;
        }
        catch(e) {
           console.error(e) 
           return Promise.reject(e);
        }
  }
    

    
    
async function createImmunizationResource(inputData) {
  try {
        inputData.identifier = [
          {
            "system" : "http://hl7.org/fhir/sid/sn",
            value: inputData.immunizationUuid
          }
        ]
        let immunizationResource = buildFHIRResource(Immunization, inputData);
        let immunizationBundle = await bundleStructure.setBundlePost(immunizationResource,null, inputData.immunizationUuid, "POST", "identifier");
        return immunizationBundle;
    
  }
  catch(e) {
    console.error(e)
    return Promise.reject(e)
  }
}
    
async function addImmunizationReference(immunizationRecommendations, immunizationData) {
        let recommendationResource = immunizationRecommendations.filter(e => 
            e.recommendation[0].vaccineCode[0].coding[0].code == immunizationData.vaccineCode &&
            e.patient.reference.split("/")[1] == immunizationData.patientId
        )
        recommendationResource = recommendationResource[0]
        for(let i=0; i<recommendationResource.recommendation.length; i++) {
            if(!recommendationResource.recommendation[i].supportingImmunization) {
                console.log("entered loop if condition")
                recommendationResource.recommendation[i].supportingImmunization = [
                    {
                        "reference": "urn:uuid:" + immunizationData.immunizationUuid
                    }
                ]
                break;
            }
        }
    
        let recommendationBundle = await bundleStructure.setBundlePost(recommendationResource, null, recommendationResource.id, "PUT", "identifier"); 
    
        console.log("recommendation bundle: ", recommendationBundle)
        return recommendationBundle
}
    
async function createDocumentReference(file) {
        try {
            file.uuid = uuidv4();
            const documentReferenceResource = buildFHIRResource(DocumentReference, file);
            let documentReferenceBundle = await bundleStructure.setBundlePost(documentReferenceResource,null, file.uuid, "POST", "identifier");
            console.log("documentReferenceBundle: ", documentReferenceBundle)
            return documentReferenceBundle;
        }
        catch(e) {
            console.error(e)
            return Promise.reject(e)
        }
    }
    

const setImmunizationResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "Immunization");            
    response = responseService.setDefaultResponse("Immunization", type, filteredData)
    return response;
}


module.exports = { saveImmunizationData, getImmunizationDetails }