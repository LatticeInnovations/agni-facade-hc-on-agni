let axios = require("axios");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
let Encounter = require("../class/GroupEncounter");
let Immunization = require("../class/Immunization")
let DocumentReference = require("../class/BaseDocumentReference");
const { validateImmunization } = require("../utils/Validator/immunizationValidation");

const saveImmunizationData = async function (req, res) {
    let resourceResult = [];
    try {
        const token = req.decoded.encodedToken;
        const reqInput = req.body;
        let validationResponse = validateImmunization(reqInput);
        if (validationResponse.error) {
            console.error(validationResponse.error.details);
            return res.status(422).json({ status: 1, data: validationResponse.error.details[0] , message: "Invalid input" })
        }
        const mainEncounters = await getMainEncounter(reqInput, token);
        // Get immunization recommendation resources of the patients
        const immunizationRecommendations = await getImmunizationRecommendation(reqInput, token);
        if(immunizationRecommendations.length == 0)
            res.status(400).json({ status: 1, message: "Immunization recommendation not present.", data: [] })
        // console.log(immunizationRecommendations)
        for (let immunizationData of reqInput) {
            let mainEncounter = mainEncounters.filter(
                (e) =>e.resourceType == "Encounter" && e.appointment[0]?.reference?.split("/")[1] == immunizationData.appointmentId);
            console.log("Immunization POST");
            mainEncounter = mainEncounter[0];
            const tokenDecoded = req.decoded
            //  create sub encounter
            const encounterData = { tokenDecoded, mainEncounter, immunizationData };
            let subEncounter = createSubEncounter(encounterData);
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
                console.info("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY")
                for (const file of immunizationData.immunizationFiles) {
                    file.encounterUuid = subEncounter.identifier[0].value;
                    file.patientId = immunizationData.patientId;
                    let docReferenceBundle = await createDocumentReference(file)
                    console.info("doc reference check: ", docReferenceBundle.resource.context.encounter, "------------------------------")
                    resourceResult.push(docReferenceBundle)
                }
            }
        }
        console.info("FINAL CHECK RESOURCE RESULT ARRAY CHECK: ", resourceResult, "************************************");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setImmunizationResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Immunization data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", error: response
                })
        }
      } catch (e) {
        return Promise.reject(e);
      }
    };


    //  Get Practitioner data
let getImmunizationDetails = async function (req, res) {
    try {
        const link = config.baseUrl + "Immunization";
        let queryParams = {
            "_total": "accurate",
            "_count": 3000,
            "patient": req.query.patientId
        }
        let resourceResult = []
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        const token = req.decoded.encodedToken;
        console.info("FHIRData: ", responseData)
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData = responseData.data.entry;
        const encounterIds = FHIRData.map(e => e.resource.encounter.reference.split("/")[1]).join(",")
        let subencounters = await bundleStructure.searchData(config.baseUrl + "Encounter", {
          "_id": encounterIds, "_count": 5000 }, token );
        subencounters = subencounters?.data?.entry?.map((e) => e?.resource) || [];
        let subEncMainEncMap = new Map(subencounters.map((e) => [e.id, e?.partOf?.reference.split("/")[1]]));
        let mainEncounterIds = subencounters.map(e => e?.partOf?.reference.split("/")[1]).join(",");
        console.info("These are main encounters", mainEncounterIds);
        let mainEncounters = await bundleStructure.searchData(config.baseUrl + "Encounter", {
          "_id": mainEncounterIds, "_count": 5000 }, token );
        mainEncounters = mainEncounters?.data?.entry?.map((e) => e?.resource) || [];
        let mainEncounterAppointmentMap = new Map(mainEncounters.map((e) => [e.id, e?.appointment?.[0]?.reference?.split("/")[1]]));
        console.log("this is appointment map", mainEncounterAppointmentMap);
        console.log("this is encounter map", subEncMainEncMap);
        // fetch Document references for the immunization
        let docReferenceResources = await bundleStructure.searchData(config.baseUrl + "DocumentReference",{
          "encounter": encounterIds, "encounter.type": "384810002",  "_count": 5000 }, token );
        console.info("docReferenceResources: ", docReferenceResources)
        if(docReferenceResources.data.total > 0){
            docReferenceResources = docReferenceResources.data.entry.map(e => e.resource)
        }
        else {
            docReferenceResources = [];
        }
          console.log("docReferenceResources: ", docReferenceResources)
        // create response data
        FHIRData.forEach(vaccine => {
          let immunizationObj = new Immunization({}, vaccine.resource).getImmunizationObj();
          immunizationObj.appointmentId = mainEncounterAppointmentMap.get(subEncMainEncMap.get(immunizationObj.subEncounterId));
          delete immunizationObj.subEncounterId;
          //  get doc if present
          let immunizationFiles = []
          immunizationFiles = docReferenceResources.filter(e => e.context.encounter[0].reference == vaccine.resource.encounter.reference).map(e => {
            return {filename: e.content[0].attachment.title}})
          immunizationObj.immunizationFiles = immunizationFiles
          // console.log("immunizationObj: ", immunizationObj)
          resourceResult.push(immunizationObj)
        });
        
        res.status(200).json({ status: resStatus, message: "Immunization data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}

    async function getImmunizationRecommendation(reqInput, token) {
        try {
                const patientIds = reqInput.map(e => e.patientId).join(",");
                const vaccineCodes = reqInput.map(e => e.vaccineCode).join(",");
                const immunizationRecommendations = await bundleStructure.searchData(config.baseUrl + "ImmunizationRecommendation",{
                    "vaccine-type": vaccineCodes,  "patient": patientIds,  "_count": 5000 },
                  token );
                  if (immunizationRecommendations.data.entry.length == 0) {
                    return [];
                  }
                  const immunizationRecommendationResources = immunizationRecommendations.data.entry.map((e) => e.resource);
                  return immunizationRecommendationResources;
                
        }
        catch(e) {
            console.error(e);
            return Promise.reject(e)
        }
    }
    
    async function getMainEncounter(reqInput, token) {
        try {
            console.log(reqInput)
            const appointmentIds = reqInput.map((e) => e.appointmentId).join(",");
            // fetch main encounter using appointment id
            const getMainEncounters = await bundleStructure.searchData(config.baseUrl + "Encounter",{
                appointment: appointmentIds, _count: 5000, _include: "Encounter:appointment",},
              token );
            if (getMainEncounters.data.entry.length == 0) {
              return [];
            }
            const mainEncounters = getMainEncounters.data.entry.map((e) => e.resource);
            return mainEncounters;
        }
        catch(e) {
           console.error(e) 
           return Promise.reject(e);
        }
    }
    
    function createSubEncounter(parameters) {
      try {
        const { tokenDecoded, mainEncounter, immunizationData } = parameters;
        const patientId = immunizationData.patientId;
        const encounterId = uuidv4();
        let subEncounter = new Encounter({
            id: encounterId,
            appointmentEncounterId: mainEncounter.id,
            patientId: patientId,
            uuid: encounterId,
            practitionerId: tokenDecoded.userId,
            createdOn: immunizationData.createdOn,
            orgId: tokenDecoded.orgId,
          },{}
        ).getUserInputToFhir();
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
        ];
    
        return subEncounter;
      } catch (e) {
        console.error(e);
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
            let immunizationResource = new Immunization(inputData, {}).getFhirResource();
            let immunizationBundle = await bundleStructure.setBundlePost(immunizationResource,null, inputData.immunizationUuid, "POST", "identifier");
            console.log("immunization:", immunizationBundle)
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
            const documentReferenceResource = new DocumentReference(file, {}).getJSONtoFhir();
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