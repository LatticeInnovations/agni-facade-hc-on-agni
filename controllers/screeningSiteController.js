const ScreeningSite = require("../class/ScreeningSite");
const PractitionerRole = require("../class/practitionerRole");
const axios = require("axios");
const config = require("../config/nodeConfig");
const { screeningSiteSchema } = require("../utils/Validator/campaign/screeningSiteValidatior");
const { validateRequest } = require("../utils/validateRequest");
const bundleStructure = require("../services/bundleOperation");
const { fetchResource, buildFHIRResource } = require("../services/helperFunctions");
const { v4: uuidv4 } = require("uuid");

const validateBusinessRules = (data) => {
    if (!data.location?.type || !data.location?.value) {
        throw new Error("Location type and value required");
    }

    const headCount = data.staffIds.filter(s => s.isHead).length;
    if (headCount !== 1) {
        throw new Error("Exactly one staff must be Head of Screening Campaign");
    }

    const ids = data.staffIds.map(s => s.id);
    if (ids.length !== new Set(ids).size) {
        throw new Error("Duplicate staff IDs are not allowed");
    }
};

const checkDuplicateSiteName = async (name, token, excludeId = null) => {
    const res = await fetchResource(
        "Location",
        { name, type: "SCREENING_SITE" },
        token
    );

    if (res.entry && res.entry.length > 0) {
        if (!excludeId || res.entry[0].resource.id !== excludeId) {
            throw new Error("Screening site already exists with name: " + name);
        }
    }
};

const getParentLocationId = async (data, token) => {
    const res = await fetchResource(
        "Location",
        {
            type: "area-council",
            _id: data.location.value
        },
        token
    );

    if (!res.entry || res.entry.length === 0) {
        throw new Error(`Parent location not found: ${data.location.value}`);
    }

    return res.entry[0].resource.id;
};

const buildCreateBundleEntries = async (data, token, parentLocationId) => {
    let entries = [];
    const locationUuid = uuidv4();

    const locationResource = buildFHIRResource(ScreeningSite, data);
    if (parentLocationId) {
        locationResource.partOf = {
            reference: `Location/${parentLocationId}`
        };
    }
    const locationEntry = await bundleStructure.setBundlePost(
        locationResource,
        null,
        locationUuid,
        "POST"
    );
    entries.push(locationEntry);

    for (let staff of data.staffIds) {
        const roleObj = {
            userId: staff.id,
            isHead: staff.isHead,
            locationId: locationUuid,
            isScreeningFlow: true
        };
        const roleResource = buildFHIRResource(PractitionerRole, roleObj);
        const roleEntry = await bundleStructure.setBundlePost(
            roleResource,
            null,
            uuidv4(),
            "POST"
        );
        entries.push(roleEntry);
    }

    return entries;
};

const getIdFromLocation = (location) => {
    return location?.split("/")[1];
};

const getAllServiceModes = async (token) => {
    const response = await fetchResource(
        "ActivityDefinition",
        { topic: "SERVICE_MODE", _count: 1000 },
        token
    );

    const map = {};

    for (const entry of response.entry || []) {
        const resource = entry.resource;

        const coding = resource.code?.coding?.find(
            c => c.system === "http://example.org/service-mode"
        );

        if (coding?.display) {
            map[coding.display] = resource.id;
        }
    }

    console.log("Service mode map:", JSON.stringify(map));
    return map;
};

const getStaffDetails = async (staffRoles, token) => {
    const staffDetails = [];

    for (const roleEntry of staffRoles) {
        const roleResource = roleEntry.resource;

        const isScreeningStaff = roleResource.code?.some(c =>
            c?.coding?.some(cd => cd.code === "SCREENING_STAFF")
        );

        if (!isScreeningStaff) continue;

        const isHeadExt = roleResource.extension?.find(
            e => e.url === "http://heartcare.vu/StructureDefinition/is-leader"
        );
        const isTeamLead = isHeadExt?.valueBoolean || false;

        const practitionerRef = roleResource.practitioner?.reference;
        if (!practitionerRef) continue;

        const practitionerId = practitionerRef.split("/")[1];

        const practitionerResponse = await fetchResource(
            "Practitioner",
            { _id: practitionerId },
            token
        );

        const practitionerResource = practitionerResponse.entry?.[0]?.resource;
        if (!practitionerResource) continue;

        let mobile = "";
        let email = "";

        if (practitionerResource.telecom) {
            const phoneEntry = practitionerResource.telecom.find(t => t.system === "phone");
            const emailEntry = practitionerResource.telecom.find(t => t.system === "email");

            if (phoneEntry) mobile = phoneEntry.value || "";
            if (emailEntry) email = emailEntry.value || "";
        }

        const nameObj = practitionerResource.name?.[0];
        let name = "Unknown";
        if (nameObj) {
            if (nameObj.text) {
                name = nameObj.text;
            } else {
                const given = Array.isArray(nameObj.given) ? nameObj.given.join(" ") : (nameObj.given || "");
                const family = nameObj.family || "";
                name = `${given} ${family}`.trim() || "Unknown";
            }
        }

        staffDetails.push({
            id: practitionerId,
            name: name,
            mobile: mobile,
            email: email,
            isTeamLead: isTeamLead
        });
    }

    return staffDetails;
};

