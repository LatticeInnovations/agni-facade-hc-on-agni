const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
const Observation = require("../class/Observation");
const Encounter = require("../class/encounter");
const { v4: uuidv4 } = require('uuid');
let axios = require("axios");



const saveCVDData = async (req, res) => {
    try {
        let resourceResult = [];
        for(let cvd of req.body){ 
            let encounterData = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": cvd.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });
            let encounterUuid = cvd.cvdUuid;
            let encounter = new Encounter({ 
                id: encounterUuid,
                encounterId: encounterData.data.entry[0].resource.id,
                patientId: cvd.patientId,
                cvdUuid: encounterUuid,
                practitionerId: req.decoded.userId,
                createdOn: cvd.createdOn,
                orgId: req.decoded.orgId
            }, {}).getUserInputToFhirForCVD();
            cvd.encounterId = encounterUuid;
            cvd.practitionerId = req.decoded.userId;
            cvd.categoryCode = "CVD";
            cvd.categoryDisplay = "CVD risk assessment";
            let heightObservation = new Observation(cvd, {}).getUserInputToFhirHeight();
            let weightObservation = new Observation(cvd, {}).getUserInputToFhirWeight();
            let diabeticObservation = new Observation(cvd, {}).getUserInputToFhirDiabetic();
            let smokingObservation = new Observation(cvd, {}).getUserInputToFhirSmoker(); 
            let bpObservation = new Observation(cvd, {}).getUserInputToFhirBloodPressure();
            let cholesterolObservation = new Observation(cvd, {}).getUserInputToFhirCholesterol();
            let bmiObservation = new Observation(cvd, {}).getUserInputToFhirBMI();
            let cvdValueObservation = new Observation(cvd, {}).getUserInputToFhirRisk();

            heightObservation.id = uuidv4();
            weightObservation.id = uuidv4();
            diabeticObservation.id = uuidv4();
            smokingObservation.id = uuidv4();
            bpObservation.id = uuidv4();
            cholesterolObservation.id = uuidv4();
            bmiObservation.id = uuidv4();
            cvdValueObservation.id = uuidv4();
        
            let encounterBundle = await bundleStructure.setBundlePost(encounter, null, encounter.id, "POST", "identifier");
            heightObservation = await bundleStructure.setBundlePost(heightObservation, null, heightObservation.id, "POST", "identifier");
            weightObservation = await bundleStructure.setBundlePost(weightObservation, null, weightObservation.id, "POST", "identifier");
            diabeticObservation = await bundleStructure.setBundlePost(diabeticObservation, null, diabeticObservation.id, "POST", "identifier");
            smokingObservation = await bundleStructure.setBundlePost(smokingObservation, null, smokingObservation.id, "POST", "identifier");
            bpObservation = await bundleStructure.setBundlePost(bpObservation, null, bpObservation.id, "POST", "identifier");
            cholesterolObservation = await bundleStructure.setBundlePost(cholesterolObservation, null, cholesterolObservation.id, "POST", "identifier");
            bmiObservation = await bundleStructure.setBundlePost(bmiObservation, null, bmiObservation.id, "POST", "identifier");
            cvdValueObservation = await bundleStructure.setBundlePost(cvdValueObservation, null, cvdValueObservation.id, "POST", "identifier"); 
            resourceResult.push(encounterBundle, heightObservation, weightObservation, diabeticObservation, smokingObservation, bpObservation, cholesterolObservation, bmiObservation, cvdValueObservation);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setCVDResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", error: response
            })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }

}