const createScreeningSite = async (req, res) => {
    try {
        const validated = validateRequest(req.body, screeningSiteSchema, res);
        if (!validated) return;

        const token = req.accessToken;
        const data = req.body;

        validateBusinessRules(data);
        await checkDuplicateSiteName(data.name, token);
        const parentLocationId = await getParentLocationId(data, token);
        const resourceResult = await buildCreateBundleEntries(data, token, parentLocationId);
        const bundleData = await bundleStructure.getBundleJSON({ resourceResult });

        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/fhir+json"
            }
        });

        const locationId = getIdFromLocation(response.data.entry[0].response.location);

        return res.status(201).json({
            status: 1,
            message: "Screening site created successfully",
            data: {
                locationId,
                assignedStaff: data.staffIds.map(s => s.id)
            }
        });

    } catch (err) {
        console.error("Error creating screening site:", err);
        return res.status(400).json({
            status: 0,
            message: err.message
        });
    }
};

const listScreeningSites = async (req, res) => {
    try {
        const token = req.accessToken;
        const { status, _page = 1, _count = 50 } = req.query;

        const query = {
            type: "SCREENING_SITE",
            _page,
            _count
        };

        if (status) {
            query.status = status;
        }

        if (req.query._lastUpdated) {
            query._lastUpdated = req.query._lastUpdated;
        }

        const locationResponse = await fetchResource("Location", query, token);

        if (!locationResponse.entry) {
            return res.status(200).json({
                status: 1,
                data: []
            });
        }

        const serviceModeMap = await getAllServiceModes(token);
        console.log("Service mode map:", JSON.stringify(serviceModeMap));

        const sites = [];

        for (const entry of locationResponse.entry) {
            const locationResource = entry.resource;
            const site = new ScreeningSite({}, locationResource);
            const locationData = site.getLocation();

            let location = "";
            let areaCouncil = "";
            let areaCouncilId = "";

            if (locationData?.type === "FREE_TEXT") {
                location = locationData.value || "";
            } else if (locationData?.type === "AREA_COUNCIL") {
                const councilRef = locationData.value;
                try {
                    const councilResponse = await fetchResource(
                        "Location",
                        { _id: councilRef },
                        token
                    );
                    const councilResource = councilResponse.entry?.[0]?.resource;
                    areaCouncil = councilResource?.name || councilRef;
                    areaCouncilId = councilResource?.id || councilRef;
                } catch (e) {
                    console.error(`Error fetching council ${councilRef}:`, e);
                    areaCouncil = councilRef;
                    areaCouncilId = councilRef;
                }
            }

            const staffResponse = await fetchResource(
                "PractitionerRole",
                { location: locationResource.id },
                token
            );

            const staffRoles = staffResponse?.entry || [];
            const staff = await getStaffDetails(staffRoles, token);

            const serviceMode = site.getServiceMode() || "";
            console.log(`Site ${locationResource.id}: serviceMode="${serviceMode}", serviceModeId="${serviceModeMap[serviceMode] || ""}"`);

            sites.push({
                id: locationResource.id,
                name: locationResource.name || "",
                location: location,
                areaCouncil: areaCouncil,
                areaCouncilId: areaCouncilId,
                serviceMode: serviceMode,
                serviceModeId: serviceModeMap[serviceMode] || "",
                fromDate: site.getStartDate() || "",
                toDate: site.getEndDate() || "",
                status: locationResource.status || "unknown",
                lastUpdated: locationResource.meta?.lastUpdated || "",
                staff: staff
            });
        }

        return res.status(200).json({
            status: 1,
            data: sites,
            total: locationResponse.total || sites.length
        });

    } catch (err) {
        console.error("Error listing screening sites:", err);
        return res.status(500).json({
            status: 0,
            message: err.message
        });
    }
};

const getScreeningSite = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.accessToken;

        const locationResponse = await fetchResource("Location", { _id: id }, token);
        if (!locationResponse.entry?.length) {
            return res.status(404).json({
                status: 0,
                message: "Screening site not found"
            });
        }

        const locationResource = locationResponse.entry[0].resource;
        const site = new ScreeningSite({}, locationResource);
        const locationData = site.getLocation();

        let location = "";
        let areaCouncil = "";
        let areaCouncilId = "";

        if (locationData?.type === "FREE_TEXT") {
            location = locationData.value || "";
        } else if (locationData?.type === "AREA_COUNCIL") {
            try {
                const councilResponse = await fetchResource("Location", { _id: locationData.value }, token);
                const councilResource = councilResponse.entry?.[0]?.resource;
                areaCouncil = councilResource?.name || locationData.value;
                areaCouncilId = councilResource?.id || locationData.value;
            } catch (e) {
                console.error("Error fetching area council:", e);
                areaCouncil = locationData.value;
                areaCouncilId = locationData.value;
            }
        }

        const staffResponse = await fetchResource(
            "PractitionerRole",
            { location: id },
            token
        );

        const staffRoles = staffResponse?.entry || [];
        const staff = await getStaffDetails(staffRoles, token);
        const serviceModeMap = await getAllServiceModes(token);
        const serviceMode = site.getServiceMode() || "";
        const serviceModeId = serviceModeMap[serviceMode] || "";

        return res.status(200).json({
            status: 1,
            data: {
                id: locationResource.id,
                name: locationResource.name || "",
                location: location,
                areaCouncil: areaCouncil,
                areaCouncilId: areaCouncilId,
                serviceMode: serviceMode,
                serviceModeId: serviceModeId,
                fromDate: site.getStartDate() || "",
                toDate: site.getEndDate() || "",
                status: locationResource.status || "unknown",
                lastUpdated: locationResource.meta?.lastUpdated || "",
                staff: staff
            }
        });

    } catch (err) {
        console.error("Error fetching screening site:", err);
        return res.status(500).json({
            status: 0,
            message: err.message
        });
    }
};


module.exports = {
    createScreeningSite,
    getScreeningSite,
    listScreeningSites
};