const getCVDData = async (req, res) => {
    try {
        const link = config.baseUrl + "Encounter";
        let queryParams = req.query
        queryParams.type="cvd-encounter"
        queryParams["service-provider"] = req.decoded.orgId
        queryParams._count = 4000;
        queryParams._total = "accurate";
        let resourceResult = []
       let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {   
            const FHIRData = responseData.data.entry;         
            let practitionerData = await bundleStructure.searchData(config.baseUrl + "Practitioner", { _count: 10000 });
            practitionerData = practitionerData.data.entry;
            // Fetch main Encounters list
            let mainEncounterList = FHIRData.filter(e => e.resource.resourceType == "Encounter" && e.resource.type[0].coding[0].code == "cvd-encounter").map(e => e.resource.partOf.reference.split('/')[1]);
            let mainEncounterIds = mainEncounterList.join(','); 

            mainEncounterList = await bundleStructure.searchData(config.baseUrl + "Encounter", { _id: mainEncounterIds, _count: 100000 });
            mainEncounterList = mainEncounterList.data.entry.map(e => e.resource);
            // Fetch sub encounter of vitals i.e Encounter --> Observation
            let cvdEncounterList = FHIRData.filter(e => e.resource.type && e.resource.type[0].coding[0].code == "cvd-encounter").map(e => e.resource);
            let cvdEncounterIds = cvdEncounterList.map(e => e.id).join(',');
            
            let allObservations = await bundleStructure.searchData(config.baseUrl + "Observation", { encounter: cvdEncounterIds, _count: 100000 });
            allObservations = allObservations.data.entry.map(e => e.resource);
            for(let encounter of cvdEncounterList){
                    let observationEncounter = new Encounter({}, encounter);
                    observationEncounter.getFhirToJsonForCVD();
                    let observationData = observationEncounter.getEncounterResource();
                    let practitioner = practitionerData.filter((e) => e?.resource?.id === observationData?.practitionerId);
                    let practitionerName = practitioner.length > 0 ? (practitioner?.[0]?.resource?.name?.[0]?.given?.join(' ') || '') + ' ' + (practitioner?.[0]?.resource?.name?.[0]?.family || "") : "";
                    observationData.practitionerName = practitionerName.trim();
                    // Date of vital creation
                    observationData.createdOn = encounter.period.start;
                    //  sub encounter FHIR id as cvdFhirId
                    delete observationData.prescriptionFhirId;
                    delete observationData.prescriptionId;
                    let primaryEncounter = mainEncounterList.filter(e => e.id === observationData.primaryEncounterId);
                    // console.log("primary encounter --->", primaryEncounter)
                    console.log("primary encounter ids---->", observationData.primaryEncounterId)
                    if(primaryEncounter.length > 0){
                        // fetch appointment id from main encounter
                        observationData.appointmentId = primaryEncounter?.[0].appointment?.[0]?.reference?.split("/")[1] || null;
                    }
                    delete observationData.primaryEncounterId;
                    delete observationData.practitionerId;
                    // let observationList = FHIRData.filter(e => e.resource.resourceType == "Observation" && e.resource.encounter.reference == "Encounter/"+encounter.id).map(e => e.resource);
                    let observationList = allObservations.filter(e => e.encounter.reference == "Encounter/"+encounter.id); 
                    // console.log(observationList.filter(data => data.subject.reference === 'Patient/3741'));
                    for(let observation of observationList){
                        let data = getObservationData(observation, observationData);
                        observationData = { ...observationData, ...data}
                    }
                    resourceResult.push(observationData);
                
                
            }
        }
        
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}

const updateCVDData = async (req, res) => {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        const reqInput = req.body;
        let resourceResult = [];
        console.log("CVD assessment Patch");
        for(let cvd of reqInput){
            let observations = await bundleStructure.searchData(config.baseUrl + "Observation", { "encounter": cvd.cvdFhirId, "code:text": cvd.key });
            observations = observations.data.entry;
            let observation = getPatchComponent(cvd.key, cvd.component, observations);
            const patchUrl = "Observation" + "/" + observations[0].resource.id;
            let patchData = await bundleStructure.setBundlePatch([{
                "encounterId": cvd.cvdFhirId,
                "op": cvd.component.operation,
                path: "/component", 
                value : observation.component
            }], patchUrl);

            let encounterPatchExist = resourceResult.find(e => e.fullUrl == "Encounter"+ "/"+ cvd.cvdFhirId);
            if(!encounterPatchExist){
                let patchPractitionerRefInEncounter = await bundleStructure.setBundlePatch([{
                    "op": "replace",
                    path: "/participant/0/individual/reference",
                    value : "Practitioner/" + req.decoded.userId,
                },
                {
                    "op": "replace",
                    path: "/length",
                    value : {
                        "value": new Date().valueOf(),
                        "unit": "millisecond",
                        "system": "https://unitsofmeasure.org",
                        "code": "ms"
                    },
                }], "Encounter"+ "/"+ cvd.cvdFhirId);
                resourceResult.push(patchPractitionerRefInEncounter);
            }
            resourceResult.push(patchData);
        }
      console.info(resourceResult)
      const resourceData = {resourceResult: resourceResult, errData: []}
      let bundleData = await bundleStructure.getBundleJSON(resourceData)  
      console.info(bundleData)
      let response = await axios.post(config.baseUrl, bundleData.bundle); 
      console.log("get bundle json response: ", response.status)  
      if (response.status == 200 || response.status == 201) {
          let resourceResponse = setCVDResponse(bundleData.bundle.entry, response.data.entry, "patch");
          let responseData = [...resourceResponse, ...bundleData.errData];
          res.status(201).json({ status: 1, message: "CVD data saved.", data: responseData })
      }
      else {
          return res.status(500).json({
          status: 0, message: "Unable to process. Please try again.", error: response
          })
      }
    }  catch(e) {
              console.error("Error",e)
              return res.status(200).json({
                      status: 0,
                      message: "Unable to process. Please try again"
                  }) 
    }
}



const setCVDResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    if(["post", "POST"].includes(type)){
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == "cvd-encounter");
    }
    else if(["patch", "PATCH"].includes(type)) {
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Observation");
        
    }  
    response = responseService.setDefaultResponse("Encounter", type, filteredData)
    return response;
}

const getObservationData = (FHIRData, observation) => {
    switch(FHIRData.code.text){
        case 'Height': return new Observation(observation, FHIRData).getHeightData();
        case 'Weight': return new Observation(observation, FHIRData).getWeightData();
        case 'Heart Rate': return new Observation(observation, FHIRData).getHeartRate();
        case 'Respiratory rate': return new Observation(observation, FHIRData).getRespRate();
        case 'spO2': return new Observation(observation, FHIRData).getSpo2();
        case 'Body temperature': return new Observation(observation, FHIRData).getTemperature();
        case 'Blood Pressure': return new Observation(observation, FHIRData).getBloodPressure();
        case 'Blood Glucose': return new Observation(observation, FHIRData).getBloodGlucose();
        case 'Eye Test': return new Observation(observation, FHIRData).getEyeTest();
        case 'Diabetic status': return new Observation(observation, FHIRData).getDiabeticData();
        case 'Smoking Status' : return new Observation(observation, FHIRData).getSmokerData();
        case 'Cholesterol': return new Observation(observation, FHIRData).getCholesterolData();
        case 'BMI': return new Observation(observation, FHIRData).getBMIData();
        case 'CVD Risk Percentage': return new Observation(observation, FHIRData).getRiskData();
    }
}

const getPatchComponent = (key, input, FHIRData) => {
    switch(key){
        case 'Height': return new Observation(input, FHIRData).patchUserInputToFhirHeight();
        case 'Weight': return new Observation(input, FHIRData).patchUserInputToFhirWeight();
        case 'Heart Rate': return new Observation(input, FHIRData).patchUserInputToFhirHeartRate();
        case 'Respiratory rate': return new Observation(input, FHIRData).patchUserInputToFhirRespRate();
        case 'spO2': return new Observation(input, FHIRData).patchUserInputToFhirSpo2();
        case 'Body temperature': return new Observation(input, FHIRData).patchUserInputToFhirTemp();
        case 'Blood Pressure': return new Observation(input, FHIRData).patchUserInputToFhirBloodPressure();
        case 'Blood Glucose': return new Observation(input, FHIRData).patchUserInputToFhirBloodGlucose();
        case 'Eye Test': return new Observation(input, FHIRData).patchUserInputToFhirEyeTest();
        case 'Diabetic status': return new Observation(input, FHIRData).patchUserInputToFhirDiabetic();
        case 'Smoking Status' : return new Observation(input, FHIRData).patchUserInputToFhirSmoker();
        case 'Cholesterol': return new Observation(input, FHIRData).patchUserInputToFhirCholesterol();
        case 'BMI': return new Observation(input, FHIRData).patchUserInputToFhirBMI();
        case 'CVD Risk Percentage': return new Observation(input, FHIRData).patchUserInputToFhirRisk();
    }
}

module.exports = {saveCVDData, getCVDData, updateCVDData}